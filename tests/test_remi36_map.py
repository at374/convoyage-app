"""Contrôles sans réseau : Rémi 36 commercial et représentation cartographique."""
import csv
import io
import json
import pathlib
import unittest
import zipfile


ROOT = pathlib.Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'data/gtfs/remi36-tours-line800-gtfs-rt.zip'


class Remi36MapTests(unittest.TestCase):
    def test_line_800_has_complete_official_timetable(self):
        with zipfile.ZipFile(ARCHIVE) as archive:
            rows = lambda name: list(csv.DictReader(io.TextIOWrapper(archive.open(name), encoding='utf-8-sig')))
            routes = rows('routes.txt')
            self.assertEqual([r['route_id'] for r in routes], ['REMI36:Line:800'])
            self.assertEqual(routes[0]['route_short_name'], '800')
            self.assertGreater(len(rows('trips.txt')), 0)
            self.assertGreater(len(rows('stops.txt')), 2)
            self.assertGreaterEqual(max(r['end_date'] for r in rows('calendar.txt')), '20270101')
            self.assertNotIn('fare_attributes.txt', archive.namelist())

    def test_manifest_and_mission_hub_reference_same_archive(self):
        manifest = json.loads((ROOT / 'data/gtfs/manifest.json').read_text())
        entry = manifest['networks']['remi36-tours-line800-gtfs-rt']
        self.assertEqual(entry['file'], ARCHIVE.name)
        self.assertFalse(entry['fares'])
        hub = (ROOT / 'transport-mission-hub.js').read_text()
        self.assertIn("'remi36_tours_800','Rémi 36 · ligne 800','" + ARCHIVE.name, hub)
        self.assertIn("'remi36_tours_800',['Rémi 36 · ligne 800',REMI_REALTIME_URL]", hub)
        self.assertNotIn("'REMI36:Line:U'", (ROOT / 'scripts/build_regional_gtfs.py').read_text())

    def test_map_shows_regional_routes_and_unknown_workflows(self):
        page = (ROOT / 'carte-transports.html').read_text()
        self.assertIn('Rémi 36 · ligne 800', page)
        self.assertIn('Tours - Loches - Châteauroux', page)
        self.assertIn('Bourges – Issoudun - Châteauroux', page)
        self.assertIn('Luçay-le-Mâle – Ecueillé - Châteauroux', page)
        self.assertIn('INCONNU', page)
        self.assertIn("'car' if b.startswith('cars-region-') or b.startswith('remi')", (ROOT / 'tools/carte-transports/scan.py').read_text())


if __name__ == '__main__':
    unittest.main()
