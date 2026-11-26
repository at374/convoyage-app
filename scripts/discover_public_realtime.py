"""Inventory official realtime endpoints; discovery is not proof of access."""
import json, urllib.request, pathlib
URL = 'https://transport.data.gouv.fr/api/datasets'
with urllib.request.urlopen(URL, timeout=60) as response:
    datasets = json.load(response)
assert isinstance(datasets,list), 'Unexpected catalogue schema'
out = []
for ds in datasets:
    for resource in ds.get('resources',[]):
        fmt = str(resource.get('format','')).lower().replace('_','-')
        if fmt not in ('gtfs-rt','gtfsrt','siri','siri lite','siri-lite','sirilite'):
            continue
        url = resource.get('url')
        if not isinstance(url,str) or not url.startswith('https://'):
            continue
        out.append({'dataset':ds.get('slug'),'title':ds.get('title'),'format':fmt,'url':url,'status':'discovered_not_validated'})
assert out, 'No matching realtime resources found'
pathlib.Path('realtime-candidates.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print('Public realtime candidates:',len(out))
