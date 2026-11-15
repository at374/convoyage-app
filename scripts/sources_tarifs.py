#!/usr/bin/env python3
"""Télécharge les documents tarifaires OFFICIELS listés ci-dessous et en extrait le texte brut dans
docs/sources-tarifs/ (un fichier .txt par source + INDEX.md avec statut HTTP, date et empreinte SHA-256).
Aucun prix n'est intégré à l'application ici : les grilles sont relues puis codées à la main avec leur source."""
import urllib.error, hashlib, html, io, json, os, re, subprocess, sys, tempfile, urllib.request, datetime
SOURCES=[
 ('tpg-272-alpbus','https://www.tpg.ch/sites/default/files/2025-12/LIT_272_Grille_tarifaire_20251214_20261212.pdf'),
 ('jacquet-transfrontaliers','https://jacquet-autocars.com/wp-content/uploads/2025/11/Grille-tarifaire-TRANSFRONTALIERS-2025-2026.pdf'),
 ('tcl-guide-mai-2026','https://www.tcl.fr/sites/default/files/2026-05/TCL_Campagne_Unification_Guide_Tarifaire_Mai2026_W.pdf'),
 ('tcl-1-voyage','https://www.tcl.fr/titres-tarifs/tarifs/1-voyage'),
 ('ter-leman-pass','https://www.ter.sncf.com/auvergne-rhone-alpes/tarifs-cartes/tarifs-leman-express'),
 ('tpg-occasionnels','https://www.tpg.ch/fr/acheter/nos-titres/voyageurs-occasionnels'),
 ('tpg-occasional-en','https://www.tpg.ch/en/purchase/our-tickets/occasional-travelers'),
 ('synchro-gamme-xlsx','https://www.data.gouv.fr/api/1/datasets/r/ad492f65-7f55-4f16-8288-1c1f7ad25183'),
 ('tac-titres','https://tac-mobilites.fr/taxonomy/term/75'),
 ('tpg-prix-en','https://www.tpg.ch/en/purchase/our-tickets/ticket-prices'),
 ('tpg-prix-fr','https://www.tpg.ch/fr/acheter/nos-titres/prix-des-titres'),
 ('tac-tarifs','https://tac-mobilites.fr/tarifs'),
 ('tac-accueil','https://tac-mobilites.fr/'),
 ('synchro-gamme-xlsx-2','https://www.data.gouv.fr/fr/datasets/r/ad492f65-7f55-4f16-8288-1c1f7ad25183'),
 ('start-accueil','https://www.star-t.fr/'),
 ('start-tarifs','https://www.star-t.fr/tarifs/'),
 ('unireso-tarifs','https://www.unireso.com/tarifs/'),
 ('tac-guide-mars-2026','https://files.tac-mobilites.fr/s3fs-public/documents/Guide%20des%20tarifs%20MARS%202026%20VF%20%28DIGITAL%29.pdf?VersionId=McKSvZWPOy..TYAJBCybXvxs5qGmyzqj'),
 ('tac-guide-page','https://www.tac-mobilites.fr/nos-tarifs/guide-des-tarifs'),
 ('synchro-tarifs','https://synchro.grandchambery.fr/tarifs-et-abonnements-bus/'),
 ('synchro-delib-2025','https://www.grandchambery.fr/fileadmin/mediatheque/Oxyad/DelmDec/indexdelm_20250410/Acte16655.pdf'),
 ('jacquet-fr-fr','https://jacquet-autocars.com/wp-content/uploads/2025/11/Grille-tarifaire-FR-FR-2025-2026.pdf'),
 ('jybus-accueil','https://www.jybus.fr/'),
 ('jybus-tarifs','https://www.jybus.fr/tarifs/'),
 ('tam-ville','https://www.ville-amberieuenbugey.fr/-Reseau-TAM'),
 ('cars-isere-tarifs','https://carsisere.auvergnerhonealpes.fr/en/fares-amp-payments/75/the-rates/14'),
 ('cars-isere-depliant-2025','https://carsisere.auvergnerhonealpes.fr/ftp/document/de-pliant-tarifaire-2025.pdf'),
 ('cars-isere-carte-zonale-2025','https://carsisere.auvergnerhonealpes.fr/ftp/document/carte-zonale-2025.pdf'),
 ('plaine-ain-livret-mobilite','https://www.cc-plainedelain.fr/UserFiles/File/mobilite/livret-mobilite.pdf'),
 ('tam-boamp-2026','https://www.boamp.fr/telechargements/FILES/PDF/2025/01/25-9840.pdf'),
 # 14/11/2026 (soir) — recherche de tous les prix : barème officiel TER, ancien fichier de prix TER archivé,
 # Léman Pass, Star't, Ondéa.
 ('ter-aura-cgv-2026','https://mmt.vsct.fr/sites/default/files/swt/CARA/2026-09/V202603_CGV_Transporteur_TER_AURA.pdf'),
 ('ter-aura-od-archive-csv','https://web.archive.org/web/2025id_/https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/tarifs-ter-aura/exports/csv'),
 ('ter-aura-od-archive-csv2','https://web.archive.org/web/2025id_/https://ressources.data.sncf.com/explore/dataset/tarifs-ter-aura/download/?format=csv'),
 ('ter-aura-od-archive-cdx','https://web.archive.org/cdx/search/cdx?url=ressources.data.sncf.com/*tarifs-ter-aura*&output=txt&limit=60&filter=statuscode:200'),
 ('ter-aura-od-datagouv-cdx','https://web.archive.org/cdx/search/cdx?url=data.gouv.fr/*6778b24e2e9a63f76e133b55*&output=txt&limit=40&filter=statuscode:200'),
 ('lemanpass-faq','https://www.lemanpass.com/faq/'),
 ('lemanpass-tarifs','https://www.lemanpass.com/tarifs/'),
 ('lemanpass-accueil','https://www.lemanpass.com/'),
 ('start-titres','https://www.star-t.fr/titres-abonnements/titres-abonnements'),
 ('start-ligne-142','https://www.star-t.fr/se-deplacer/lignes-et-horaires/ligne-bus-142'),
 ('start-ligne-l','https://www.star-t.fr/se-deplacer/lignes-et-horaires/ligne-bus-l'),
 ('ondea-titres-2026','https://www.ondeagrandlac.fr/titres/titres-pour-tous-tarifs-applicables-du-1er-juillet-2026/titre-10-voyages'),
 ('ondea-titres-index','https://www.ondeagrandlac.fr/titres/titres-pour-tous-tarifs-applicables-du-1er-juillet-2026'),
 ('lemanpass-points-de-vente','https://www.lemanpass.com/points-de-vente/'),
 ('tac-leman-pass','https://www.tac-mobilites.fr/titres/titres-et-cartes-journalieres-leman-pass'),
 ('tpg-billets','https://www.tpg.ch/fr/acheter/nos-titres-de-transport/les-billets-et-cartes-journalieres'),
 ('sncf-opendata-tarifs','https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets?where=search(%22tarifs%22)&limit=100&select=dataset_id,metas'),
 ('datagouv-tarifs-ter','https://www.data.gouv.fr/api/1/datasets/?q=tarifs%20TER&organization=534fffb0a3a7292c64a78115&page_size=50'),
]
# Grilles en matrice (prix dans un tableau graphique que pdftotext ne restitue pas) : pages rendues en image pour relecture.
IMAGES={'tpg-272-alpbus','jacquet-transfrontaliers','jacquet-fr-fr','cars-isere-carte-zonale-2025','cars-isere-depliant-2025'}
OUT='docs/sources-tarifs'; os.makedirs(OUT,exist_ok=True)
def fetch(url,tries=3):
    import time
    for i in range(tries):
        try: return _fetch(url)
        except urllib.error.HTTPError as e:
            if e.code<500 or i==tries-1: raise
        except Exception:
            if i==tries-1: raise
        time.sleep(5)
