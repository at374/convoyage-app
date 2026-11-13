#!/usr/bin/env python3
"""Sonde : métadonnées et premières lignes des jeux SNCF « Tarifs TER » (AURA) et « Tarifs Intercités ».
N'écrit aucun prix dans l'application : produit seulement docs/SONDE-TARIFS-TER.md pour décider de l'intégration."""
import json, urllib.request, urllib.parse
BASE='https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/'
IDS=[]
def get(url):
    req=urllib.request.Request(url,headers={'User-Agent':'convoyage-app diagnostic'})
    with urllib.request.urlopen(req,timeout=60) as r: return r.read()
out=['# Sonde des tarifs SNCF (serveur)\n']
cat=json.loads(get(BASE.rstrip('/')+'?limit=100&where='+urllib.parse.quote('search("tarif")')))
out.append('\n## Catalogue : jeux contenant « tarif »\n')
for d in cat.get('results',[]):
    m=d.get('metas',{}).get('default',{})
    out.append(f"- `{d.get('dataset_id')}` — {m.get('title')} — modifié {m.get('modified')} — {m.get('records_count')} lignes\n")
    if 'ter' in d.get('dataset_id','') or 'TER' in (m.get('title') or ''): IDS.append(d.get('dataset_id'))
for ds in IDS:
    out.append(f'\n## {ds}\n')
    try:
        meta=json.loads(get(BASE+ds))
        m=meta.get('metas',{}).get('default',{})
        out.append(f"- titre : {m.get('title')}\n- modifié : {m.get('modified')}\n- données traitées : {m.get('data_processed')}\n- licence : {m.get('license')}\n- lignes : {m.get('records_count')}\n")
        desc=(m.get('description') or '').replace('\n',' ')[:600]
        out.append(f'- description : {desc}\n')
        out.append('- champs : '+', '.join(f"{f['name']} ({f.get('label')})" for f in meta.get('fields',[]))+'\n')
        recs=json.loads(get(BASE+ds+'/records?limit=5&where='+urllib.parse.quote('search("Annecy") or search("ANNECY")')))
        out.append('```json\n'+json.dumps(recs.get('results',[])[:5],ensure_ascii=False,indent=1)[:4000]+'\n```\n')
    except Exception as e:
        out.append(f'- erreur : {e!r}\n')
open('docs/SONDE-TARIFS-TER.md','w').write(''.join(out)); print(''.join(out)[:3000])
