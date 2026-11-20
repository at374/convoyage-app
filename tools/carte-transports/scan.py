import zipfile,csv,io,json,glob,os,statistics,sys
R='data/gtfs/'
man=json.load(open(R+'manifest.json'))
names={}
for k,v in man['networks'].items(): names[v['file']]=(v['network'],v.get('origin',''))
hub=open('transport-mission-hub.js',encoding='utf-8').read()
out=[]
for f in sorted(glob.glob(R+'*.zip')):
    b=os.path.basename(f)
    try:
        z=zipfile.ZipFile(f)
        def rd(n):
            if n not in z.namelist(): return []
            return list(csv.DictReader(io.TextIOWrapper(z.open(n),encoding='utf-8-sig')))
        st=rd('stops.txt'); la=[];lo=[]
        for s in st:
            try:
                a=float(s['stop_lat']);o=float(s['stop_lon'])
                if 41<a<52 and -6<o<11: la.append(a);lo.append(o)
            except: pass
        ends=[]
        for r in rd('calendar.txt'): ends.append(r.get('end_date',''))
        for r in rd('calendar_dates.txt'):
            if r.get('exception_type')=='1': ends.append(r.get('date',''))
        end=max([e for e in ends if len(e)==8] or [''])
        nm,orig=names.get(b,(b[:-4],'(hors manifeste)'))
        if not la: out.append(dict(file=b,name=nm,err='aucun arrêt')); continue
        la.sort();lo.sort();n=len(la)
        out.append(dict(file=b,name=nm,lat=round(statistics.median(la),4),lon=round(statistics.median(lo),4),
          b=[round(la[int(n*.03)],3),round(lo[int(n*.03)],3),round(la[int(n*.97)],3),round(lo[int(n*.97)],3)],
          stops=len(st),end=end,moteur=(b in hub or b.startswith('national-')),mb=round(os.path.getsize(f)/1e6,1)))
    except Exception as e: out.append(dict(file=b,err=str(e)[:60]))
json.dump(out,open(sys.argv[1] if len(sys.argv)>1 else 'scan.json','w'),ensure_ascii=False)
print(len(out),[o for o in out if 'err' in o][:5])
import datetime
t=datetime.date(2026,11,20)
low=[(o['end'],o['name']) for o in out if o.get('end') and o['end']<(t+datetime.timedelta(days=14)).strftime('%Y%m%d')]
print(sorted(low)[:20], len(low))
print([o['name'] for o in out if not o.get('end')][:10])
