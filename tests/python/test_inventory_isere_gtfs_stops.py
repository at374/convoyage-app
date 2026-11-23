#!/usr/bin/env python3
"""Offline checks: inventory must never fabricate Isere tariff zones."""
import importlib.util
import io
import tempfile
import unittest
import zipfile
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/inventory-isere-gtfs-stops.py'
spec = importlib.util.spec_from_file_location('isere_inventory', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def make_zip(path, stops, times):
    with zipfile.ZipFile(path, 'w') as z:
        z.writestr('stops.txt', stops)
        z.writestr('stop_times.txt', times)


class InventoryTests(unittest.TestCase):
    def test_exact_stop_ids_and_no_zone_inference(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'gtfs.zip'
            make_zip(path,
                     'stop_id,stop_name,stop_lat,stop_lon\nA,Station,45,5\nB,Terminal,46,6\n',
                     'trip_id,stop_id,stop_sequence\nT1,A,1\nT1,B,2\nT2,A,1\n')
            rows, summary = module.build(path)
            self.assertEqual([r['stop_id'] for r in rows], ['A', 'B'])
            self.assertEqual([r['stop_times_count'] for r in rows], [2, 1])
            self.assertEqual(summary['zone_assignments_created'], 0)
            self.assertEqual(summary['orphan_stop_ids'], [])
            self.assertFalse(any('zone' in row for row in rows))

    def test_orphan_is_reported_not_silently_discarded(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'gtfs.zip'
            make_zip(path,
                     'stop_id,stop_name\nA,Station\n',
                     'trip_id,stop_id\nT1,A\nT1,MISSING\n')
            rows, summary = module.build(path)
            self.assertEqual(summary['orphan_stop_ids'], ['MISSING'])
            self.assertFalse(rows[1]['present_in_stops_txt'])

    def test_duplicate_stop_ids_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'gtfs.zip'
            make_zip(path,
                     'stop_id,stop_name\nA,One\nA,Two\n',
                     'trip_id,stop_id\nT1,A\n')
            with self.assertRaisesRegex(ValueError, 'duplicate'):
                module.build(path)


if __name__ == '__main__':
    unittest.main()
