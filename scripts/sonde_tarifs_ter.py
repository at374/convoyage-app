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
# 14/11/2026 : le jeu officiel « Tarifs TER Auvergne-Rhône-Alpes » (prix par origine-destination, tarif normal 2nde)
# n'apparaît pas dans la recherche plein texte : on l'interroge directement, ainsi que sa fiche data.gouv.fr.
for direct in ['tarifs-ter-aura','tarifs-ter-par-od']:
    if direct not in IDS: IDS.append(direct)
try:
    cat2=json.loads(get(BASE.rstrip('/')+'?limit=100&where='+urllib.parse.quote('search("TER")')))
    out.append('\n## Catalogue : jeux contenant « TER »\n')
    for d in cat2.get('results',[]):
        m=d.get('metas',{}).get('default',{})
        out.append(f"- `{d.get('dataset_id')}` — {m.get('title')} — modifié {m.get('modified')} — {m.get('records_count')} lignes\n")
except Exception as e:
    out.append(f'\n## Catalogue TER — erreur : {e!r}\n')
def get_slow(url):
    last=None
    for _ in range(3):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (convoyage-app diagnostic)'})
            with urllib.request.urlopen(req,timeout=120) as r: return r.read()
        except Exception as e: last=e
    raise last
try:
    dg=json.loads(get_slow('https://www.data.gouv.fr/api/1/datasets/6778b24e2e9a63f76e133b55/'))
    for r in dg.get('resources',[]):
        try:
            body=get_slow(r.get('url'))
            out.append(f"- contenu {r.get('title')} : {len(body)} octets\n```\n"+body[:1500].decode('utf-8','replace')+"\n```\n")
            lines=[l for l in body.decode('utf-8','replace').splitlines() if 'Annecy' in l and ('Chamb' in l or 'Rumilly' in l or 'Lyon Part' in l)]
            out.append('```\n'+'\n'.join(lines[:12])+'\n```\n')
        except Exception as e:
            out.append(f"- contenu {r.get('title')} : erreur {e!r}\n")
    out.append('\n## data.gouv.fr — '+str(dg.get('title'))+'\n- modifié : '+str(dg.get('last_modified'))+'\n- source : '+str((dg.get('harvest') or {}).get('remote_url'))+'\n')
    for r in dg.get('resources',[]): out.append(f"- ressource {r.get('format')} — {r.get('title')} — {r.get('url')} — modifiée {r.get('last_modified')}\n")
except Exception as e:
    out.append(f'\n## data.gouv.fr — erreur : {e!r}\n')
# 14/11/2026 (soir) : recherche de TOUTE donnée tarifaire officielle publiée (obligation réglementaire NeTEx Tarifs /
# GTFS-Fares sur le point d'accès national) pour SNCF, FlixBus, BlaBlaCar Bus et les réseaux AURA.
try:
    import io, zipfile, re as _re
    out.append('\n## Point d\'accès national : jeux ou ressources mentionnant des tarifs\n')
    pan=json.loads(get_slow('https://transport.data.gouv.fr/api/datasets'))
    hits=0
    for d in pan:
        blob=(str(d.get('title'))+' '+str(d.get('slug'))+' '+' '.join(str(r.get('title'))+' '+str(r.get('format'))+' '+str(r.get('url')) for r in d.get('resources',[]))).lower()
        if _re.search(r'tarif|fare|prix|netex.*tarif',blob):
            hits+=1
            out.append(f"- **{d.get('title')}** — https://transport.data.gouv.fr/datasets/{d.get('slug')}\n")
            for r in d.get('resources',[]):
                rb=(str(r.get('title'))+' '+str(r.get('url'))).lower()
                if _re.search(r'tarif|fare|prix',rb): out.append(f"  - {r.get('format')} — {r.get('title')} — {r.get('url')}\n")
    out.append(f'- total : {hits} jeux sur {len(pan)}\n')
except Exception as e:
    out.append(f'\n## Point d\'accès national — erreur : {e!r}\n')
for label,url in [('SNCF NeTEx','https://eu.ftp.opendatasoft.com/sncf/plandata/export-opendata-sncf-netex.zip'),
                  ('SNCF GTFS','https://eu.ftp.opendatasoft.com/sncf/plandata/Export_OpenData_SNCF_GTFS_NewTripId.zip')]:
    try:
        body=get_slow(url)
        z=zipfile.ZipFile(io.BytesIO(body))
        names=z.namelist()
        out.append(f"\n## {label} — {len(body)} octets, {len(names)} fichiers\n- fichiers : {', '.join(names[:25])}\n")
        for n in names:
            if n.lower().endswith(('.xml','.txt')) and z.getinfo(n).file_size<400*1024*1024:
                data=z.read(n)
                counts={k:data.count(k.encode()) for k in ['FareFrame','FareTable','FareProduct','PriceGroup','fare_attributes','<Amount>','Tarif']}
                if any(counts.values()) or 'fare' in n.lower(): out.append(f"- `{n}` ({len(data)} octets) : {counts}\n")
    except Exception as e:
        out.append(f"\n## {label} — erreur : {e!r}\n")
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
        att=meta.get('attachments') or []
        out.append('- pièces jointes : '+json.dumps(att,ensure_ascii=False)[:800]+'\n')
        out.append('```json\n'+json.dumps(recs.get('results',[])[:5],ensure_ascii=False,indent=1)[:4000]+'\n```\n')
    except Exception as e:
        out.append(f'- erreur : {e!r}\n')
open('docs/SONDE-TARIFS-TER.md','w').write(''.join(out)); print(''.join(out)[:3000])