def _fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (convoyage-app; verification tarifs)','Accept-Language':'fr'})
    with urllib.request.urlopen(req,timeout=90) as r: return r.status,r.headers.get('Content-Type',''),r.read()
def to_text(ctype,data):
    if data[:4]==b'%PDF':
        with tempfile.NamedTemporaryFile(suffix='.pdf') as f:
            f.write(data); f.flush()
            return subprocess.run(['pdftotext','-layout',f.name,'-'],capture_output=True,text=True,check=True).stdout
    if data[:2]==b'PK':
        import openpyxl
        wb=openpyxl.load_workbook(io.BytesIO(data),data_only=True); lines=[]
        for ws in wb.worksheets:
            lines.append(f'## feuille {ws.title}')
            for row in ws.iter_rows(values_only=True):
                if any(c is not None for c in row): lines.append(' | '.join('' if c is None else str(c) for c in row))
        return '\n'.join(lines)
    t=data.decode('utf-8','replace')
    t=re.sub(r'(?is)<(script|style|noscript)[^>]*>.*?</\1>',' ',t)
    t=re.sub(r'(?i)<br\s*/?>|</(p|div|li|tr|h\d|td|th)>','\n',t)
    t=html.unescape(re.sub(r'<[^>]+>',' ',t))
    return '\n'.join(l.strip() for l in t.splitlines() if l.strip())
