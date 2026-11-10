import importlib.util
import json
import unittest
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "inventory_oura_gtfs.py"
spec = importlib.util.spec_from_file_location("inventory_oura_gtfs", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class OuraInventoryTests(unittest.TestCase):
    def make_zip(self, folder, routes="route_id,agency_id\nr1,a1\nr2,a2\n"):
        path = Path(folder) / "feed.zip"
        files = {
            "agency.txt": "agency_id,agency_name\na1,Network A\na2,Network B\n",
            "routes.txt": routes,
            "trips.txt": "route_id,service_id,trip_id\nr1,s1,t1\n",
            "stops.txt": "stop_id,stop_name\ns1,Stop One\n",
            "stop_times.txt": "trip_id,stop_id,stop_sequence\nt1,s1,1\n",
            "stop_times.txt": "trip_id,stop_id,stop_sequence\nt1,s1,1\n",
            "calendar.txt": "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\ns1,1,1,1,1,1,0,0,20261110,20261220\n",
            "calendar_dates.txt": "service_id,date,exception_type\nx,20261110,1\n",
        }
        with zipfile.ZipFile(path, "w") as archive:
            for name, data in files.items():
                archive.writestr(name, data)
        return path

    def test_network_counts_are_candidates_only(self):
        with TemporaryDirectory() as folder:
            result = module.inventory(self.make_zip(folder), "https://example.org/oura.zip")
            self.assertEqual(result["routeCount"], 2)
            self.assertEqual(result["stopCount"], 1)
            self.assertEqual(result["tripCount"], 1)
            self.assertEqual(result["routesWithoutTrips"], 1)
            self.assertEqual(result["tripsWithoutStopTimes"], 0)
            self.assertEqual(result["stopsWithoutGps"], 1)
            self.assertEqual(result["tripsUsingStopsWithoutGps"], 1)
            self.assertEqual(result["stopTimesWithoutArrivalOrDeparture"], 1)
            self.assertEqual(result["stopTimesWithoutSequence"], 0)
            self.assertEqual([a["tripCount"] for a in result["agencies"]], [1, 0])
            self.assertEqual([r["id"] for r in result["routes"]], ["r1", "r2"])
            self.assertEqual([r["tripCount"] for r in result["routes"]], [1, 0])
            self.assertEqual([a["routeCount"] for a in result["agencies"]], [1, 1])
            self.assertTrue(result["archiveOnly"])
            self.assertFalse(result["fareVerified"])
            self.assertFalse(result["serviceConfirmed"])
            self.assertTrue(result["hasCalendarExceptions"])
            self.assertEqual(result["calendarServiceSpans"], [{"start": "2026-11-10", "end": "2026-12-20"}])
            self.assertEqual(result["calendarDateExceptions"], {"added": 1, "removed": 0})
            self.assertEqual(result["invalidCalendarRows"], 0)
            self.assertEqual(result["invalidCalendarExceptionRows"], 0)
            self.assertEqual(result["tripsWithUnknownServiceId"], 0)
            self.assertFalse(result["hasFareFiles"])
            self.assertEqual(len(result["sourceSha256"]), 64)

    def test_unknown_agency_rejected(self):
        with TemporaryDirectory() as folder:
            path = self.make_zip(folder, "route_id,agency_id\nr1,missing\n")
            with self.assertRaisesRegex(ValueError, "unknown agency_id"):
                module.inventory(path, "https://example.org/oura.zip")

    def test_single_agency_without_route_agency_id_is_valid(self):
        with TemporaryDirectory() as folder:
            path = self.make_zip(folder, "route_id\nr1\n")
            # Create a fresh one-agency feed, as GTFS allows agency_id omission.
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("agency.txt", "agency_name\nNetwork A\n")
                archive.writestr("routes.txt", "route_id\nr1\n")
                archive.writestr("trips.txt", "route_id,trip_id\nr1,t1\n")
                archive.writestr("stops.txt", "stop_id,stop_name\ns1,Stop One\n")
                archive.writestr("stop_times.txt", "trip_id,stop_id,stop_sequence\nt1,s1,1\n")
            result = module.inventory(path, "https://example.org/oura.zip")
            self.assertEqual(result["agencies"][0]["routeCount"], 1)

    def test_multi_agency_without_route_owner_rejected(self):
        with TemporaryDirectory() as folder:
            path = self.make_zip(folder, "route_id\nr1\n")
            with self.assertRaisesRegex(ValueError, "missing agency_id"):
                module.inventory(path, "https://example.org/oura.zip")

    def test_orphan_stop_time_rejected(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / "orphan.zip"
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("agency.txt", "agency_id,agency_name\na1,Network A\n")
                archive.writestr("routes.txt", "route_id,agency_id\nr1,a1\n")
                archive.writestr("trips.txt", "route_id,trip_id\nr1,t1\n")
                archive.writestr("stops.txt", "stop_id,stop_name\ns1,Stop One\n")
                archive.writestr("stop_times.txt", "trip_id,stop_id,stop_sequence\nmissing,s1,1\n")
            with self.assertRaisesRegex(ValueError, "unknown trip_id"):
                module.inventory(path, "https://example.org/oura.zip")

    def test_unknown_stop_reference_rejected(self):
        with TemporaryDirectory() as folder:
            path = self.make_zip(folder)
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("agency.txt", "agency_id,agency_name\na1,Network A\n")
                archive.writestr("routes.txt", "route_id,agency_id\nr1,a1\n")
                archive.writestr("trips.txt", "route_id,trip_id\nr1,t1\n")
                archive.writestr("stops.txt", "stop_id,stop_name\ns1,Stop One\n")
                archive.writestr("stop_times.txt", "trip_id,stop_id,stop_sequence\nt1,missing,1\n")
            with self.assertRaisesRegex(ValueError, "unknown stop_id"):
                module.inventory(path, "https://example.org/oura.zip")

    def test_valid_gps_and_invalid_stop_sequence_are_reported(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / "geo.zip"
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("agency.txt", "agency_id,agency_name\na1,Network A\n")
                archive.writestr("routes.txt", "route_id,agency_id\nr1,a1\n")
                archive.writestr("trips.txt", "route_id,trip_id\nr1,t1\n")
                archive.writestr("stops.txt", "stop_id,stop_name,stop_lat,stop_lon\ns1,Annecy,45.899,6.129\n")
                archive.writestr("stop_times.txt", "trip_id,stop_id,stop_sequence\nt1,s1,invalid\n")
            result = module.inventory(path, "https://example.org/oura.zip")
            self.assertEqual(result["stopsWithoutGps"], 0)
            self.assertEqual(result["tripsUsingStopsWithoutGps"], 0)
            self.assertEqual(result["stopTimesWithoutArrivalOrDeparture"], 1)
            self.assertEqual(result["stopTimesWithoutSequence"], 1)
            self.assertFalse(result["serviceConfirmed"])

    def test_non_https_source_rejected(self):
        with self.assertRaises(ValueError):
            module.inventory("unused.zip", "http://example.org/oura.zip")


if __name__ == "__main__":
    unittest.main()
