"""Génère carte-transports.html (carte de France des réseaux) à partir de data/gtfs et du gabarit.
Lancé par .github/workflows/carte-transports.yml à chaque changement des données ou du module Transports.
Usage (depuis la racine du dépôt) : python3 -I tools/carte-transports/generer.py [sortie.html]"""
import json, os, subprocess, sys, datetime, urllib.request
from zoneinfo import ZoneInfo
sortie = sys.argv[1] if len(sys.argv) > 1 else 'carte-transports.html'
tmp = 'carte-scan.tmp.json'
subprocess.run([sys.executable, '-I', 'tools/carte-transports/scan.py', tmp], check=True, stdout=subprocess.DEVNULL)
data = json.load(open(tmp, encoding='utf-8')); os.remove(tmp)
errs_scan = [o for o in data if 'err' in o]
for o in data: o.pop('err', None)
data = [o for o in data if 'lat' in o]
man = json.load(open('data/gtfs/manifest.json', encoding='utf-8'))
ERR = []
for k, v in (man.get('errors') or {}).items(): ERR.append('%s : source en erreur (%s)' % (k, str(v)[:90]))
for o in errs_scan: ERR.append('%s : fichier illisible' % o.get('name', o['file']))
for o in data:
    if o.get('moteur') is False: ERR.append('%s : fichier présent mais pas branché aux moteurs Transports' % o['name'])
# Dernier passage des mises à jour automatiques (API GitHub, jeton du workflow ; sinon « inconnu »)
WORKFLOWS = [('Build regional GTFS (lundi)', 'build-regional-gtfs.yml'), ('GTFS nationaux AURA (mardi)', 'build-national-gtfs-aura.yml'),
             ('SIBRA quotidien (nuit)', 'build-sibra-data.yml'), ('Repli SNCF', 'update-sncf-fallback.yml'), ('Audit Oùra', 'audit-oura-regional-gtfs.yml')]
repo, tok = os.environ.get('GITHUB_REPOSITORY'), os.environ.get('GITHUB_TOKEN')
paris = ZoneInfo('Europe/Paris'); WF = []
for nom, f in WORKFLOWS:
    ligne = [nom, 'inconnu', 'INCONNU']
    try:
        r = urllib.request.Request('https://api.github.com/repos/%s/actions/workflows/%s/runs?per_page=5&status=completed' % (repo, f), headers={'Authorization': 'Bearer ' + tok, 'Accept': 'application/vnd.github+json'})
        runs = json.load(urllib.request.urlopen(r, timeout=20))['workflow_runs']
        runs = [x for x in runs if x['conclusion'] != 'cancelled']
        if runs:
            x = runs[0]; d = datetime.datetime.fromisoformat(x['updated_at'].replace('Z', '+00:00')).astimezone(paris)
            ligne = [nom, d.strftime('%d/%m %H:%M'), 'OK' if x['conclusion'] == 'success' else 'ÉCHEC']
            if x['conclusion'] != 'success': ERR.append('%s : dernier passage en échec (%s)' % (nom, d.strftime('%d/%m %H:%M')))
    except Exception:
        ERR.append('%s : état de la mise à jour non vérifié' % nom)
    WF.append(ligne)
t = open('tools/carte-transports/gabarit.html', encoding='utf-8').read()
maintenant = datetime.datetime.now(paris).strftime('%d/%m/%Y à %H:%M')
t = (t.replace('__DATA__', json.dumps(data, ensure_ascii=False)).replace('__ERR__', json.dumps(ERR, ensure_ascii=False))
      .replace('__WF__', json.dumps(WF, ensure_ascii=False)).replace('__DATE__', maintenant))
open(sortie, 'w', encoding='utf-8').write(t)
print('carte écrite :', sortie, len(data), 'réseaux,', len(ERR), 'alertes')
