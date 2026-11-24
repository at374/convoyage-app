"""Tests hors ligne de scripts/build_regional_gtfs.py sur un agrégat Oùra de test."""
import importlib.util, io, json, os, re, subprocess, sys, tempfile, unittest, zipfile
from unittest import mock
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

class TDerivedStopBounds(unittest.TestCase):
    def test_bounds_are_calculated_from_valid_gtfs_stop_coordinates(self):
        m = load_module()
        with zipfile.ZipFile(io.BytesIO(tcl_like_feed())) as z:
            self.assertEqual(m.stop_bounds(z), [45.749, 4.826, 46.3, 5.3])

class TNestedPackage(unittest.TestCase):
    def test_required_gtfs_tables_under_one_directory_are_read_and_validated(self):
        m = load_module()
        source = zipfile.ZipFile(io.BytesIO(tcl_like_feed()))
        packed = io.BytesIO()
        with source, zipfile.ZipFile(packed, 'w', zipfile.ZIP_DEFLATED) as z:
            for name in source.namelist():
                z.writestr('feed/' + name, source.read(name))
        with zipfile.ZipFile(io.BytesIO(packed.getvalue())) as z:
            trips, times = m.validate(z)
            self.assertEqual(trips, 3)
            self.assertEqual(times, 6)
            fields, agencies = m.read_table(z, 'agency.txt')
            self.assertIn('agency_name', fields)
            self.assertEqual(len(agencies), 1)

class TDatasetResourceSelection(unittest.TestCase):
    def test_gtfs_selection_requires_public_https_and_accepts_query(self):
        m = load_module()
        fallback = 'https://example.test/fallback.zip'
        metadata = {'resources': [
            {'format': 'GTFS', 'url': 'http://example.test/new.zip', 'last_modified': '2026-11-24'},
            {'format': 'GTFS', 'url': 'https://user:secret@example.test/new.zip', 'last_modified': '2026-11-24'},
            {'format': '', 'title': 'GTFS export', 'url': 'https://example.test/feed.zip?download=1', 'last_modified': '2026-11-23'}
        ]}
        self.assertEqual(m.select_dataset_gtfs_url(metadata, fallback),
                         'https://example.test/feed.zip?download=1')

    def test_latest_gtfs_wins_over_newer_netex_zip(self):
        m = load_module()
        fallback = 'https://example.test/gtfs-fallback.zip'
        metadata = {'resources': [
            {'format': 'GTFS', 'title': 'Horaires Grand Reims (GTFS)',
             'url': 'https://example.test/grand-reims-gtfs.zip', 'last_modified': '2026-11-20'},
            {'format': 'zip', 'title': 'Horaires Grand Reims (NeTEx)',
             'url': 'https://example.test/grand-reims-netex.zip', 'last_modified': '2026-11-21'},
        ]}
        self.assertEqual(m.select_dataset_gtfs_url(metadata, fallback),
                         'https://example.test/grand-reims-gtfs.zip')

    def test_unidentified_zip_uses_explicit_gtfs_fallback(self):
        m = load_module()
        fallback = 'https://example.test/gtfs-fallback.zip'
        metadata = {'resources': [{'format': 'zip', 'title': 'Other export',
                                   'url': 'https://example.test/other.zip'}]}
        self.assertEqual(m.select_dataset_gtfs_url(metadata, fallback), fallback)

    def test_resource_keywords_select_the_gtfs_variant_with_tad_and_school_services(self):
        m = load_module()
        fallback = 'https://example.test/full-tad-feed.zip'
        metadata = {'resources': [
            {'format': 'GTFS', 'title': 'GTFS - Réseau urbain',
             'url': 'https://example.test/urban.zip', 'last_modified': '2026-11-20'},
            {'format': 'GTFS', 'title': 'GTFS - Horaires + TAD + Scolaire + Shapes',
             'url': 'https://example.test/full-tad-feed.zip', 'last_modified': '2026-11-19'},
        ]}
        self.assertEqual(m.select_dataset_gtfs_url(metadata, fallback, ['tad', 'scolaire', 'shapes']),
                         'https://example.test/full-tad-feed.zip')