index=['# Sources tarifaires officielles (texte brut extrait par le serveur)\n',f'Extraction : {datetime.datetime.utcnow():%Y-%m-%d %H:%M} UTC\n\n','| Source | URL | Statut | SHA-256 | Taille texte |\n|---|---|---|---|---|\n']
for sid,url in SOURCES:
    try:
        st,ct,data=fetch(url); text=to_text(ct,data)
        open(f'{OUT}/{sid}.txt','w').write(f'Source : {url}\n\n'+text)
        if sid in IMAGES and data[:4]==b'%PDF':
            os.makedirs(f'{OUT}/img',exist_ok=True)
            with tempfile.NamedTemporaryFile(suffix='.pdf') as f:
                f.write(data); f.flush()
                subprocess.run(['pdftoppm','-r','130','-png','-l','4',f.name,f'{OUT}/img/{sid}'],check=False)
        index.append(f'| {sid} | {url} | {st} | {hashlib.sha256(data).hexdigest()[:16]} | {len(text)} |\n')
    except Exception as e:
        index.append(f'| {sid} | {url} | erreur {e!r} | | |\n')
# Arrêts réels des cars transfrontaliers 271/272/274 (flux officiel Oùra Haute-Savoie) avec leur commune officielle
# (géocodage inverse de la Base Adresse Nationale) : nécessaire pour appliquer la grille 272, qui est par commune.
try:
    import csv, zipfile
    _,_,data=fetch('https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=HAUTE_SAVOIE&dataFormat=GTFS&dataProfil=OPENDATA')
    z=zipfile.ZipFile(io.BytesIO(data))
    rd=lambda n:list(csv.DictReader(io.TextIOWrapper(z.open(n),encoding='utf-8-sig'))) if n in z.namelist() else []
    routes={r['route_id']:r for r in rd('routes.txt') if (r.get('route_short_name') or '').strip() in ('271','272','274')}
    trips={t['trip_id']:t['route_id'] for t in rd('trips.txt') if t['route_id'] in routes}
    stops={x['stop_id']:x for x in rd('stops.txt')}
    used={}
    for st in rd('stop_times.txt'):
        rid=trips.get(st['trip_id'])
        if rid: used.setdefault((routes[rid]['route_short_name'].strip(),st['stop_id']),0); used[(routes[rid]['route_short_name'].strip(),st['stop_id'])]+=1
    # Inventaire de toutes les lignes du flux officiel Cars Région Haute-Savoie (comparaison avec le site de la Région).
    allroutes=rd('routes.txt'); bytrip={}
    for t in rd('trips.txt'): bytrip[t['route_id']]=bytrip.get(t['route_id'],0)+1
    open(f'{OUT}/cars74-lignes.txt','w').write('\n'.join(['ligne | nom | courses']+sorted(f"{(r.get('route_short_name') or '').strip()} | {r.get('route_long_name','')} | {bytrip.get(r['route_id'],0)}" for r in allroutes)))
    lines=['Fichiers du flux : '+', '.join(z.namelist()),'ligne | stop_id | nom | lat | lon | zone_id | commune BAN | code INSEE | passages']
    cache={}
    for (line,sid),n in sorted(used.items()):
        x=stops.get(sid,{}); lat,lon=x.get('stop_lat',''),x.get('stop_lon','')
        key=(lat,lon)
        if key not in cache:
            try:
                _,_,g=fetch(f'https://api-adresse.data.gouv.fr/reverse/?lon={lon}&lat={lat}&limit=1')
                f=(json.loads(g).get('features') or [{}])[0].get('properties',{})
                cache[key]=(f.get('city','')+((' ('+f.get('oldcity')+')') if f.get('oldcity') else ''),f.get('citycode',''))
            except Exception as e: cache[key]=('erreur '+repr(e)[:60],'')
        lines.append(' | '.join([line,sid,x.get('stop_name',''),lat,lon,x.get('zone_id',''),cache[key][0],cache[key][1],str(n)]))
    open(f'{OUT}/cars74-271-272-274-arrets.txt','w').write('\n'.join(lines))
    index.append(f'| cars74-271-272-274-arrets | flux Oùra Haute-Savoie + BAN | 200 | | {len(lines)} lignes |\n')
