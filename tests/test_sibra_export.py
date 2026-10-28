"""Regression tests for the date-scoped SIBRA GTFS exporter.

Run: python3 -m unittest discover -s tests -p 'test_sibra_export.py'
"""
import datetime as dt
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

MODULE = Path(__file__).resolve().parents[1] / "scripts" / "export_sibra_day.py"
spec = importlib.util.spec_from_file_location("export_sibra_day", MODULE)
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class SibraExportTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.archive = self.root / "feed.zip"
        self.output = self.root / "sibra-2026-10-28.json"
        with zipfile.ZipFile(self.archive, "w") as z:
            z.writestr("calendar_dates.txt",
                       "service_id,date,exception_type\nS1,20261028,1\nS1,20261029,2\n")
            z.writestr("trips.txt", "route_id,service_id,trip_id\nR1,S1,T1\n")
            z.writestr("stop_times.txt",
                       "trip_id,arrival_time,departure_time,stop_id,stop_sequence\n"
                       "T1,08:00:00,08:00:00,A,1\n"
                       "T1,08:10:00,08:10:00,B,2\n")
            z.writestr("stops.txt",
                       "stop_id,stop_name,stop_lat,stop_lon\n"
                       "A,Alpha,45.9,6.1\nB,Beta,45.8,6.2\n")
            z.writestr("routes.txt", "route_id,route_short_name\nR1,5\n")

    def test_calendar_dates_only_and_unconfirmed_output(self):
        exporter.export(self.archive, dt.date(2026, 10, 28), self.output)
        data = json.loads(self.output.read_text(encoding="utf-8"))
        self.assertEqual(data["date"], "2026-10-28")
        self.assertEqual(len(data["trips"]), 1)
        self.assertEqual(len(data["stop_times"]), 2)
        self.assertIs(data["transportConfirmed"], False)
        self.assertIs(data["realtime"], False)

    def test_no_service_refuses_empty_file(self):
        with self.assertRaises(ValueError):
            exporter.export(self.archive, dt.date(2026, 10, 29), self.output)
        self.assertFalse(self.output.exists())


if __name__ == "__main__":
    unittest.main()
