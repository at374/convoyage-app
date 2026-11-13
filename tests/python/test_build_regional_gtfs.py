"""Tests hors ligne de scripts/build_regional_gtfs.py sur un agrégat Oùra de test."""
import importlib.util, io, json, os, subprocess, sys, tempfile, unittest, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def load_module():
    spec = importlib.util.spec_from_file_location('build_regional_gtfs', os.path.join(ROOT, 'scripts', 'build_regional_gtfs.py'))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m

def tcl_like_feed():
    """Flux mono-agence avec des arrêts dans et hors de la bbox de test (lat 45.70-45.80, lon 4.80-4.90) :
    T1 entièrement dans la zone (gardé), T2 part de la zone mais sort (un seul arrêt dans la zone : écarté),
    T3 entièrement hors zone (écarté)."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        z.writestr('agency.txt', 'agency_id,agency_name,agency_timezone\nTC,TCL,Europe/Paris\n')
        z.writestr('routes.txt', 'route_id,agency_id,route_short_name,route_type\nR1,TC,C1,3\nR2,TC,C2,3\nR3,TC,C3,3\n')
        z.writestr('trips.txt', 'route_id,service_id,trip_id\nR1,S,T1\nR2,S,T2\nR3,S,T3\n')
        z.writestr('stop_times.txt',
                    'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n'
                    'T1,08:00:00,08:00:00,PARTDIEU,1\nT1,08:10:00,08:10:00,PERRACHE,2\n'
                    'T2,09:00:00,09:00:00,PARTDIEU,1\nT2,09:30:00,09:30:00,DEHORS,2\n'
                    'T3,10:00:00,10:00:00,DEHORS,1\nT3,10:20:00,10:20:00,DEHORS2,2\n')
        z.writestr('stops.txt',
                    'stop_id,stop_name,stop_lat,stop_lon\n'
                    'PARTDIEU,Part-Dieu,45.760,4.859\nPERRACHE,Perrache,45.749,4.826\n'
                    'DEHORS,Hors zone,46.200,5.200\nDEHORS2,Hors zone 2,46.300,5.300\n')
        z.writestr('calendar_dates.txt', 'service_id,date,exception_type\nS,20261116,1\n')
        z.writestr('fare_attributes.txt', 'fare_id,price,currency_type,payment_method,transfers,agency_id\nFC1,1.90,EUR,0,,TC\nFC3,1.90,EUR,0,,TC\n')
        z.writestr('fare_rules.txt', 'fare_id,route_id\nFC1,R1\nFC3,R3\n')
    return buf.getvalue()

def aggregate(path):
    files = {
        'agency.txt': "agency_id,agency_name,agency_timezone\nJY,RUMILLY - J'ybus,Europe/Paris\nTA,AMBERIEU-EN-BUGEY - Tam,Europe/Paris\nHS,Cars Région Haute-Savoie,Europe/Paris\nSV,Cars Région Savoie,Europe/Paris\nIS,Cars Région Isère,Europe/Paris\nTC,TCL,Europe/Paris\n",
        'routes.txt': 'route_id,agency_id,route_short_name,route_type\nR1,JY,1,3\nR2,TA,A,3\nR3,HS,Y51,3\nR4,SV,S1,3\nR5,IS,T60,3\nR6,TC,C1,3\n',
        'trips.txt': 'route_id,service_id,trip_id\nR1,S,T1\nR2,S,T2\nR3,S,T3\nR4,S,T4\nR5,S,T5\nR6,S,T6\n',
        'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n' + ''.join(f'T{i},08:00:00,08:00:00,A{i},1\nT{i},08:20:00,08:20:00,B{i},2\n' for i in range(1, 7)),
        'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon,zone_id\n' + ''.join(f'A{i},Arret A{i},45.8{i},5.9{i},Z1\nB{i},Arret B{i},45.9{i},6.0{i},Z2\n' for i in range(1, 7)),
        'calendar_dates.txt': 'service_id,date,exception_type\nS,20261116,1\n',
        'fare_attributes.txt': 'fare_id,price,currency_type,payment_method,transfers,agency_id\nFJ,1.50,EUR,0,,JY\nFT,1.20,EUR,0,,TA\n',
        'fare_rules.txt': 'fare_id,route_id\nFJ,R1\nFT,R2\n',
    }
    with zipfile.ZipFile(path, 'w') as z:
        for k, v in files.items():
            z.writestr(k, v)

class T(unittest.TestCase):
    def test_extract(self):
        with tempfile.TemporaryDirectory() as d:
            agg = os.path.join(d, 'oura.zip'); aggregate(agg); out = os.path.join(d, 'gtfs')
            r = subprocess.run([sys.executable, '-I', os.path.join(ROOT, 'scripts', 'build_regional_gtfs.py'), '--aggregate', agg, '--out', out, '--offline'], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            m = json.load(open(os.path.join(out, 'manifest.json'), encoding='utf-8'))
            self.assertEqual(sorted(m['networks']), ['cars-region-isere', 'cars-region-savoie', 'jybus-rumilly', 'tam-amberieu'])
            self.assertEqual(m['networks']['cars-region-savoie']['agencies'], ['Cars Région Savoie'], 'Haute-Savoie exclue')
            with zipfile.ZipFile(os.path.join(out, 'jybus-rumilly.zip')) as z:
                trips = z.read('trips.txt').decode()
                self.assertIn('T1', trips); self.assertNotIn('T6', trips, 'TCL non recopié')
                fares = z.read('fare_attributes.txt').decode()
                self.assertIn('FJ,1.50,EUR', fares); self.assertNotIn('FT', fares, 'tarif TAM non recopié dans J’y bus')
            self.assertTrue(m['networks']['jybus-rumilly']['fares'])
            ag = json.load(open(os.path.join(out, 'oura-agencies.json'), encoding='utf-8'))
            self.assertEqual(len(ag), 6)

class TFilterByBounds(unittest.TestCase):
    def test_keeps_only_trips_with_two_stops_in_zone(self):
        m = load_module()
        spec = {'bounds': [45.70, 4.80, 45.80, 4.90]}
        with zipfile.ZipFile(io.BytesIO(tcl_like_feed())) as z:
            data, info = m.filter_by_bounds(z, spec)
        self.assertIsNotNone(data, info)
        self.assertEqual(info['trips'], 1, 'seul T1 a ses deux arrêts dans la bbox')
        with zipfile.ZipFile(io.BytesIO(data)) as out:
            trips = out.read('trips.txt').decode()
            self.assertIn('T1', trips)
            self.assertNotIn('T2', trips, 'T2 sort de la zone : écarté, pas tronqué silencieusement')
            self.assertNotIn('T3', trips, 'T3 entièrement hors zone')
            stops = out.read('stops.txt').decode()
            self.assertIn('PARTDIEU', stops); self.assertIn('PERRACHE', stops)
            self.assertNotIn('DEHORS', stops)
            fares = out.read('fare_attributes.txt').decode()
            self.assertIn('FC1', fares, 'tarif de la ligne gardée conservé')
            self.assertNotIn('FC3', fares, 'tarif de la ligne écartée (T3) non recopié')

    def test_no_stop_in_zone_is_reported_not_silently_empty(self):
        m = load_module()
        spec = {'bounds': [0, 0, 1, 1]}
        with zipfile.ZipFile(io.BytesIO(tcl_like_feed())) as z:
            data, info = m.filter_by_bounds(z, spec)
        self.assertIsNone(data)
        self.assertIn('aucun arrêt', info)

    def test_oversized_filtered_output_is_rejected(self):
        m = load_module()
        old_max = m.MAX_OUT
        m.MAX_OUT = 10  # force le dépassement pour vérifier que la limite de taille est bien appliquée
        try:
            spec = {'bounds': [45.70, 4.80, 45.80, 4.90]}
            with zipfile.ZipFile(io.BytesIO(tcl_like_feed())) as z:
                data, info = m.filter_by_bounds(z, spec)
            self.assertIsNone(data)
            self.assertIn('trop volumineux', info)
        finally:
            m.MAX_OUT = old_max

if __name__ == '__main__':
    unittest.main()
