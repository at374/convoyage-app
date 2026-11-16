#!/usr/bin/env python3
"""Convoyage Ultra — prépare les GTFS officiels du couloir AURA–Suisse pour un graphe OTP2 réel.

Exécuté sur un serveur GitHub Actions (accès Internet) : aucun service payant, aucun déploiement.
- Télécharge chaque archive officielle (URL, taille, SHA-256, date relevés).
- Réduit chaque flux à la zone utile (arrêts dans le rectangle), sans créer ni modifier d'horaire.
- Évite les doublons : un réseau déjà présent dans l'agrégat régional Oùra n'est pas réimporté.
- Un flux en échec est consigné comme erreur, jamais remplacé par des données inventées.
Usage : python3 scripts/otp-reel/preparer_donnees.py --out otp-data --date 2026-11-24
"""
import argparse, csv, datetime, hashlib, io, json, os, re, sys, tempfile, unicodedata, urllib.request, zipfile

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
csv.field_size_limit(1 << 30)
UA = {'User-Agent': 'ConvoyageUltra-OTP2/1.0'}
# lat_min, lon_min, lat_max, lon_max : Lyon – Ambérieu – Chambéry – Annecy – Genève – Lausanne.
BBOX = (45.40, 4.65, 46.60, 6.75)
SNCF_URL = 'https://eu.ftp.opendatasoft.com/sncf/plandata/Export_OpenData_SNCF_GTFS_NewTripId.zip'
SWISS_API = 'https://data.opentransportdata.swiss/api/3/action/package_show?id=timetable-2026-gtfs2020'
SWISS_PERMALINK = 'https://data.opentransportdata.swiss/dataset/timetable-2026-gtfs2020/permalink'
INDIVIDUAL_IDS = ('sibra-annecy', 'tac-annemasse', 'tcl-lyon', 'synchro-chambery', 'ondea-grand-lac', 'start-thonon')
# Doublons constatés lors de la première exécution réelle (16/11/2026) : l'agrégat Oùra contient déjà TAC, Ondéa,
# Synchro et Star't ; le GTFS suisse contient déjà les trains SNCF et des lignes Sibra, TAC, Thonon, Évian, Ain.
# Le flux propre de chaque réseau est gardé ; ses lignes sont retirées des flux plus larges (motifs sur le nom
# d'agence normalisé, sans accents). Un retrait n'est appliqué que si le flux propre a bien été importé.
DUPLICATES = {
    'oura-agregat': {'tac-annemasse': r'\btac\b', 'ondea-grand-lac': r'ondea', 'synchro-chambery': r'synchro',
                     'start-thonon': r"star.?t\b", 'sibra-annecy': r'sibra', 'tcl-lyon': r'\btcl\b'},
    'suisse-ski': {'sncf': r'chemins de fer francais', 'sibra-annecy': r'sibra', 'tac-annemasse': r'annemasse',
                   'start-thonon': r'thonon', 'oura-agregat': r'^evian$|rdtain'},
    # Le flux SNCF porte une ligne « CFF » : les trains CFF viennent du GTFS suisse.
    'sncf': {'suisse-ski': r'^cff$'},
}
ORDER = ('sibra-annecy', 'tac-annemasse', 'tcl-lyon', 'synchro-chambery', 'ondea-grand-lac', 'start-thonon',
         'flixbus', 'blablacar-bus', 'sncf', 'oura-agregat', 'suisse-ski')
COPY_AS_IS = ('feed_info.txt', 'fare_attributes.txt')


def norm(text):
    return unicodedata.normalize('NFKD', text or '').encode('ascii', 'ignore').decode().lower().strip()


def download(url, limit=1500 * 1024 * 1024):
    req = urllib.request.Request(url, headers=UA)
    digest = hashlib.sha256()
    with urllib.request.urlopen(req, timeout=180) as r, tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as tmp:
        final = r.geturl()
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            digest.update(chunk)
            tmp.write(chunk)
            if tmp.tell() > limit:
                raise ValueError('archive trop volumineuse')
        return tmp.name, final, tmp.tell(), digest.hexdigest()


def members(z):
    """Nom de table -> chemin dans l'archive (certaines archives rangent les tables dans un dossier)."""
    out = {}
    for name in z.namelist():
        base = os.path.basename(name)
        if base.endswith('.txt') and base not in out:
            out[base] = name
    return out


