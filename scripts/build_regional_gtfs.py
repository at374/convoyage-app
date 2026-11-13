#!/usr/bin/env python3
"""Convoyage Ultra — prépare côté serveur de petits flux GTFS officiels servis par l'application.

1. Extrait de l'agrégat régional Oùra (data.gouv) les réseaux absents des flux propres
   (J'y bus Rumilly, TAM Ambérieu, Cars Région Isère, Cars Région Savoie) en GTFS réduits.
2. Recopie les flux propres déjà utilisés (TAC, Synchro, Ondéa, Star't) pour qu'ils soient servis
   depuis le site de l'application (même origine : pas de blocage CORS sur le téléphone).

Aucun horaire ni tarif n'est créé : seules des lignes du GTFS officiel sont recopiées, avec leurs
fare_attributes / fare_rules quand le producteur les publie. Chaque fichier est validé (tables
obligatoires, calendrier, références) et plafonné en taille ; un manifeste daté (SHA-256) est écrit.
Usage : python3 scripts/build_regional_gtfs.py [--aggregate fichier.zip] [--out data/gtfs] [--offline]
"""
import argparse, csv, hashlib, io, json, os, re, sys, tempfile, unicodedata, urllib.request, zipfile, datetime

UA = {'User-Agent': 'ConvoyageUltra-GTFS/1.0'}
MAX_OUT = 12 * 1024 * 1024
# Réseaux extraits de l'agrégat : motifs sur agency_name / agency_id (normalisés sans accents, minuscules).
EXTRACT = [
    {'id': 'jybus-rumilly', 'network': "J'y bus Rumilly", 'pattern': r"j.?y ?bus|rumilly", 'bounds': [45.80, 5.85, 45.93, 6.05]},
    {'id': 'tam-amberieu', 'network': 'TAM Ambérieu-en-Bugey', 'pattern': r"\btam\b|amberieu", 'bounds': [45.90, 5.28, 46.02, 5.45]},
    {'id': 'cars-region-isere', 'network': 'Cars Région Isère', 'pattern': r"cars? region.*isere|\bisere\b", 'bounds': [44.69, 4.74, 45.89, 6.36]},
    {'id': 'cars-region-savoie', 'network': 'Cars Région Savoie', 'pattern': r"^(?!.*haute).*(cars? region.*savoie|\bsavoie\b)", 'bounds': [45.05, 5.62, 45.80, 7.19]},
]
# Flux propres recopiés tels quels (après validation).
MIRROR = [
    {'id': 'tac-annemasse', 'network': 'TAC Annemasse', 'url': 'https://s3.eu-west-1.amazonaws.com/files.orchestra.ratpdev.com/networks/tp2a/exports/medias.zip', 'bounds': [46.1, 5.98, 46.27, 6.42]},
    {'id': 'synchro-chambery', 'network': 'Synchro Bus Chambéry', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/a81cdf4b-5a70-43c9-8803-cef0430ed170', 'bounds': [45.45, 5.75, 45.75, 6.15]},
    {'id': 'ondea-grand-lac', 'network': 'Ondéa Aix-les-Bains', 'url': 'https://www.data.gouv.fr/api/1/datasets/r/b4e8d98c-e17a-4fb0-857f-8cb618039b2a', 'bounds': [45.6, 5.75, 45.85, 6.05]},
    {'id': 'start-thonon', 'network': "Star't Thonon", 'url': 'https://www.data.gouv.fr/api/1/datasets/r/7cbb883b-d0cb-4bc7-b2e0-7537afdbc86e', 'bounds': [46.25, 6.3, 46.45, 6.65]},
]
REQUIRED = ['agency.txt', 'stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt']


def norm(text):
    return unicodedata.normalize('NFKD', text or '').encode('ascii', 'ignore').decode().lower()


def download(url, limit=400 * 1024 * 1024):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r, tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as tmp:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            tmp.write(chunk)
            if tmp.tell() > limit:
                raise SystemExit('Archive trop volumineuse : ' + url)
        return tmp.name


def find_oura_aggregate():
    api = 'https://www.data.gouv.fr/api/1/datasets/agregat-oura/'
    with urllib.request.urlopen(urllib.request.Request(api, headers=UA), timeout=40) as r:
        data = json.load(r)
    res = [x for x in data.get('resources', []) if 'gtfs' in (x.get('format') or '').lower() and (x.get('url') or '').startswith('https://')]
    if not res:
        raise SystemExit('Aucune ressource GTFS dans l’agrégat Oùra')
    best = max(res, key=lambda x: x.get('last_modified') or '')
    return best['url'], best.get('last_modified')


def read_table(z, name):
    if name not in z.namelist():
        return None, []
    with z.open(name) as s:
        reader = csv.DictReader(io.TextIOWrapper(s, encoding='utf-8-sig', newline=''))
        return reader.fieldnames, list(reader)


def write_table(out, name, fields, rows):
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=fields, lineterminator='\n', extrasaction='ignore')
    w.writeheader()
    w.writerows(rows)
    out.writestr(name, buf.getvalue())


