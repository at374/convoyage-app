"""Build bounded, dated station-to-station railway schedules. Never writes missions."""
import argparse, csv, hashlib, io, json, zipfile
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

SOURCE='https://eu.ftp.opendatasoft.com/sncf/plandata/Export_OpenData_SNCF_GTFS_NewTripId.zip'
LICENSE='https://data.sncf.com/explore/dataset/horaires-sncf/'

def seconds(value):
    h,m,s=map(int,value.split(':'))
    if not 0<=h<=71 or not 0<=m<60 or not 0<=s<60: raise ValueError('Invalid GTFS time')
    return h*3600+m*60+s

def build(archive, output, start, days):
    if not 1<=days<=15:raise ValueError('1–15 days required')
    dates=[date.fromisoformat(start)+timedelta(days=i) for i in range(days)]
    sha=hashlib.sha256(archive.read_bytes()).hexdigest()
    def read(z,name):
        if name not in z.namelist():return []
        with z.open(name) as f:return list(csv.DictReader(io.TextIOWrapper(f,encoding='utf-8-sig')))
    with zipfile.ZipFile(archive) as z:
        if sum(i.file_size for i in z.infolist())>500_000_000:raise ValueError('Archive exceeds limit')
        feed=read(z,'feed_info.txt')[0]
        if any(not feed['feed_start_date']<=d.strftime('%Y%m%d')<=feed['feed_end_date'] for d in dates):raise ValueError('Dates outside feed validity')
        stops={r['stop_id']:r for r in read(z,'stops.txt')}
        routes={r['route_id']:r for r in read(z,'routes.txt') if r['route_type']=='2' or 100<=int(r['route_type'])<200}
        frequencies={r['trip_id'] for r in read(z,'frequencies.txt')}
        trips={r['trip_id']:r for r in read(z,'trips.txt') if r['route_id'] in routes and r['trip_id'] not in frequencies}
        agencies=read(z,'agency.txt')
        zones={r.get('agency_timezone') for r in agencies}
        if zones!={'Europe/Paris'}:raise ValueError('Unexpected timezone')
        calendars=read(z,'calendar.txt'); exceptions=read(z,'calendar_dates.txt')
        active={}
        weekdays=['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
        for d in dates:
            key=d.strftime('%Y%m%d');services={r['service_id'] for r in calendars if r['start_date']<=key<=r['end_date'] and r[weekdays[d.weekday()]]=='1'}
            for r in exceptions:
                if r['date']==key:
                    if r['exception_type']=='1':services.add(r['service_id'])
                    elif r['exception_type']=='2':services.discard(r['service_id'])
            active[d.isoformat()]={k for k,t in trips.items() if t['service_id'] in services}
        needed=set().union(*active.values()); events=defaultdict(list);blocked=set()
        for r in read(z,'stop_times.txt'):
            trip=r['trip_id']
            if trip not in needed:continue
            try:
                stop=stops[r['stop_id']];parent=stop.get('parent_station') or r['stop_id']
                station=stops[parent];lat,lon=float(station['stop_lat']),float(station['stop_lon'])
                if not -90<=lat<=90 or not -180<=lon<=180:raise ValueError('coordinates')
                seq=int(r['stop_sequence']);arr,dep=seconds(r['arrival_time']),seconds(r['departure_time'])
                if seq<0 or dep<arr:raise ValueError('chronology')
                pickup=int(r.get('pickup_type') or 0);dropoff=int(r.get('drop_off_type') or 0)
                if pickup not in range(4) or dropoff not in range(4):raise ValueError('boarding rule')
                events[trip].append((seq,parent,arr,dep,pickup,dropoff))
            except (KeyError,ValueError,TypeError):blocked.add(trip)
        for trip,rows in events.items():
            rows.sort()
            if len(rows)<2 or any(a[0]>=b[0] or a[3]>b[2] for a,b in zip(rows,rows[1:])):blocked.add(trip)
        used=sorted({r[1] for k,rows in events.items() if k not in blocked for r in rows})
        station_index={k:i for i,k in enumerate(used)}
        stations=[[k,stops[k]['stop_name'],float(stops[k]['stop_lat']),float(stops[k]['stop_lon'])] for k in used]
        output.mkdir(parents=True,exist_ok=True)
        manifest={'schemaVersion':1,'source':'SNCF Voyageurs / GTFS','sourceUrl':SOURCE,'sourceSha256':sha,
          'sourceVersion':feed['feed_version'],'feedValidity':[feed['feed_start_date'],feed['feed_end_date']],
          'generatedAt':datetime.now(timezone.utc).isoformat(),'license':'ODbL — SNCF conditions apply','licenseUrl':LICENSE,
          'scope':'scheduled railway station-to-station only; no realtime, fares or walking','dates':{}}
        for day,ids in active.items():
            compact=[]
            for k in sorted(ids-blocked):
                if k not in events:continue
                route=routes[trips[k]['route_id']]
                compact.append([k,route.get('route_short_name') or route.get('route_long_name') or '',trips[k].get('trip_short_name') or '',
                    [[station_index[r[1]],*r[2:]] for r in events[k]]])
            payload={'schemaVersion':1,'date':day,'timeZone':'Europe/Paris','sourceSha256':sha,'sourceVersion':feed['feed_version'],
                'transportConfirmed':False,'realtime':False,'stations':stations,'trips':compact}
            encoded=json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode()
            filename='sncf-'+day+'.json';(output/filename).write_bytes(encoded)
            manifest['dates'][day]={'file':filename,'sha256':hashlib.sha256(encoded).hexdigest(),'bytes':len(encoded),'trips':len(compact),'stations':len(stations),'excludedTrips':len(ids&blocked)}
        (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
        return manifest

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('archive',type=Path);p.add_argument('output',type=Path);p.add_argument('--start',required=True);p.add_argument('--days',type=int,default=8)
    a=p.parse_args();r=build(a.archive,a.output,a.start,a.days)
    print(json.dumps({'sourceVersion':r['sourceVersion'],'dates':r['dates']},ensure_ascii=False))
