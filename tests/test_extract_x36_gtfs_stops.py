import importlib.util
import io
import hashlib
import json
import unittest
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "extract_x36_gtfs_stops.py"
spec = importlib.util.spec_from_file_location("extract_x36", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ExtractX36Tests(unittest.TestCase):
    def test_only_stops_served_by_x36_trips_are_candidates(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / "feed.zip"
            files = {
                "routes.txt": "route_id,route_short_name\nr1,X36\nr2,X37\n",
                "trips.txt": "route_id,trip_id\nr1,t1\nr2,t2\n",
                "stop_times.txt": "trip_id,stop_id,stop_sequence\nt1,a,1\nt1,b,2\nt2,c,1\n",
                "stops.txt": "stop_id,stop_name,stop_lat,stop_lon\na,First,46.1,5.8\nb,Second,46.2,5.9\nc,Other,46.3,6.0\n",
            }
            with zipfile.ZipFile(path, "w") as archive:
                for name, data in files.items():
                    archive.writestr(name, data)
            result = module.extract(path, "https://example.org/official-gtfs-fixture.zip", "2026-11-10")
            self.assertEqual(result["sourceSha256"], hashlib.sha256(path.read_bytes()).hexdigest())
            self.assertEqual(result["stopPatterns"], [{"stopIds": ["a", "b"], "tripCount": 1}])
            self.assertEqual(result["routeCount"], 1)
            self.assertEqual(result["tripCount"], 1)
            self.assertEqual({s["id"] for s in result["stops"]}, {"a", "b"})
            self.assertFalse(result["stopMappingVerified"])
            self.assertFalse(result["journeyFareVerified"])
            self.assertTrue(result["candidatesOnly"])

    def test_feed_without_x36_is_rejected(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / "feed.zip"
            files = {
                "routes.txt": "route_id,route_short_name\nr2,X37\n",
                "trips.txt": "route_id,trip_id\nr2,t2\n",
                "stop_times.txt": "trip_id,stop_id,stop_sequence\nt2,c,1\n",
                "stops.txt": "stop_id,stop_name,stop_lat,stop_lon\nc,Other,46.3,6.0\n",
            }
            with zipfile.ZipFile(path, "w") as archive:
                for name, data in files.items():
                    archive.writestr(name, data)
            with self.assertRaisesRegex(ValueError, "X36 route not found"):
                module.extract(path, "https://example.org/official-gtfs-fixture.zip", "2026-11-10")

    def test_x36_trips_without_stop_times_are_rejected(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / "feed.zip"
            files = {
                "routes.txt": "route_id,route_short_name\nr1,X36\n",
                "trips.txt": "route_id,trip_id\nr1,t1\n",
                "stop_times.txt": "trip_id,stop_id,stop_sequence\n",
                "stops.txt": "stop_id,stop_name,stop_lat,stop_lon\na,First,46.1,5.8\n",
            }
            with zipfile.ZipFile(path, "w") as archive:
                for name, data in files.items():
                    archive.writestr(name, data)
            with self.assertRaisesRegex(ValueError, "No X36 stop_times"):
                module.extract(path, "https://example.org/feed.zip", "2026-11-10")

    def test_invalid_source_rejected(self):
        with self.assertRaises(ValueError):
            module.extract("unused.zip", "http://example.org/feed.zip", "2026-11-10")


if __name__ == "__main__":
    unittest.main()
