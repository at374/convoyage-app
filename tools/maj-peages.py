#!/usr/bin/env python3
"""Mise à jour facile des péages (Convoyage Ultra).

Usage (depuis la racine du dépôt) :
  python3 tools/maj-peages.py check                      # contrôle de cohérence de toutes les données
  python3 tools/maj-peages.py import fichier.csv         # ajoute les paires/barrières ABSENTES
  python3 tools/maj-peages.py import fichier.csv --maj   # ajoute ET remplace les prix changés (révision annuelle)
  python3 tools/maj-peages.py gare "Nom" lat lon         # ajoute/corrige la position d'une gare (overlay)

CSV (séparateur ; ou ,) — une ligne par tarif, en-têtes obligatoires :
  type;a;b;c1;c2;km;source;date
  paire;TULLE EST;MANSAC TERRASSON;12,40;18,20;96;ASF C1/C2 2026;2026-06-01
  barriere;aprr-area-ouvert-xxx;;2,40;3,90;;PDF AREA 2026;2026-02-01
  - paire : a et b = noms EXACTS de gares (voir `check` pour la liste des noms inconnus), km = distance tarifaire.
  - barriere : a = identifiant de barrière de peages-overlay.json.
Après import : le script bascule sw.js (nouvelle version de cache) pour que les téléphones rechargent.
Un prix exact importé remplace automatiquement toute estimation (les estimations ne vivent que dans
peages-estimes.json, jamais dans les tarifs officiels).
"""
import csv, json, re, sys, os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OV, BASE, SW = (os.path.join(R, f) for f in ('peages-overlay.json', 'peages-aprr.json', 'sw.js'))
num = lambda s: float(str(s).replace(',', '.').replace('€', '').strip())

def load():
    o = json.load(open(OV, encoding='utf8')); b = json.load(open(BASE, encoding='utf8'))
    G = [x[0] for x in b['g']]
    P = {}
    for r in b['p'].split(';'):
        r = r.split(',')
        if len(r) >= 5: P[frozenset((G[int(r[0], 36)], G[int(r[1], 36)]))] = (int(r[2], 36) / 10, int(r[3], 36) / 10)
    for r in o['paires']: P[frozenset((r[0], r[1]))] = (r[2], r[3])
    names = set(G) | {x['nom'] for x in o['gares']}
    return o, b, names, P

def check():
    o, b, names, P = load(); bad = 0
    bar = {x['id'] for x in o['barrieres']}; tb = {}
    for t in o['tarifs']: tb.setdefault(t['b'], set()).add(t['c'])
    for i in sorted(bar):
        if not {1, 2} <= tb.get(i, set()): print('BARRIÈRE SANS TARIF cl.1/2 :', i); bad += 1
    for i in sorted(set(tb) - bar - {None}): print('TARIF SANS BARRIÈRE :', i); bad += 1
    from collections import Counter
    mort = Counter(); inv = 0
    for r in o['paires']:
        for n in r[:2]:
            if n not in names: mort[n] += 1
        if r[2] > r[3] + 1e-9: inv += 1
    if inv: print('CLASSE 1 > CLASSE 2 :', inv, 'paire(s)'); bad += inv
    if mort:
        print('AVERTISSEMENT : %d paires officielles dorment car %d gares n\'ont pas de position (ajouter avec : gare "NOM" lat lon) :' % (sum(mort.values()), len(mort)))
        for n, k in mort.most_common(60): print('   %4d  %s' % (k, n))
    s = open(os.path.join(R, 'routes-ui.js'), encoding='utf8').read()
    m = re.search(r"const OUV = \{(.*?)\};", s)
    slug = lambda n: re.sub(r'[^a-z0-9]+', '-', n.lower())
    for n in re.findall(r"'([^']+)':\s*\[", m.group(1)):
        if not any(i.endswith('-' + slug(n)) for i in bar): print('OUV SANS BARRIÈRE :', n); bad += 1
    print('OK : aucune anomalie' if not bad else f'{bad} anomalie(s)')
    return bad

def bump():
    s = open(SW, encoding='utf8').read()
    m = re.search(r"(const CACHE = ')([^']*)(')", s)
    old = m.group(2); mm = re.search(r'-v(\d+)$', old)
    new = old[:mm.start()] + '-v%d' % (int(mm.group(1)) + 1) if mm else old + '-v2'
    open(SW, 'w', encoding='utf8').write(s.replace(m.group(0), m.group(1) + new + m.group(3), 1)); print('sw.js :', old, '->', new)

def importer(path, maj):
    o, b, names, P = load()
    raw = open(path, encoding='utf-8-sig').read(); d = ';' if raw.count(';') >= raw.count(',') else ','
    ajout = modif = ignore = 0; tb = {(t['b'], t['c']): t for t in o['tarifs']}
    for r in csv.DictReader(raw.splitlines(), delimiter=d):
        typ = r['type'].strip().lower()
        if typ == 'paire':
            a, c = r['a'].strip(), r['b'].strip(); c1, c2, km = num(r['c1']), num(r['c2']), num(r['km'])
            if a not in names or c not in names: print('GARE INCONNUE (ligne ignorée) :', a, '/', c); ignore += 1; continue
            k = frozenset((a, c))
            if k in P:
                if maj and tuple(P[k]) != (c1, c2):
                    for x in o['paires']:
                        if {x[0], x[1]} == {a, c}: x[2], x[3] = c1, c2; modif += 1; break
                    else: print('Prix de la base d\'origine (peages-aprr.json) différent, non modifié :', a, c, P[k], '->', (c1, c2)); ignore += 1
                continue
            o['paires'].append([a, c, c1, c2, km]); P[k] = (c1, c2); ajout += 1
        elif typ == 'barriere':
            i = r['a'].strip()
            if not any(x['id'] == i for x in o['barrieres']): print('BARRIÈRE INCONNUE :', i); ignore += 1; continue
            for cl, v in ((1, num(r['c1'])), (2, num(r['c2']))):
                t = tb.get((i, cl))
                if t is None: o['tarifs'].append({'id': 'm%s%d' % (i[:12], cl), 'b': i, 'c': cl, 'a': v, 's': 'PROUVE', 'f': r.get('date') or '2026-02-01', 'u': 0}); ajout += 1
                elif maj and t['a'] != v: t['a'] = v; t['f'] = r.get('date') or t['f']; modif += 1
        else: print('TYPE INCONNU :', typ); ignore += 1
    json.dump(o, open(OV, 'w', encoding='utf8'), ensure_ascii=False, indent=2)
    print(f'ajoutés {ajout} · modifiés {modif} · ignorés {ignore}')
    if ajout or modif: bump()
    check()

def gare(nom, lat, lon):
    o = json.load(open(OV, encoding='utf8'))
    for x in o['gares']:
        if x['nom'] == nom: x['points'] = [[float(lat), float(lon)]]; break
    else: o['gares'].append({'nom': nom, 'points': [[float(lat), float(lon)]]})
    json.dump(o, open(OV, 'w', encoding='utf8'), ensure_ascii=False, indent=2); bump()

if __name__ == '__main__':
    a = sys.argv[1:]
    if a[:1] == ['check']: sys.exit(1 if check() else 0)
    elif a[:1] == ['import'] and len(a) >= 2: importer(a[1], '--maj' in a)
    elif a[:1] == ['gare'] and len(a) == 4: gare(*a[1:])
    else: print(__doc__)
