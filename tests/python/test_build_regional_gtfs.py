"""Tests hors ligne de scripts/build_regional_gtfs.py sur un agrégat Oùra de test."""
import io, json, os, subprocess, sys, tempfile, unittest, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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

if __name__ == '__main__':
    unittest.main()