class TRouteExclusions(unittest.TestCase):
    def test_extract_removes_cross_border_route_and_its_trips(self):
        m = load_module()
        source = io.BytesIO()
        with zipfile.ZipFile(source, 'w') as z:
            z.writestr('agency.txt', 'agency_id,agency_name,agency_timezone\nFB,Forbus,Europe/Paris\n')
            z.writestr('routes.txt', 'route_id,agency_id,route_short_name,route_long_name,route_type\n'
                       'R-FR,FB,1,Forbach - Centre,3\nR-DE,FB,H,Ligne H Forbach - Schoeneck,3\n')
            z.writestr('trips.txt', 'route_id,service_id,trip_id\nR-FR,S,T-FR\nR-DE,S,T-DE\n')
            z.writestr('stop_times.txt', 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n'
                       'T-FR,08:00:00,08:00:00,FR1,1\nT-FR,08:10:00,08:10:00,FR2,2\n'
                       'T-DE,09:00:00,09:00:00,FR1,1\nT-DE,09:20:00,09:20:00,DE1,2\n')
            z.writestr('stops.txt', 'stop_id,stop_name,stop_lat,stop_lon\n'
                       'FR1,Forbach,49.19,6.90\nFR2,Stiring-Wendel,49.20,6.93\nDE1,Schoeneck,49.18,6.92\n')
            z.writestr('calendar_dates.txt', 'service_id,date,exception_type\nS,20261124,1\n')
        with zipfile.ZipFile(io.BytesIO(source.getvalue())) as z:
            data, info = m.extract(z, {'pattern': 'forbus', 'exclude_route_patterns': ['schoeneck']})
        self.assertIsNotNone(data, info)
        self.assertEqual(info['routes'], 1)
        self.assertEqual(info['trips'], 1)
        with zipfile.ZipFile(io.BytesIO(data)) as out:
            self.assertIn('R-FR', out.read('routes.txt').decode())
            self.assertNotIn('R-DE', out.read('routes.txt').decode())
            self.assertIn('T-FR', out.read('trips.txt').decode())
            self.assertNotIn('T-DE', out.read('trips.txt').decode())
            self.assertNotIn('DE1', out.read('stops.txt').decode())

    def test_extract_removes_non_requested_route_types_and_dependent_rows(self):
        m = load_module()
        source = io.BytesIO()
        with zipfile.ZipFile(source, 'w') as z:
            z.writestr('agency.txt', 'agency_id,agency_name,agency_timezone\nS,SITAC,Europe/Paris\n')
            z.writestr('routes.txt', 'route_id,agency_id,route_short_name,route_long_name,route_type\n'
                       'BUS,S,1,Calais - Centre,3\nBOAT,S,F1,Calais - Dover,4\n')
            z.writestr('trips.txt', 'route_id,service_id,trip_id\nBUS,S,T-BUS\nBOAT,S,T-BOAT\n')
            z.writestr('stop_times.txt', 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n'
                       'T-BUS,08:00:00,08:00:00,FR1,1\nT-BUS,08:10:00,08:10:00,FR2,2\n'
                       'T-BOAT,09:00:00,09:00:00,FR1,1\nT-BOAT,09:30:00,09:30:00,UK1,2\n')
            z.writestr('stops.txt', 'stop_id,stop_name,stop_lat,stop_lon\n'
                       'FR1,Calais,50.95,1.85\nFR2,Coquelles,50.94,1.80\nUK1,Dover,51.13,1.31\n')
            z.writestr('calendar_dates.txt', 'service_id,date,exception_type\nS,20261124,1\n')
        with zipfile.ZipFile(io.BytesIO(source.getvalue())) as z:
            data, info = m.extract(z, {'pattern': 'sitac', 'exclude_route_types': ['4']})
        self.assertIsNotNone(data, info)
        self.assertEqual(info['routes'], 1)
        self.assertEqual(info['trips'], 1)
        with zipfile.ZipFile(io.BytesIO(data)) as out:
            self.assertIn('BUS', out.read('routes.txt').decode())
            self.assertNotIn('BOAT', out.read('routes.txt').decode())
            self.assertNotIn('T-BOAT', out.read('trips.txt').decode())
            self.assertNotIn('UK1', out.read('stops.txt').decode())


