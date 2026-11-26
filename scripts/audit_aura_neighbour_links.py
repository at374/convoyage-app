"""Audit ordered direct GTFS stop pairs; not a live availability check."""
import csv, io, json, pathlib, sys, zipfile, unicodedata, re
from collections import defaultdict, Counter

PAIRS = {'lyon-dijon': ('lyon','dijon'), 'bourg-besancon': ('bourg en bresse','besancon'), 'grenoble-gap': ('grenoble','gap'), 'clermont-bourges': ('clermont ferrand','bourges'), 'clermont-millau': ('clermont ferrand','millau')}

def norm(s):
    return re.sub(r'[^a-z0-9]+',' ', ''.join(c for c in unicodedata.normalize('NFKD',s.lower()) if not unicodedata.combining(c))).strip()

def rows(z,n):
    return list(csv.DictReader(io.TextIOWrapper(z.open(n),encoding='utf-8-sig')))

for path in sorted(pathlib.Path(sys.argv[1]).glob('*.zip')):
    corridor = next(k for k in PAIRS if path.stem.endswith(k))
    a,b = PAIRS[corridor]
    with zipfile.ZipFile(path) as z:
        stops = {r['stop_id']:norm(r['stop_name']) for r in rows(z,'stops.txt')}
        routes = {r['route_id']:r for r in rows(z,'routes.txt')}
        trips = {r['trip_id']:r for r in rows(z,'trips.txt')}
        times = defaultdict(list)
        for r in rows(z,'stop_times.txt'):
            times[r['trip_id']].append(r)
        counts = Counter()
        for tid, seq in times.items():
            route = routes[trips[tid]['route_id']]
            seq.sort(key=lambda r:int(r['stop_sequence']))
            for origin,dest in ((a,b),(b,a)):
                boarded = False
                for r in seq:
                    name = stops[r['stop_id']]
                    if boarded and re.search(r'\\b'+dest+r'\\b',name) and r.get('drop_off_type') not in ('1','2','3'):
                        counts[(origin,dest,route.get('agency_id',''),route.get('route_type',''))]+=1
                        break
                    if re.search(r'\\b'+origin+r'\\b',name) and r.get('pickup_type') not in ('1','2','3'):
                        boarded=True
        result={'file':path.name,'method':'stop-name candidates, ordered direct trips, no date or seat guarantee','links':[dict(origin=k[0],destination=k[1],agency=k[2],route_type=k[3],trips=v) for k,v in sorted(counts.items())]}
        print(json.dumps(result))
        path.with_suffix('.links.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
