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
        assert result['excludedForeignStops']==0
        with zipfile.ZipFile(os.path.join(temp,result['file'])) as z:
            stops=list(csv.DictReader(io.StringIO(z.read('stops.txt').decode())))
            times=list(csv.DictReader(io.StringIO(z.read('stop_times.txt').decode())))
            assert {s['stop_id'] for s in stops}=={'a','b'},stops
            assert {t['stop_id'] for t in times}=={'a','b'},times
            assert len(times)==2
        # Verify the generated slice through the same JavaScript journey engine
        # used by mission providers. A valid ZIP alone does not prove the route
        # engine can find the scheduled Annecy -> Lyon itinerary.
        engine_test = r'''
const assert = require('node:assert/strict');
const fs = require('node:fs');
const journeys = require('./transport-national-gtfs-journeys.js');
const archive = process.argv[1];
(async () => {
  const result = await journeys.loadAndSearch({
    operator: 'sncf',
    resource: { url: 'https://example.org/synthetic-aura.zip', format: 'GTFS' },
    fetcher: async () => new Response(fs.readFileSync(archive), {
      headers: { 'content-type': 'application/zip' }
    }),
    date: '2026-12-10',
    from: { lat: 45.901, lon: 6.121 },
    to: { lat: 45.761, lon: 4.861 },
    radiusMeters: 3000,
    earliestDeparture: '07:00:00',
    maxResults: 20
  });
  assert.ok(result.journeys.length > 0, 'the mission engine must return a route');
  const row = result.journeys.find(x => x.tripId === 't');
  assert.ok(row, 'the Annecy -> Lyon GTFS trip must survive slicing');
  assert.equal(row.departure, '08:00:00');
  assert.equal(row.arrival, '10:00:00');
  assert.equal(row.serviceScheduled, true);
  assert.equal(row.serviceConfirmed, false);
  assert.equal(row.priceEUR, null);
  assert.equal(row.priceStatus, 'unavailable');
})().catch(error => { console.error(error); process.exitCode = 1; });
'''
        engine = subprocess.run(['node', '-e', engine_test,
                                 os.path.join(temp,result['file'])],
                                capture_output=True,text=True)
        assert engine.returncode == 0, engine.stderr or engine.stdout
        # Oulx falls inside the broad AURA rectangle but is in Italy. Domestic
        # Trenitalia slices must neither expose it nor shorten a cross-border trip.
        data['stops.txt'] = table(['stop_id','stop_name','stop_lat','stop_lon'],[
            ['a','Annecy','45.901','6.121'],['b','Lyon','45.761','4.861'],['c','Paris','48.8566','2.3522'],
            ['oulx','Oulx Cesana Claviere Sestriere','45.03','6.85']])
        data['trips.txt'] = table(['route_id','service_id','trip_id'],[['r','s','t'],['r','s','foreign']])
        data['stop_times.txt'] = table(['trip_id','arrival_time','departure_time','stop_id','stop_sequence'],[
            ['t','08:00:00','08:00:00','a','1'],['t','10:00:00','10:00:00','b','2'],
            ['t','13:00:00','13:00:00','c','3'],['foreign','08:00:00','08:00:00','b','1'],
            ['foreign','11:00:00','11:00:00','oulx','2'],['foreign','13:00:00','13:00:00','a','3']])
        with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED) as z:
            for name, text in data.items():
                z.writestr(name,text)
        italian_cmd=[sys.executable,os.path.join(os.path.dirname(__file__),'build_national_gtfs_aura.py'),
             '--input',source,'--operator','trenitalia','--out',temp,'--source-url','https://example.org/operator.zip']
        italian=json.loads(subprocess.check_output(italian_cmd,text=True))
        assert italian['excludedForeignStops']==1,italian
        assert italian['excludedOutOfRegionDetourTrips']==1,italian
        with zipfile.ZipFile(os.path.join(temp,italian['file'])) as z:
            stops=list(csv.DictReader(io.StringIO(z.read('stops.txt').decode())))
            assert 'oulx' not in {s['stop_id'] for s in stops},stops
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
        print('Découpage AURA + moteur vérifiés : trajet Annecy -> Lyon retourné, détour hors zone exclu')

if __name__=='__main__':
    main()
