#!/usr/bin/env python3
"""End-to-end offline test: official-shaped GTFS ZIP -> AURA slice -> validated ZIP."""
import csv
import io
import json
import os
import subprocess
import sys
import tempfile
import zipfile

def table(headers, rows):
    s = io.StringIO()
    writer = csv.writer(s)
    writer.writerow(headers)
    writer.writerows(rows)
    return s.getvalue()

def main():
    with tempfile.TemporaryDirectory() as temp:
        source = os.path.join(temp, 'operator.zip')
        data = {
            'agency.txt': table(['agency_id','agency_name','agency_url','agency_timezone'],[['1','Synthetic rail','https://example.org','Europe/Paris']]),
            'stops.txt': table(['stop_id','stop_name','stop_lat','stop_lon'],[
                ['a','Annecy','45.901','6.121'],['b','Lyon','45.761','4.861'],['c','Paris','48.8566','2.3522']]),
            'routes.txt': table(['route_id','agency_id','route_short_name','route_type'],[['r','1','TER','2']]),
            'trips.txt': table(['route_id','service_id','trip_id'],[['r','s','t']]),
            'stop_times.txt': table(['trip_id','arrival_time','departure_time','stop_id','stop_sequence'],[
                ['t','08:00:00','08:00:00','a','1'],['t','10:00:00','10:00:00','b','2'],
                ['t','13:00:00','13:00:00','c','3']]),
            'calendar.txt': table(['service_id','monday','tuesday','wednesday','thursday','friday','saturday','sunday','start_date','end_date'],[
                ['s','1','1','1','1','1','1','1','20260101','20261231']])
        }
        with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED) as z:
            for name, text in data.items():
                z.writestr(name,text)
        cmd=[sys.executable,os.path.join(os.path.dirname(__file__),'build_national_gtfs_aura.py'),
             '--input',source,'--operator','sncf','--out',temp,'--source-url','https://example.org/operator.zip']
        result=json.loads(subprocess.check_output(cmd,text=True))
        assert result['operator']=='sncf'
        assert result['excludedOutOfRegionDetourTrips']==0
        with zipfile.ZipFile(os.path.join(temp,result['file'])) as z:
            stops=list(csv.DictReader(io.StringIO(z.read('stops.txt').decode())))
            times=list(csv.DictReader(io.StringIO(z.read('stop_times.txt').decode())))
            assert {s['stop_id'] for s in stops}=={'a','b'},stops
            assert {t['stop_id'] for t in times}=={'a','b'},times
            assert len(times)==2
        # A second trip leaves AURA between Annecy and Lyon. It must not be
        # shortened to a fake direct Annecy–Lyon service.
        data['trips.txt'] = table(['route_id','service_id','trip_id'],[
            ['r','s','t'],['r','s','detour']])
        data['stop_times.txt'] = table(['trip_id','arrival_time','departure_time','stop_id','stop_sequence'],[
            ['t','08:00:00','08:00:00','a','1'],['t','10:00:00','10:00:00','b','2'],
            ['t','13:00:00','13:00:00','c','3'],
            ['detour','08:00:00','08:00:00','a','1'],
            ['detour','09:00:00','09:00:00','c','2'],
            ['detour','11:00:00','11:00:00','b','3']])
        with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED) as z:
            for name, text in data.items():
                z.writestr(name,text)
        result=json.loads(subprocess.check_output(cmd,text=True))
        assert result['excludedOutOfRegionDetourTrips']==1,result
        with zipfile.ZipFile(os.path.join(temp,result['file'])) as z:
            trips=list(csv.DictReader(io.StringIO(z.read('trips.txt').decode())))
            assert [t['trip_id'] for t in trips]==['t'],trips
        with zipfile.ZipFile(source,'a',zipfile.ZIP_DEFLATED) as z:
            z.writestr('../unsafe.txt','should not be processed')
        rejected=subprocess.run(cmd,capture_output=True,text=True)
        assert rejected.returncode!=0 and 'Unsafe GTFS archive' in rejected.stderr,rejected.stderr
        print('Découpage national AURA vérifié : arrêt hors zone et faux trajet direct exclus')

if __name__=='__main__':
    main()
