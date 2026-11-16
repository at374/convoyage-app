#!/usr/bin/env python3
"""Test hors réseau du filtre géographique GTFS (aucun téléchargement)."""
import datetime, os, sys, tempfile, zipfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import preparer_donnees as p

FILES = {
    'agency.txt': 'agency_id,agency_name,agency_url,agency_timezone\nA,Réseau A,https://a,Europe/Paris\nB,Réseau B,https://b,Europe/Paris\n',
    'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon,parent_station\n'
                 's1,Annecy,45.90,6.12,P\ns2,Genève,46.21,6.14,\ns3,Paris,48.85,2.35,\nP,Annecy gare,45.90,6.12,\n',
    'routes.txt': 'route_id,agency_id,route_short_name,route_type\nr1,A,L1,3\nr2,B,L2,2\n',
    'trips.txt': 'route_id,service_id,trip_id\nr1,sv,t1\nr2,sv,t2\nr2,sx,t3\n',
    # t1 : deux arrêts dans la zone ; t2 : un seul (Paris hors zone) ; t3 : service inactif le jour de test.
    'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n'
                      't1,08:00:00,08:00:00,s1,1\nt1,09:00:00,09:00:00,s2,2\n'
                      't2,06:00:00,06:00:00,s3,1\nt2,10:00:00,10:00:00,s1,2\n'
                      't3,08:00:00,08:00:00,s1,1\nt3,09:00:00,09:00:00,s2,2\n',
    'calendar.txt': 'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n'
                    'sv,1,1,1,1,1,0,0,20261101,20261231\nsx,0,0,0,0,0,1,1,20261101,20261231\n',
    'calendar_dates.txt': 'service_id,date,exception_type\nsv,20261125,2\n',
}


def build(path, files, folder=''):
    with zipfile.ZipFile(path, 'w') as z:
        for name, text in files.items():
            z.writestr(folder + name, text)


def main():
    tmp = tempfile.mkdtemp()
    src, dst = os.path.join(tmp, 'in.zip'), os.path.join(tmp, 'out.zip')
    build(src, FILES, 'dossier/')
    r = p.filter_feed(src, dst, p.BBOX, datetime.date(2026, 11, 24))
    assert r['after']['trips'] == 2 and r['after']['stop_times'] == 4, r
    assert r['after']['stops'] == 3, r  # s1, s2 et la gare parente P
    assert [a['agency_name'] for a in r['agencies']] == ['Réseau A', 'Réseau B'], r
    assert r['validity'] == {'from': '20261101', 'to': '20261231'}, r
    assert r['tripsActiveOnTestDate'] == 1, r  # mardi : t1 seulement
    r2 = p.filter_feed(src, dst, p.BBOX, datetime.date(2026, 11, 25))
    assert r2['tripsActiveOnTestDate'] == 0, r2  # exception de suppression
    with zipfile.ZipFile(dst) as z:
        assert 'stop_times.txt' in z.namelist()
        assert b's3' not in z.read('stop_times.txt')
        assert b't2' not in z.read('trips.txt')
    # Retrait d'une agence en doublon : seules les courses de l'autre agence restent.
    r3 = p.filter_feed(src, dst, p.BBOX, datetime.date(2026, 11, 24), r'reseau a')
    assert r3['excludedAgencies'] == ['Réseau A'] and r3['excludedTrips'] == 1, r3
    assert r3['after']['trips'] == 1 and [a['agency_name'] for a in r3['agencies']] == ['Réseau B'], r3
    import re
    names = ['annemasse - tac', 'aix-les-bains - ondea', 'chambery - synchro mobilites', "thonon-les-bains - star't", 'region - cars region ain', 'vienne - l’va']
    pat = re.compile('|'.join(p.DUPLICATES['oura-agregat'].values()))
    assert [n for n in names if pat.search(n)] == names[:4], [n for n in names if pat.search(n)]
    swiss = re.compile('|'.join(p.DUPLICATES['suisse-ski'].values()))
    assert swiss.search(p.norm('Société Nationale des Chemins de fer Français')) and swiss.search('sibra') and swiss.search('rdtain')
    assert not swiss.search(p.norm('Transports Publics Genevois')) and not swiss.search(p.norm('Schweizerische Bundesbahnen SBB'))
    outside = dict(FILES, **{'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon\ns1,X,48.0,2.0\ns2,Y,48.1,2.1\ns3,Z,48.2,2.2\n'})
    build(src, outside)
    try:
        p.filter_feed(src, dst, p.BBOX, datetime.date(2026, 11, 24))
        raise AssertionError('flux hors zone accepté')
    except ValueError:
        pass
    build(src, {k: v for k, v in FILES.items() if k != 'trips.txt'})
    try:
        p.filter_feed(src, dst, p.BBOX, datetime.date(2026, 11, 24))
        raise AssertionError('archive incomplète acceptée')
    except ValueError:
        pass
    print('OK : filtre géographique GTFS, calendrier du jour, rejets')


if __name__ == '__main__':
    main()