def rows(z, path):
    with z.open(path) as s:
        reader = csv.reader(io.TextIOWrapper(s, encoding='utf-8-sig', newline=''))
        header = next(reader, None)
        if not header:
            return
        header = [h.strip() for h in header]
        yield header
        width = len(header)
        for row in reader:
            if not row:
                continue
            if len(row) < width:
                row = row + [''] * (width - len(row))
            yield row


def in_bbox(lat, lon, bbox):
    try:
        lat, lon = float(lat), float(lon)
    except (TypeError, ValueError):
        return False
    return bbox[0] <= lat <= bbox[2] and bbox[1] <= lon <= bbox[3]


def service_active(day, calendar, exceptions):
    """Services circulant le jour demandé, d'après calendar.txt et calendar_dates.txt."""
    stamp = day.strftime('%Y%m%d')
    weekday = ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')[day.weekday()]
    active = {sid for sid, c in calendar.items()
              if c.get(weekday) == '1' and c.get('start_date', '') <= stamp <= c.get('end_date', '')}
    for sid, date, kind in exceptions:
        if date == stamp:
            if kind == '1':
                active.add(sid)
            elif kind == '2':
                active.discard(sid)
    return active


def filter_feed(src, dst, bbox, day, exclude_agencies=None):
    """Réduit un GTFS aux arrêts de la zone. Retourne un rapport ; lève ValueError si rien d'exploitable."""
    with zipfile.ZipFile(src) as z:
        m = members(z)
        missing = [t for t in ('agency.txt', 'stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt') if t not in m]
        if missing:
            raise ValueError('tables manquantes : ' + ', '.join(missing))
        if 'calendar.txt' not in m and 'calendar_dates.txt' not in m:
            raise ValueError('calendrier absent')
        report = {'before': {}, 'after': {}}
        # Arrêts de la zone.
        it = rows(z, m['stops.txt'])
        sh = next(it)
        si, slat, slon = sh.index('stop_id'), sh.index('stop_lat'), sh.index('stop_lon')
        sparent = sh.index('parent_station') if 'parent_station' in sh else None
        stops, inside = {}, set()
        for r in it:
            stops[r[si]] = r
            if in_bbox(r[slat], r[slon], bbox):
                inside.add(r[si])
        report['before']['stops'] = len(stops)
        if not inside:
            raise ValueError('aucun arrêt dans la zone')
        # Lignes des agences écartées (doublons d'un flux propre déjà importé).
        excluded_trips, excluded_names = set(), []
        if exclude_agencies:
            pattern = re.compile(exclude_agencies)
            it = rows(z, m['agency.txt'])
            h = next(it)
            ai = h.index('agency_id') if 'agency_id' in h else None
            an = h.index('agency_name')
            bad = set()
            for r in it:
                if pattern.search(norm(r[an])):
                    bad.add(r[ai] if ai is not None else '')
                    excluded_names.append(r[an])
            if bad and ai is not None:
                it = rows(z, m['routes.txt'])
                h = next(it)
                if 'agency_id' in h:
                    ri, ra = h.index('route_id'), h.index('agency_id')
                    bad_routes = {r[ri] for r in it if r[ra] in bad}
                    it = rows(z, m['trips.txt'])
                    h = next(it)
                    xt, xr = h.index('trip_id'), h.index('route_id')
                    excluded_trips = {r[xt] for r in it if r[xr] in bad_routes}
        report['excludedAgencies'] = excluded_names
        report['excludedTrips'] = len(excluded_trips)
        # Passe 1 : nombre d'arrêts de la zone desservis par course.
        it = rows(z, m['stop_times.txt'])
        th = next(it)
        ti, tsi = th.index('trip_id'), th.index('stop_id')
        count, total = {}, 0
        for r in it:
            total += 1
            if r[tsi] in inside and r[ti] not in excluded_trips:
                count[r[ti]] = count.get(r[ti], 0) + 1
        report['before']['stop_times'] = total
        keep_trips = {t for t, n in count.items() if n >= 2}
        del count
        if not keep_trips:
            raise ValueError('aucune course avec au moins deux arrêts dans la zone')
        tmpdir = tempfile.mkdtemp(prefix='gtfs-')

        def writer(name, header):
            f = open(os.path.join(tmpdir, name), 'w', encoding='utf-8', newline='')
            w = csv.writer(f, lineterminator='\n')
            w.writerow(header)
            return f, w

        # Passe 2 : horaires conservés.
        f, w = writer('stop_times.txt', th)
        used_stops, kept = set(), 0
        for r in rows(z, m['stop_times.txt']):
            if r is th or r == th:
                continue
            if r[ti] in keep_trips and r[tsi] in inside:
                w.writerow(r)
                used_stops.add(r[tsi])
                kept += 1
        f.close()
        report['after']['stop_times'] = kept
        # Arrêts utilisés + gares parentes.
        out_stops = set(used_stops)
        if sparent is not None:
            out_stops |= {stops[s][sparent] for s in used_stops if stops[s][sparent] and stops[s][sparent] in stops}
        f, w = writer('stops.txt', sh)
        for sid in out_stops:
            w.writerow(stops[sid])
        f.close()
        report['after']['stops'] = len(out_stops)
        # Courses, lignes, services.
        it = rows(z, m['trips.txt'])
        h = next(it)
        tti, tri, tsv = h.index('trip_id'), h.index('route_id'), h.index('service_id')
        tshape = h.index('shape_id') if 'shape_id' in h else None
        f, w = writer('trips.txt', h)
        routes_used, services_used, shapes_used, trips_by_service, before = set(), set(), set(), {}, 0
        for r in it:
            before += 1
            if r[tti] in keep_trips:
                w.writerow(r)
                routes_used.add(r[tri])
                services_used.add(r[tsv])
                trips_by_service[r[tsv]] = trips_by_service.get(r[tsv], 0) + 1
                if tshape is not None and r[tshape]:
                    shapes_used.add(r[tshape])
        f.close()
        report['before']['trips'] = before
        report['after']['trips'] = len(keep_trips)
        it = rows(z, m['routes.txt'])
        h = next(it)
        rri = h.index('route_id')
        rag = h.index('agency_id') if 'agency_id' in h else None
        f, w = writer('routes.txt', h)
        agencies_used, nroutes, routes_per_agency = set(), 0, {}
        for r in it:
            if r[rri] in routes_used:
                w.writerow(r)
                nroutes += 1
                key = r[rag] if rag is not None else ''
                agencies_used.add(key)
                routes_per_agency[key] = routes_per_agency.get(key, 0) + 1
        f.close()
        report['after']['routes'] = nroutes
        it = rows(z, m['agency.txt'])
        h = next(it)
        aid = h.index('agency_id') if 'agency_id' in h else None
        aname = h.index('agency_name')
        f, w = writer('agency.txt', h)
        agencies = []
        all_agencies = list(it)
        for r in all_agencies:
            key = r[aid] if aid is not None else ''
            if rag is None or aid is None or key in agencies_used or len(all_agencies) == 1:
                w.writerow(r)
                agencies.append({'agency_name': r[aname], 'routes': routes_per_agency.get(key, nroutes if len(all_agencies) == 1 else 0)})
        f.close()
        report['agencies'] = agencies
        # Calendriers.
        calendar, exceptions, dates = {}, [], []
        if 'calendar.txt' in m:
            it = rows(z, m['calendar.txt'])
            h = next(it, None)
            if h:
                ci = h.index('service_id')
                f, w = writer('calendar.txt', h)
                for r in it:
                    if r[ci] in services_used:
                        w.writerow(r)
                        calendar[r[ci]] = dict(zip(h, r))
                        dates += [calendar[r[ci]].get('start_date', ''), calendar[r[ci]].get('end_date', '')]
                f.close()
        if 'calendar_dates.txt' in m:
            it = rows(z, m['calendar_dates.txt'])
            h = next(it, None)
            if h:
                ci, cd, ce = h.index('service_id'), h.index('date'), h.index('exception_type')
                f, w = writer('calendar_dates.txt', h)
                for r in it:
                    if r[ci] in services_used:
                        w.writerow(r)
                        exceptions.append((r[ci], r[cd], r[ce]))
                        if r[ce] == '1':
                            dates.append(r[cd])
                f.close()
        dates = sorted(d for d in dates if len(d) == 8 and d.isdigit())
        report['validity'] = {'from': dates[0] if dates else None, 'to': dates[-1] if dates else None}
        active = service_active(day, calendar, exceptions)
        report['tripsActiveOnTestDate'] = sum(n for s, n in trips_by_service.items() if s in active)
        # Tables optionnelles filtrées.
        if 'shapes.txt' in m and shapes_used:
            it = rows(z, m['shapes.txt'])
            h = next(it, None)
            if h:
                shi = h.index('shape_id')
                f, w = writer('shapes.txt', h)
                for r in it:
                    if r[shi] in shapes_used:
                        w.writerow(r)
                f.close()
        if 'frequencies.txt' in m:
            it = rows(z, m['frequencies.txt'])
            h = next(it, None)
            if h:
                fi = h.index('trip_id')
                f, w = writer('frequencies.txt', h)
                for r in it:
                    if r[fi] in keep_trips:
                        w.writerow(r)
                f.close()
        if 'transfers.txt' in m:
            it = rows(z, m['transfers.txt'])
            h = next(it, None)
            if h and 'from_stop_id' in h and 'to_stop_id' in h:
                a, b = h.index('from_stop_id'), h.index('to_stop_id')
                extra = [h.index(c) for c in ('from_trip_id', 'to_trip_id') if c in h]
                extra_routes = [h.index(c) for c in ('from_route_id', 'to_route_id') if c in h]
                f, w = writer('transfers.txt', h)
                for r in it:
                    if r[a] in out_stops and r[b] in out_stops and \
                            all(not r[i] or r[i] in keep_trips for i in extra) and \
                            all(not r[i] or r[i] in routes_used for i in extra_routes):
                        w.writerow(r)
                f.close()
        if 'fare_rules.txt' in m and 'fare_attributes.txt' in m:
            it = rows(z, m['fare_rules.txt'])
            h = next(it, None)
            if h:
                fr = h.index('route_id') if 'route_id' in h else None
                f, w = writer('fare_rules.txt', h)
                for r in it:
                    if fr is None or not r[fr] or r[fr] in routes_used:
                        w.writerow(r)
                f.close()
        report['faresInFeed'] = 'fare_attributes.txt' in m
        for name in COPY_AS_IS:
            if name in m:
                with open(os.path.join(tmpdir, name), 'wb') as f:
                    f.write(z.read(m[name]))
        with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as out:
            for name in sorted(os.listdir(tmpdir)):
                out.write(os.path.join(tmpdir, name), name)
                os.remove(os.path.join(tmpdir, name))
        os.rmdir(tmpdir)
        report['after']['bytes'] = os.path.getsize(dst)
        return report