class TDownloadCleanup(unittest.TestCase):
    def test_temporary_archive_is_removed_after_size_limit_failure(self):
        m = load_module()
        with tempfile.TemporaryDirectory() as directory:
            real_temp = tempfile.NamedTemporaryFile
            factory = lambda delete, suffix: real_temp(delete=delete, suffix=suffix, dir=directory)
            with mock.patch.object(m.urllib.request, 'urlopen', return_value=io.BytesIO(b'123456')):
                with mock.patch.object(m.tempfile, 'NamedTemporaryFile', side_effect=factory):
                    with self.assertRaises(SystemExit):
                        m.download('https://example.test/feed.zip', limit=4)
            self.assertEqual(os.listdir(directory), [])

    def test_temporary_archive_is_removed_after_interrupted_stream(self):
        m = load_module()
        class BrokenStream:
            def __init__(self): self.calls = 0
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def read(self, _size):
                self.calls += 1
                if self.calls == 1: return b'partial'
                raise OSError('connection interrupted')
        with tempfile.TemporaryDirectory() as directory:
            real_temp = tempfile.NamedTemporaryFile
            factory = lambda delete, suffix: real_temp(delete=delete, suffix=suffix, dir=directory)
            with mock.patch.object(m.urllib.request, 'urlopen', return_value=BrokenStream()):
                with mock.patch.object(m.tempfile, 'NamedTemporaryFile', side_effect=factory):
                    with self.assertRaisesRegex(OSError, 'interrupted'):
                        m.download('https://example.test/feed.zip')
            self.assertEqual(os.listdir(directory), [])


