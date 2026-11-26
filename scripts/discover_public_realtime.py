"""Inventory official realtime endpoints; discovery is not proof of access."""
import json, urllib.request, pathlib, unicodedata
from collections import Counter
URL = 'https://transport.data.gouv.fr/api/datasets'
with urllib.request.urlopen(URL, timeout=60) as response:
    datasets = json.load(response)
assert isinstance(datasets,list), 'Unexpected catalogue schema'
out = []
seen = set()
for ds in datasets:
    static_resources=[{'id':r.get('id'),'url':r.get('url')} for r in ds.get('resources',[]) if str(r.get('format','')).lower()=='gtfs' and str(r.get('url','')).startswith('https://')]
    for resource in ds.get('resources',[]):
        fmt = str(resource.get('format','')).lower().replace('_','-')
        if fmt not in ('gtfs-rt','gtfsrt','siri','siri lite','siri-lite','sirilite'):
            continue
        url = resource.get('url')
        if not isinstance(url,str) or not url.startswith('https://'):
            continue
        key = (fmt, url)
        if key in seen:
            continue
        seen.add(key)
        out.append({'dataset':ds.get('slug'),'title':ds.get('title'),'territory':ds.get('territory'),'region':ds.get('region'),'resource_id':resource.get('id'),'format':fmt,'url':url,'static_gtfs_candidates':static_resources,'status':'discovered_not_validated'})
assert out, 'No matching realtime resources found'
def normalize(value):
    return ''.join(c for c in unicodedata.normalize('NFKD',str(value or '').lower()) if not unicodedata.combining(c))
def priority(row):
    region_value=row.get('region')
    region=normalize(region_value)
    codes=set()
    if isinstance(region_value,dict):
        codes={str(region_value.get(k,'')) for k in ('id','code','insee_code','region_code')}
    else:
        codes={str(region_value or '')}
    if 'auvergne' in region or 'rhone-alpes' in region or '84' in codes:
        return 0
    if any(x in region for x in ('bourgogne','franche-comte','provence','occitanie','nouvelle-aquitaine','centre-val de loire')) or codes.intersection({'27','93','76','75','24'}):
        return 1
    return 2
for row in out:
    row['geographic_priority']=priority(row)
out.sort(key=lambda row:(row['geographic_priority'],str(row.get('dataset')),row['url']))
matching_slugs={r['dataset'] for r in out}
examples=[{k:v for k,v in d.items() if k not in ('resources','description')} for d in datasets if d.get('slug') in matching_slugs][:8]
print('Transport dataset metadata examples:',json.dumps(examples,ensure_ascii=False)[:20000])
print('Geographic priorities:',dict(Counter(row['geographic_priority'] for row in out)))
pathlib.Path('realtime-candidates.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print('Public realtime candidates:',len(out))