def swiss_url():
    try:
        with urllib.request.urlopen(urllib.request.Request(SWISS_API, headers=UA), timeout=90) as r:
            meta = json.load(r)
        res = [x for x in meta.get('result', {}).get('resources', []) if str(x.get('url', '')).lower().endswith('.zip')]
        res.sort(key=lambda x: str(x.get('name') or x.get('url') or ''), reverse=True)
        if res:
            return res[0]['url'], 'API CKAN officielle (package_show)'
    except Exception as e:  # consigné dans le rapport par l'appelant
        return SWISS_PERMALINK, 'permalien (API CKAN en échec : %s)' % e
    return SWISS_PERMALINK, 'permalien'


def national_feeds(audit_path):
    """Adresses FlixBus / BlaBlaCar Bus relevées par l'audit du catalogue PAN (script existant)."""
    out = []
    try:
        with open(audit_path, encoding='utf-8') as f:
            audit = json.load(f)
        for op, ident in (('flixbus', 'flixbus'), ('blablacarBus', 'blablacar-bus')):
            feeds = [x for x in audit.get('operators', {}).get(op, {}).get('feeds', []) if isinstance(x, dict) and x.get('url')]
            feeds.sort(key=lambda x: str(x.get('updatedAt') or ''), reverse=True)
            if feeds:
                out.append({'id': ident, 'url': feeds[0]['url'], 'origin': 'catalogue PAN (audit-national-operators)'})
    except Exception:
        pass
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--out', default='otp-data')
    p.add_argument('--date', required=True, help='jour de test AAAA-MM-JJ')
    p.add_argument('--audit', default='docs/audit-national-operators.json')
    p.add_argument('--only', help='liste d’identifiants séparés par des virgules (essais)')
    args = p.parse_args()
    day = datetime.date.fromisoformat(args.date)
    os.makedirs(args.out, exist_ok=True)
    import build_regional_gtfs as regional
    sources = []
    try:
        url, modified = regional.find_oura_aggregate()
        sources.append({'id': 'oura-agregat', 'url': url, 'origin': 'data.gouv.fr agregat-oura (modifié %s)' % modified})
    except BaseException as e:
        sources.append({'id': 'oura-agregat', 'error': 'adresse introuvable : %s' % e})
    sources.append({'id': 'sncf', 'url': SNCF_URL, 'origin': 'SNCF Open Data (export national)'})
    url, origin = swiss_url()
    sources.append({'id': 'suisse-ski', 'url': url, 'origin': origin})
    sources += national_feeds(args.audit)
    known = {s['id']: s for s in regional.MIRROR + regional.FILTERED_MIRROR}
    for ident in INDIVIDUAL_IDS:
        s = known.get(ident)
        if not s:
            continue
        url = regional.current_dataset_zip(s['dataset'], s['url']) if s.get('dataset') else s['url']
        sources.append({'id': ident, 'url': url, 'origin': 'liste validée build_regional_gtfs.py', 'individual': True, 'network': s['network']})
    if args.only:
        wanted = set(args.only.split(','))
        sources = [s for s in sources if s['id'] in wanted]
    report = {'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
              'testDate': args.date, 'bbox': {'latMin': BBOX[0], 'lonMin': BBOX[1], 'latMax': BBOX[2], 'lonMax': BBOX[3]},
              'feeds': []}
    rank = {ident: i for i, ident in enumerate(ORDER)}
    sources.sort(key=lambda s: rank.get(s['id'], len(ORDER)))
    imported_ids = set()
    for s in sources:
        entry = {'id': s['id'], 'url': s.get('url'), 'origin': s.get('origin')}
        report['feeds'].append(entry)
        if s.get('error'):
            entry['status'] = 'erreur'
            entry['error'] = s['error']
            continue
        tmp = None
        try:
            tmp, final, size, sha = download(s['url'])
            entry.update({'finalUrl': final, 'bytes': size, 'sha256': sha})
            dst = os.path.join(args.out, s['id'] + '.gtfs.zip')
            patterns = [pat for owner, pat in DUPLICATES.get(s['id'], {}).items() if owner in imported_ids]
            entry.update(filter_feed(tmp, dst, BBOX, day, '|'.join(patterns) if patterns else None))
            entry['status'] = 'importé'
            entry['file'] = os.path.basename(dst)
            imported_ids.add(s['id'])
        except BaseException as e:
            if isinstance(e, KeyboardInterrupt):
                raise
            entry['status'] = 'erreur'
            entry['error'] = '%s: %s' % (type(e).__name__, e)
        finally:
            if tmp and os.path.exists(tmp):
                os.remove(tmp)
        print(json.dumps({k: entry.get(k) for k in ('id', 'status', 'error', 'bytes', 'after', 'validity', 'tripsActiveOnTestDate', 'excludedAgencies', 'excludedTrips')}, ensure_ascii=False), flush=True)
    # La ligne « CFF » du flux SNCF n'est retirée qu'une fois le GTFS suisse réellement importé (traité après lui).
    if {'sncf', 'suisse-ski'} <= imported_ids:
        entry = next(e for e in report['feeds'] if e['id'] == 'sncf')
        path = os.path.join(args.out, 'sncf.gtfs.zip')
        try:
            again = filter_feed(path, path + '.tmp', BBOX, day, DUPLICATES['sncf']['suisse-ski'])
            os.replace(path + '.tmp', path)
            for key in ('after', 'agencies', 'tripsActiveOnTestDate', 'excludedAgencies', 'excludedTrips'):
                entry[key] = again[key]
        except ValueError as e:
            entry['duplicateFilterError'] = str(e)
            if os.path.exists(path + '.tmp'):
                os.remove(path + '.tmp')
    with open(os.path.join(args.out, 'sources.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    imported = [e for e in report['feeds'] if e.get('status') == 'importé']
    if not imported:
        sys.exit('Aucun flux GTFS importé')


if __name__ == '__main__':
    main()