except Exception as e:
    index.append(f'| cars74-271-272-274-arrets | flux Oùra Haute-Savoie + BAN | erreur {e!r} | | |\n')
# Arrêts du réseau Star't (Thonon Agglomération) avec leur commune officielle (BAN) : la tarification Star't est par
# commune (zone A / zone B, star-t.fr). Inventaire des réseaux de l'agrégat régional Oùra (comparaison de couverture).
def commune(lat,lon,cache={}):
    key=(lat,lon)
    if key not in cache:
        try:
            _,_,g=fetch(f'https://api-adresse.data.gouv.fr/reverse/?lon={lon}&lat={lat}&limit=1')
            f=(json.loads(g).get('features') or [{}])[0].get('properties',{})
            cache[key]=(f.get('city',''),f.get('citycode',''))
        except Exception as e: cache[key]=('erreur '+repr(e)[:60],'')
    return cache[key]
try:
    import csv, zipfile
    _,_,data=fetch('https://www.data.gouv.fr/api/1/datasets/r/7cbb883b-d0cb-4bc7-b2e0-7537afdbc86e')
    z=zipfile.ZipFile(io.BytesIO(data))
    rd=lambda n:list(csv.DictReader(io.TextIOWrapper(z.open(n),encoding='utf-8-sig'))) if n in z.namelist() else []
    routes={r['route_id']:(r.get('route_short_name') or '').strip() for r in rd('routes.txt')}
    trips={t['trip_id']:routes.get(t['route_id'],'') for t in rd('trips.txt')}
    used={}
    for st in rd('stop_times.txt'): used.setdefault(st['stop_id'],set()).add(trips.get(st['trip_id'],''))
    lines=['Fichiers : '+', '.join(z.namelist()),'stop_id | nom | lat | lon | zone_id | commune BAN | code INSEE | lignes']
    for x in rd('stops.txt'):
        if x['stop_id'] not in used: continue
        c=commune(x.get('stop_lat',''),x.get('stop_lon',''))
        lines.append(' | '.join([x['stop_id'],x.get('stop_name',''),x.get('stop_lat',''),x.get('stop_lon',''),x.get('zone_id',''),c[0],c[1],' '.join(sorted(used[x['stop_id']]))]))
    open(f'{OUT}/start-arrets.txt','w').write('\n'.join(lines))
    index.append(f'| start-arrets | flux Star\'t + BAN | 200 | | {len(lines)} lignes |\n')
except Exception as e:
    index.append(f'| start-arrets | flux Star\'t + BAN | erreur {e!r} | | |\n')
