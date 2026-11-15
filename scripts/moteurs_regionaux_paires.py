import csv,io,json,sys,zipfile,datetime,re,os
hub=open('transport-mission-hub.js',encoding='utf8').read()
nets=re.findall(r"\['([a-z_0-9]+)',\s*(?:'[^']*'|\"[^\"]*\"),\s*'([a-z0-9-]+\.zip)',\s*\[([0-9.,]+)\]\]",hub)
start=datetime.date.today()+datetime.timedelta(1);out=[]
for id_,file,b in nets:
    b=[float(x) for x in b.split(',')];p='data/gtfs/'+file
    if not os.path.exists(p): out.append({'id':id_,'file':file,'error':'fichier absent'});continue
    z=zipfile.ZipFile(p);rd=lambda n:list(csv.DictReader(io.TextIOWrapper(z.open(n),encoding='utf-8-sig'))) if n in z.namelist() else []
    stops={s['stop_id']:(float(s['stop_lat']),float(s['stop_lon'])) for s in rd('stops.txt') if s.get('stop_lat')}
    cal={c['service_id']:c for c in rd('calendar.txt')};cd={}
    for c in rd('calendar_dates.txt'): cd.setdefault(c['service_id'],{})[c['date']]=c['exception_type']
    def active(sid,d):
        k=d.strftime('%Y%m%d');e=cd.get(sid,{}).get(k)
        if e=='1':return True
        if e=='2':return False
        c=cal.get(sid);return bool(c) and c['start_date']<=k<=c['end_date'] and c[['monday','tuesday','wednesday','thursday','friday','saturday','sunday'][d.weekday()]]=='1'
    trips=rd('trips.txt');st={}
    for t in rd('stop_times.txt'): st.setdefault(t['trip_id'],[]).append(t)
    inb=lambda q:b[0]<=q[0]<=b[2] and b[1]<=q[1]<=b[3]
    found=None
    for dd in range(7):
        d=start+datetime.timedelta(dd)
        for t in trips:
            if not active(t['service_id'],d):continue
            s=sorted(st.get(t['trip_id'],[]),key=lambda x:int(x['stop_sequence']))
            if len(s)<2 or s[0]['stop_id'] not in stops or s[-1]['stop_id'] not in stops:continue
            a,c=stops[s[0]['stop_id']],stops[s[-1]['stop_id']]
            if not(inb(a) and inb(c)) or abs(a[0]-c[0])+abs(a[1]-c[1])<0.01:continue
            if not('06:00:00'<=s[0]['departure_time']<='20:00:00'):continue
            found={'date':d.isoformat(),'from':{'lat':a[0],'lon':a[1]},'to':{'lat':c[0],'lon':c[1]},'dep':s[0]['departure_time']};break
        if found:break
    out.append({'id':id_,'file':file,'trips':len(trips),**(found or {'error':'aucune course dans l’emprise sur 7 jours'})})
json.dump(out,open(sys.argv[1],'w'))
print(len(out),[o['id']+': '+o['error'] for o in out if 'error' in o])
