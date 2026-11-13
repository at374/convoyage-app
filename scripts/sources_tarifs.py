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
 ('cars-isere-tarifs','https://carsisere.auvergnerhonealpes.fr/en/fares-amp-payments/75/the-rates/14'),
]
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
        index.append(f'| {sid} | {url} | {st} | {hashlib.sha256(data).hexdigest()[:16]} | {len(text)} |\n')
    except Exception as e:
        index.append(f'| {sid} | {url} | erreur {e!r} | | |\n')
open(f'{OUT}/INDEX.md','w').write(''.join(index)); print(''.join(index))
