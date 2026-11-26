"""Audit ordered direct GTFS stop pairs; not a live availability check."""
import csv, io, json, pathlib, sys, zipfile, unicodedata, re
from collections import defaultdict, Counter

PAIRS = {'lyon-dijon': ('lyon','dijon'), 'bourg-besancon': ('bourg en bresse','besancon'), 'grenoble-gap': ('grenoble','gap'), 'clermont-bourges': ('clermont ferrand','bourges'), 'clermont-millau': ('clermont ferrand','millau')}

CENTRES = {'lyon':(45.764,4.8357),'dijon':(47.322,5.0415),'bourg en bresse':(46.205,5.225),'besancon':(47.238,6.024),'grenoble':(45.1885,5.7245),'gap':(44.5594,6.079),'clermont ferrand':(45.7772,3.087),'bourges':(47.081,2.398),'millau':(44.1006,3.0778)}

def nearby(stop, city):
    import math
    try:
        lat, lon = float(stop['stop_lat']), float(stop['stop_lon'])
        a,b = CENTRES[city]
        return math.hypot((lat-a)*111.2,(lon-b)*111.2*math.cos(math.radians(a))) <= 5
    except (ValueError, TypeError, KeyError):
        return False

def norm(s):
    return re.sub(r'[^a-z0-9]+',' ', ''.join(c for c in unicodedata.normalize('NFKD',s.lower()) if not unicodedata.combining(c))).strip()

def rows(z,n):
    return list(csv.DictReader(io.TextIOWrapper(z.open(n),encoding='utf-8-sig')))

for path in sorted(pathlib.Path(sys.argv[1]).glob('*.zip')):
    corridor = next(k for k in PAIRS if path.stem.endswith(k))
    a,b = PAIRS[corridor]
    with zipfile.ZipFile(path) as z:
        stops = {r['stop_id']:r for r in rows(z,'stops.txt')}
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
                    stop = stops[r['stop_id']]
                    if boarded and nearby(stop, dest) and r.get('drop_off_type') not in ('1','2','3'):
                        counts[(origin,dest,route.get('agency_id',''),route.get('route_type',''))]+=1
                        break
                    if nearby(stop, origin) and r.get('pickup_type') not in ('1','2','3'):
                        boarded=True
        result={'file':path.name,'method':'5 km city-centre geographic candidates, ordered direct trips, no date or seat guarantee','links':[dict(origin=k[0],destination=k[1],agency=k[2],route_type=k[3],trips=v) for k,v in sorted(counts.items())]}
        print(json.dumps(result))
        path.with_suffix('.links.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