try:
    _,_,data=fetch('https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=OURA&dataFormat=GTFS&dataProfil=OPENDATA')
    z=zipfile.ZipFile(io.BytesIO(data))
    rd=lambda n:list(csv.DictReader(io.TextIOWrapper(z.open(n),encoding='utf-8-sig'))) if n in z.namelist() else []
    n={}
    for r in rd('routes.txt'): n[r.get('agency_id','')]=n.get(r.get('agency_id',''),0)+1
    lines=[f'Agrégat Oùra : {len(data)} octets ; fichiers : '+', '.join(z.namelist()),'agency_id | nom | url | lignes']
    lines+=sorted(' | '.join([a.get('agency_id',''),a.get('agency_name',''),a.get('agency_url',''),str(n.get(a.get('agency_id',''),0))]) for a in rd('agency.txt'))
    # Flux individuel de chaque réseau (même API officielle, provider = préfixe de l'agency_id) : statut, taille, emprise.
    lines+=['','provider | HTTP | octets | lignes | courses | arrêts | emprise lat/lon min-max | fichiers fares']
    for prov in sorted({a.get('agency_id','').split(':')[0].replace('x','_') for a in rd('agency.txt')}):
        try:
            st,_,d=fetch(f'https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider={prov}&dataFormat=GTFS&dataProfil=OPENDATA')
            zz=zipfile.ZipFile(io.BytesIO(d))
            r2=lambda n:list(csv.DictReader(io.TextIOWrapper(zz.open(n),encoding='utf-8-sig'))) if n in zz.namelist() else []
            ss=[(float(x['stop_lat']),float(x['stop_lon'])) for x in r2('stops.txt') if x.get('stop_lat') and x.get('stop_lon')]
            box=f"{min(a for a,_ in ss):.3f},{min(b for _,b in ss):.3f},{max(a for a,_ in ss):.3f},{max(b for _,b in ss):.3f}" if ss else ''
            days=sorted([x['date'] for x in r2('calendar_dates.txt') if x.get('exception_type')=='1']+[x[k] for x in r2('calendar.txt') for k in ('start_date','end_date')])
            lines.append(' | '.join([prov,str(st),str(len(d)),str(len(r2('routes.txt'))),str(len(r2('trips.txt'))),str(len(ss)),box,' '.join(n for n in zz.namelist() if 'fare' in n),'calendrier '+(days[0]+'→'+days[-1]+f' ({len(days)})' if days else 'vide')]))
        except Exception as e: lines.append(f'{prov} | erreur {repr(e)[:80]}')
    open(f'{OUT}/oura-agregat-reseaux.txt','w').write('\n'.join(lines))
    index.append(f'| oura-agregat-reseaux | agrégat Oùra (PAN) | 200 | | {len(lines)} lignes |\n')
except Exception as e:
    index.append(f'| oura-agregat-reseaux | agrégat Oùra (PAN) | erreur {e!r} | | |\n')
# Inventaire exhaustif des jeux de transport public du Point d'accès national couvrant Auvergne-Rhône-Alpes
# (pour repérer les réseaux absents de l'agrégat Oùra : T2C, STAS, Citéa, Libellule, etc.).
try:
    _,_,raw=fetch('https://transport.data.gouv.fr/api/datasets')
    ds=json.loads(raw)
    pat=re.compile(r'Auvergne|Rh[oô]ne|\bAin\b|Allier|Ard[eè]che|Cantal|Dr[oô]me|Is[eè]re|Loire|Puy-de-D|Savoie|Lyon|Grenoble|Clermont|[EÉ]tienne|Valence|Annecy|Chamb[eé]ry|"(?:01|03|07|15|26|38|42|43|63|69|73|74)\d{3}"',re.I)
    lines=[f'{len(ds)} jeux au total ; clés : '+', '.join(sorted(ds[0].keys()))]
    for d in ds:
        if d.get('type')!='public-transit': continue
        area=json.dumps(d.get('covered_area'),ensure_ascii=False)
        if not pat.search(area+' '+str(d.get('title',''))): continue
        res=[r for r in d.get('resources',[]) if str(r.get('format','')).upper()=='GTFS']
        lines.append(' | '.join([str(d.get('title','')),str(d.get('slug','')),area[:160],str(d.get('licence','')),' ; '.join(str(r.get('original_url') or r.get('url'))+' (fin '+str((r.get('metadata') or {}).get('end_date'))+')' for r in res[:3])]))
    open(f'{OUT}/pan-aura-jeux.txt','w').write('\n'.join(lines))
    index.append(f'| pan-aura-jeux | transport.data.gouv.fr/api/datasets | 200 | | {len(lines)} lignes |\n')
except Exception as e:
    index.append(f'| pan-aura-jeux | transport.data.gouv.fr/api/datasets | erreur {e!r} | | |\n')
open(f'{OUT}/INDEX.md','w').write(''.join(index)); print(''.join(index))
