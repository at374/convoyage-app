#!/usr/bin/env python3
"""Offline checks for national GTFS catalogue builder; no external network calls."""
import json
import os
import subprocess
import sys
import tempfile

BUILDER=os.path.join(os.path.dirname(__file__),'build_national_from_catalogue.py')
SOURCE='https://transport.data.gouv.fr/api/datasets'

def run(audit):
    with tempfile.TemporaryDirectory() as folder:
        source=os.path.join(folder,'audit.json')
        with open(source,'w',encoding='utf-8') as f:
            json.dump(audit,f)
        process=subprocess.run([sys.executable,BUILDER,'--audit',source,'--out',folder],
                               capture_output=True,text=True,timeout=15)
        return process

def main():
    empty=run({'source':SOURCE,'operators':{}})
    assert empty.returncode==2,empty.stderr
    result=json.loads(empty.stdout)
    assert set(result['results'])=={'sncf','blablacarBus','flixbus'}
    assert all(x['status']=='unavailable' and x['attempts']==0 for x in result['results'].values())
    malformed=run({'source':SOURCE,'operators':{'sncf':{'feeds':'not-a-list'}}})
    assert malformed.returncode==2,malformed.stderr
    assert json.loads(malformed.stdout)['results']['sncf']['status']=='invalid-audit'
    invalid_feed=run({'source':SOURCE,'operators':{'sncf':{'feeds':[None,{'id':'bad','url':'http://invalid.example/gtfs.zip'}]}}})
    assert invalid_feed.returncode==2,invalid_feed.stderr
    errors=json.loads(invalid_feed.stdout)['results']['sncf']['errors']
    assert len(errors)==2 and all('error' in e for e in errors),errors
    wrong=run({'source':'https://example.org/forged','operators':{}})
    assert wrong.returncode!=0
    assert 'provenance' in wrong.stderr.lower(),wrong.stderr
    print('Catalogue national: absence de flux, audit malformé et provenance invalide détectés')

if __name__=='__main__':
    main()
