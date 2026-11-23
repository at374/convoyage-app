#!/usr/bin/env python3
"""Small real-date GTFS regression fixtures, no network needed."""
import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/compare_isere_service_dates.py'
spec = importlib.util.spec_from_file_location('service_dates', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def make(path, service='S', trip='T', stop='A', exception=''):
    tables = {
        'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n' +
                        f'{service},1,1,1,1,1,0,0,20261123,20261124\n',
        'calendar_dates.txt': 'service_id,date,exception_type\n' + exception,
        'trips.txt': f'route_id,service_id,trip_id\nR,{service},{trip}\n',
        'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n' +
                          f'{trip},08:00:00,08:00:00,{stop},1\n',
    }
    with zipfile.ZipFile(path, 'w') as z:
        for name, data in tables.items():
            z.writestr(name, data)


class ServiceDateTests(unittest.TestCase):
    def test_renamed_service_and_trip_are_equivalent(self):
        with tempfile.TemporaryDirectory() as temp:
            a, b = Path(temp) / 'a.zip', Path(temp) / 'b.zip'
            make(a)
            make(b, service='OTHER', trip='OTHER')
            result = module.compare(a, b)
            self.assertTrue(result['calendar_equivalent'])
            self.assertEqual(result['different_dates'], 0)

    def test_removed_date_detected(self):
        with tempfile.TemporaryDirectory() as temp:
            a, b = Path(temp) / 'a.zip', Path(temp) / 'b.zip'
            make(a)
            make(b, exception='S,20261124,2\n')
            result = module.compare(a, b)
            self.assertFalse(result['calendar_equivalent'])
            self.assertEqual(result['different_dates'], 1)
            self.assertEqual(result['removed_or_changed_trip_days'], 1)

    def test_changed_stop_detected(self):
        with tempfile.TemporaryDirectory() as temp:
            a, b = Path(temp) / 'a.zip', Path(temp) / 'b.zip'
            make(a)
            make(b, stop='B')
            result = module.compare(a, b)
            self.assertEqual(result['different_dates'], 2)


if __name__ == '__main__':
    unittest.main()