class TMirrorConfig(unittest.TestCase):
    """Vérifie la forme des entrées MIRROR/FILTERED_MIRROR (pas de téléchargement réel) : URL https,
    bbox cohérente (min < max), identifiant unique — pour détecter une erreur de configuration avant le
    passage CI réel qui, lui, télécharge et valide les flux (seul juge de leur contenu)."""
    def _check(self, entries):
        seen = set()
        for spec in entries:
            self.assertNotIn(spec['id'], seen, 'identifiant dupliqué : ' + spec['id'])
            seen.add(spec['id'])
            self.assertTrue(spec.get('url', '').startswith('https://'), spec['id'] + ' : URL non https')
            bounds = spec.get('bounds')
            if bounds is None:
                self.assertTrue(spec.get('derive_bounds'), spec['id'] + ' : emprise non fournie ni calculée')
                continue
            self.assertEqual(len(bounds), 4, spec['id'] + ' : bbox incomplète')
            lat_min, lon_min, lat_max, lon_max = bounds
            self.assertLess(lat_min, lat_max, spec['id'] + ' : latitudes inversées')
            self.assertLess(lon_min, lon_max, spec['id'] + ' : longitudes inversées')

    def test_mirror_entries_well_formed(self):
        m = load_module()
        self._check(m.MIRROR)
        solea = next(s for s in m.MIRROR if s['id'] == 'solea-mulhouse')
        self.assertIn('/resources/80787/download', solea['url'])
        self.assertEqual(solea['license'], 'Licence Ouverte 2.0')
        self.assertIn('solea-mulhouse', {s['id'] for s in m.MIRROR})
        reims = next(s for s in m.MIRROR if s['id'] == 'grand-reims')
        self.assertEqual(reims['dataset'], 'offre-de-transport-du-reseau-grand-reims-mobilites-communaute-urbaine-du-grand-reims')
        self.assertEqual(reims['license'], 'Licence Ouverte 2.0')
        forbus = next(s for s in m.MIRROR if s['id'] == 'forbus-forbach')
        self.assertEqual(forbus['dataset'], 'fr-200052264-t0007-0000-1')
        hdf = {s['id']: s for s in m.MIRROR if s['id'] in {
            'ilevia-lille', 'transvilles-valenciennes', 'tadao-lens', 'dkbus-dunkerque',
            'ametis-amiens', 'eveole-douai', 'marineo-boulogne', 'artis-arras', 'sitac-calais'}}
        self.assertEqual(len(hdf), 9)
        self.assertEqual(hdf['ilevia-lille']['dataset'], 'ilevia-localisation-des-arrets-bus-metro-et-tram-gtfs')
        self.assertEqual(hdf['sitac-calais']['exclude_route_types'], ['4'])
        self.assertEqual(hdf['sitac-calais']['agency_pattern'], 'zenbus')
        self.assertTrue(hdf['tadao-lens']['agency_pattern'])
        self.assertEqual(hdf['ametis-amiens']['dataset'], 'ametis')
        self.assertEqual(hdf['ametis-amiens']['resource_keywords'], ['tad', 'scolaire', 'shapes'])
        self.assertEqual(hdf['tadao-lens']['license'], 'ODbL')
        self.assertEqual(hdf['dkbus-dunkerque']['license'], 'ODbL')
        self.assertEqual(hdf['eveole-douai']['license'], 'ODbL')
        self.assertEqual(forbus['exclude_route_patterns'], ['schoeneck'])
        self.assertEqual(forbus['license'], 'Licence Ouverte 2.0')
        temob = next(s for s in m.MIRROR if s['id'] == 'temob-thionville')
        self.assertEqual(temob['dataset'], 'offre-de-transport-du-reseau-temob-syndicat-mixte-des-transports-urbains-thionville-fensch')
        self.assertEqual(temob['exclude_route_patterns'], ['redange'])
        self.assertEqual(temob['license'], 'Licence Ouverte 2.0')
        stan = next(s for s in m.MIRROR if s['id'] == 'stan-nancy')
        self.assertEqual(stan['dataset'], 'fr-200052264-t0034-0000-1')
        self.assertIn('/resources/83710/download', stan['url'])
        self.assertEqual(stan['bounds'], [48.60, 6.09, 48.74, 6.29])
        self.assertEqual(stan['license'], 'Licence Ouverte 2.0')
        regional = {s['id']: s for s in m.MIRROR}
        expected = {
            'sub-nancy': 'fr-200052264-t0039-0000-1',
            'trace-colmar': 'fr-200052264-t0004-0000-1',
            'imagine-epinal': 'fr-200052264-t0009-0000-1',
            'ticea-saint-dizier': 'fr-200052264-t0010-0000-1',
            'transavold-saint-avold': 'fr-200052264-t0015-0000-1',
            'cmonbus-chaumont': 'offre-de-transport-du-reseau-cmonbus-communaute-dagglomeration-de-chaumont',
            'tub-bar-le-duc': 'fr-200052264-t0003-0000-1',
            'rezo-verdun': 'fr-200052264-t0011-0000-1',
            'tcat-troyes': 'donnees-tcat-troyes-champagne-metropole-1',
        }
        expected_license = {'tcat-troyes': 'ODbL'}
        for network_id, dataset in expected.items():
            with self.subTest(network_id=network_id):
                self.assertEqual(regional[network_id]['dataset'], dataset)
                self.assertTrue(regional[network_id]['derive_bounds'])
                self.assertEqual(regional[network_id]['license'], expected_license.get(network_id, 'Licence Ouverte 2.0'))

    def test_filtered_mirror_entries_well_formed(self):
        m = load_module()
        self._check(m.FILTERED_MIRROR)
        ids = {s['id'] for s in m.FILTERED_MIRROR}
        self.assertIn('fluo-grand-est', ids)
        self.assertIn('citea-valence', ids)
        self.assertIn('stas-saint-etienne', ids)
        self.assertIn('t2c-clermont', ids)

    def test_bundled_agency_feeds_are_unique_and_licensed(self):
        m = load_module()
        self.assertEqual(len(m.BUNDLED_AGENCY_FEEDS), 2)
        bundle = m.BUNDLED_AGENCY_FEEDS[0]
        self.assertEqual(bundle['license'], 'Licence Ouverte 2.0')
        self.assertLessEqual(bundle['download_limit'], 80 * 1024 * 1024)
        self.assertEqual(bundle['exclude_route_types'], ['4'])
        ids = [agency['id'] for agency in bundle['networks']]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(len(ids), 28)
        self.assertTrue(all(agency.get('agency_name') and agency.get('network') for agency in bundle['networks']))
        jvmalin = m.BUNDLED_AGENCY_FEEDS[1]
        self.assertEqual(jvmalin['license'], 'ODbL 1.0 + conditions particulières PAN')
        self.assertIn('/resources/83521/download', jvmalin['url'])
        self.assertEqual(len(jvmalin['networks']), 19)
        self.assertEqual(len({agency['id'] for agency in jvmalin['networks']}), 19)
        self.assertLessEqual(jvmalin['download_limit'], 60 * 1024 * 1024)
        self.assertEqual(len({agency['id'] for b in m.BUNDLED_AGENCY_FEEDS for agency in b['networks']}), 47)
        for agency in jvmalin['networks']:
            with self.subTest(network=agency['id']):
                re.compile(agency['agency_pattern'])
                self.assertRegex(agency['id'], r'^jvmalin-')

    def test_bundle_extraction_excludes_ferries(self):
        m = load_module()
        archive = io.BytesIO()
        with zipfile.ZipFile(archive, 'w') as z:
            z.writestr('agency.txt', 'agency_id,agency_name,agency_timezone\nA,Astuce (Métropole Rouen Normandie),Europe/Paris\nB,Autre,Europe/Paris\n')
            z.writestr('routes.txt', 'route_id,agency_id,route_short_name,route_type\nBUS,A,1,3\nBOAT,A,F,4\nOTHER,B,2,3\n')
            z.writestr('trips.txt', 'route_id,service_id,trip_id\nBUS,S,TB\nBOAT,S,TF\nOTHER,S,TO\n')
            z.writestr('stop_times.txt', 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nTB,08:00:00,08:00:00,S1,1\nTB,08:10:00,08:10:00,S2,2\nTF,09:00:00,09:00:00,S1,1\nTF,09:10:00,09:10:00,S2,2\nTO,10:00:00,10:00:00,S1,1\nTO,10:10:00,10:10:00,S2,2\n')
            z.writestr('stops.txt', 'stop_id,stop_name,stop_lat,stop_lon\nS1,Rouen,49.44,1.09\nS2,Rouen 2,49.45,1.10\n')
            z.writestr('calendar_dates.txt', 'service_id,date,exception_type\nS,20261124,1\n')
        with zipfile.ZipFile(archive) as source:
            data, info = m.extract(source, {'pattern': 'astuce \\(metropole rouen normandie\\)', 'exclude_route_types': ['4']})
        self.assertIsNotNone(data, info)
        with zipfile.ZipFile(io.BytesIO(data)) as result:
            self.assertEqual(m.validate(result)[0], 1)
            self.assertEqual(m.stop_bounds(result), [49.44, 1.09, 49.45, 1.1])
            self.assertNotIn('BOAT', result.read('routes.txt').decode())



class TPACAConfig(unittest.TestCase):
    def test_zou_proximity_source_is_dynamic_open_and_excludes_cross_border_labels(self):
        m = load_module()
        source = next(item for item in m.MIRROR if item['id'] == 'zou-proximite-paca')
        self.assertEqual(source['dataset'], 'lignes-des-reseaux-transport-zou-provence-alpes-cote-d-azur-proximite-3-3')
        self.assertEqual(source['url'], 'https://transport.data.gouv.fr/resources/82137/download')
        self.assertEqual(source['license'], 'Licence Ouverte 2.0')
        self.assertTrue(source['derive_bounds'])
        self.assertTrue(source['agency_pattern'])
        self.assertIn('monaco', '|'.join(source['exclude_route_patterns']))
        self.assertIn('ventimiglia', '|'.join(source['exclude_route_patterns']))

class TMobileSharding(unittest.TestCase):
    def test_oversized_gtfs_is_split_without_splitting_or_duplicating_trips(self):
        m = load_module()
        with zipfile.ZipFile(io.BytesIO(tcl_like_feed())) as source:
            data, info = m.extract(source, {'pattern': 'tcl'})
        self.assertIsNotNone(data, info)
        shards = list(m.iter_gtfs_shards(data, target_stop_times_bytes=1))
        self.assertEqual(len(shards), 3)
        seen = set()
        for shard, shard_info in shards:
            with zipfile.ZipFile(io.BytesIO(shard)) as archive:
                trips, stop_times = m.validate(archive)
                self.assertEqual(trips, 1)
                _, rows = m.read_table(archive, 'trips.txt')
                ids = {row['trip_id'] for row in rows}
                self.assertEqual(len(ids), 1)
                self.assertTrue(seen.isdisjoint(ids), 'une course ne doit pas apparaître dans plusieurs fragments')
                seen.update(ids)
                self.assertEqual(stop_times, shard_info['stop_times'])
                self.assertTrue(m.read_table(archive, 'calendar_dates.txt')[1])
        self.assertEqual(seen, {'T1', 'T2', 'T3'})

if __name__ == '__main__':
    unittest.main()


class TOccitanieConfig(unittest.TestCase):
    def test_lio_interurban_feed_is_current_dynamic_and_sharded(self):
        m = load_module()
        bundle = next(b for b in m.BUNDLED_AGENCY_FEEDS
                      if any(n['id'] == 'lio-interurbain-occitanie' for n in b['networks']))
        network = next(n for n in bundle['networks'] if n['id'] == 'lio-interurbain-occitanie')
        self.assertEqual(bundle['dataset'], 'reseau-lio-occitanie')
        self.assertEqual(bundle['url'], 'https://transport.data.gouv.fr/resources/81026/download')
        self.assertTrue(bundle['allow_mobile_sharding'])
        self.assertEqual(network['agency_pattern'], '.*')
        self.assertIn('license', bundle)