def validate(z):
    names = set(z.namelist())
    missing = [t for t in REQUIRED if t not in names]
    if missing:
        raise ValueError('tables manquantes : ' + ', '.join(missing))
    if not ({'calendar.txt', 'calendar_dates.txt'} & names):
        raise ValueError('calendrier absent')
    _, trips = read_table(z, 'trips.txt')
    _, times = read_table(z, 'stop_times.txt')
    if not trips or not times:
        raise ValueError('aucune course')
    return len(trips), len(times)


def agencies_report(z):
    _, agencies = read_table(z, 'agency.txt')
    _, routes = read_table(z, 'routes.txt')
    count = {}
    for r in routes:
        count[r.get('agency_id') or ''] = count.get(r.get('agency_id') or '', 0) + 1
    return [{'agency_id': a.get('agency_id'), 'agency_name': a.get('agency_name'), 'routes': count.get(a.get('agency_id') or '', 0)} for a in agencies]


def extract(z, spec):
    pat = re.compile(spec['pattern'])
    afields, agencies = read_table(z, 'agency.txt')
    keep_ag = [a for a in agencies if pat.search(norm(a.get('agency_name'))) or pat.search(norm(a.get('agency_id')))]
    if not keep_ag:
        return None, 'aucune agence correspondante'
    ag_ids = {a.get('agency_id') or '' for a in keep_ag}
    single = len(agencies) == 1
    rfields, routes = read_table(z, 'routes.txt')
    routes = [r for r in routes if (r.get('agency_id') or '') in ag_ids or (single and not r.get('agency_id'))]
    route_ids = {r['route_id'] for r in routes}
    tfields, trips = read_table(z, 'trips.txt')
    trips = [t for t in trips if t['route_id'] in route_ids]
    trip_ids = {t['trip_id'] for t in trips}
    service_ids = {t['service_id'] for t in trips}
    stfields, times = read_table(z, 'stop_times.txt')
    times = [t for t in times if t['trip_id'] in trip_ids]
    stop_ids = {t['stop_id'] for t in times}
    sfields, stops = read_table(z, 'stops.txt')
    parents = {s.get('parent_station') for s in stops if s['stop_id'] in stop_ids and s.get('parent_station')}
    stops = [s for s in stops if s['stop_id'] in stop_ids or s['stop_id'] in parents]
    if not trips or not times:
        return None, 'agence trouvée mais aucune course'
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as out:
        write_table(out, 'agency.txt', afields, keep_ag)
        write_table(out, 'routes.txt', rfields, routes)
        write_table(out, 'trips.txt', tfields, trips)
        write_table(out, 'stop_times.txt', stfields, times)
        write_table(out, 'stops.txt', sfields, stops)
        for cal in ('calendar.txt', 'calendar_dates.txt'):
            f, rows = read_table(z, cal)
            if f:
                write_table(out, cal, f, [r for r in rows if r['service_id'] in service_ids])
        f, rows = read_table(z, 'feed_info.txt')
        if f:
            write_table(out, 'feed_info.txt', f, rows)
        # Tarifs officiels du producteur, limités aux lignes/agences extraites.
        ff, fares = read_table(z, 'fare_attributes.txt')
        rf, rules = read_table(z, 'fare_rules.txt')
        if ff:
            if rf:
                rules = [r for r in rules if not r.get('route_id') or r['route_id'] in route_ids]
                fare_ids = {r['fare_id'] for r in rules}
                fares = [x for x in fares if x['fare_id'] in fare_ids or (x.get('agency_id') or '') in ag_ids]
                write_table(out, 'fare_rules.txt', rf, rules)
            else:
                fares = [x for x in fares if (x.get('agency_id') or '') in ag_ids or len(fares) == 1]
            write_table(out, 'fare_attributes.txt', ff, fares)
    data = buf.getvalue()
    if len(data) > MAX_OUT:
        return None, 'extrait trop volumineux (%d octets)' % len(data)
    return data, {'agencies': [a.get('agency_name') for a in keep_ag], 'routes': len(routes), 'trips': len(trips), 'stops': len(stops), 'fares': bool(ff)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--aggregate', help='archive Oùra déjà téléchargée (tests)')
    ap.add_argument('--out', default='data/gtfs')
    ap.add_argument('--offline', action='store_true', help='ne pas télécharger les flux propres (tests)')
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    manifest = {'schemaVersion': 1, 'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'scope': 'GTFS officiels réduits ou recopiés ; aucun horaire ni tarif créé', 'networks': {}, 'errors': {}}
    if args.aggregate:
        path, version, src = args.aggregate, 'fichier local', 'local'
    else:
        src, version = find_oura_aggregate()
        path = download(src)
    with zipfile.ZipFile(path) as z:
        manifest['oura'] = {'source': src, 'version': version}
        with open(os.path.join(args.out, 'oura-agencies.json'), 'w', encoding='utf-8') as f:
            json.dump(agencies_report(z), f, ensure_ascii=False, indent=1)
        for spec in EXTRACT:
            try:
                data, info = extract(z, spec)
            except Exception as e:  # une erreur sur un réseau n'arrête pas les autres
                data, info = None, 'erreur : %s' % e
            if data is None:
                manifest['errors'][spec['id']] = info
                continue
            with zipfile.ZipFile(io.BytesIO(data)) as check:
                validate(check)
            name = spec['id'] + '.zip'
            with open(os.path.join(args.out, name), 'wb') as f:
                f.write(data)
            manifest['networks'][spec['id']] = {'network': spec['network'], 'file': name, 'sha256': hashlib.sha256(data).hexdigest(),
                                                'bytes': len(data), 'bounds': spec['bounds'], 'origin': 'agrégat Oùra', **info}
    if not args.offline:
        for spec in MIRROR:
            try:
                p = download(spec['url'], MAX_OUT)
                with zipfile.ZipFile(p) as z:
                    trips, times = validate(z)
                data = open(p, 'rb').read()
                name = spec['id'] + '.zip'
                with open(os.path.join(args.out, name), 'wb') as f:
                    f.write(data)
                manifest['networks'][spec['id']] = {'network': spec['network'], 'file': name, 'sha256': hashlib.sha256(data).hexdigest(),
                                                    'bytes': len(data), 'bounds': spec['bounds'], 'origin': spec['url'], 'trips': trips}
            except BaseException as e:
                manifest['errors'][spec['id']] = 'erreur : %s' % e
    with open(os.path.join(args.out, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(json.dumps({'networks': list(manifest['networks']), 'errors': manifest['errors']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
