#!/usr/bin/env python3
"""Offline regression tests for exact served-stop comparisons."""
import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/compare_isere_gtfs.py'
spec = importlib.util.spec_from_file_location('compare_isere', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def feed(path, stops, used, trip='T', route='R'):
    files = {
        'agency.txt': 'agency_id,agency_name,agency_url,agency_timezone\nA,Cars Région Isère,https://example.org,Europe/Paris\n',
        'stops.txt': 'stop_id,stop_name\n' + ''.join(f'{s},{s}\n' for s in stops),
        'routes.txt': 'route_id,agency_id,route_short_name,route_type\nR,A,1,3\n',
        'trips.txt': f'route_id,service_id,trip_id\n{route},S,{trip}\n',
        'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n' +
            ''.join(f'{trip},08:00:00,08:00:00,{s},{i}\n' for i, s in enumerate(used, 1)),
        'calendar_dates.txt': 'service_id,date,exception_type\nS,20270831,1\n',
    }
    with zipfile.ZipFile(path, 'w') as z:
        for name, content in files.items():
            z.writestr(name, content)


class CompareTests(unittest.TestCase):
    def test_unused_stops_not_served(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'a.zip'
            feed(path, ['A', 'B', 'PARENT'], ['A', 'B'])
            metadata, listed, served, signatures = module.inspect(path)
            self.assertEqual(metadata['stops'], 3)
            self.assertEqual(metadata['served_stops'], 2)
            self.assertEqual(metadata['unserved_stops'], 1)
            self.assertEqual(listed - served, {'PARENT'})

    def test_schedule_signature_stable_across_trip_ids(self):
        with tempfile.TemporaryDirectory() as temp:
            a, b = Path(temp) / 'a.zip', Path(temp) / 'b.zip'
            feed(a, ['A', 'B'], ['A', 'B'], trip='T1')
            feed(b, ['A', 'B'], ['A', 'B'], trip='T2')
            _, _, _, old = module.inspect(a)
            _, _, _, new = module.inspect(b)
            self.assertEqual(old, new)

    def test_schedule_signature_detects_stop_change(self):
        with tempfile.TemporaryDirectory() as temp:
            a, b = Path(temp) / 'a.zip', Path(temp) / 'b.zip'
            feed(a, ['A', 'B', 'C'], ['A', 'B'])
            feed(b, ['A', 'B', 'C'], ['A', 'C'])
            _, _, _, old = module.inspect(a)
            _, _, _, new = module.inspect(b)
            self.assertNotEqual(old, new)

    def test_orphan_trip_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'a.zip'
            feed(path, ['A'], ['A'], trip='UNKNOWN', route='R')
            # Replace trips.txt with a different trip_id.
            with zipfile.ZipFile(path, 'a') as z:
                z.writestr('trips.txt', 'route_id,service_id,trip_id\nR,S,T\n')
            with self.assertRaisesRegex(ValueError, 'Orphan trip_id'):
                module.inspect(path)

    def test_orphan_route_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'a.zip'
            feed(path, ['A'], ['A'], route='MISSING')
            with self.assertRaisesRegex(ValueError, 'Orphan route_id'):
                module.inspect(path)


if __name__ == '__main__':
    unittest.main()
