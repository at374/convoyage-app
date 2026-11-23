#!/usr/bin/env python3
"""Compare exact stop IDs and GTFS metadata; never infer fares or zones."""
import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import io
import json
import zipfile
from pathlib import Path


def inspect(path):
    with zipfile.ZipFile(path) as z:
        names = {Path(name).name: name for name in z.namelist() if not name.endswith('/')}
        required = {'agency.txt', 'stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt'}
        if not required.issubset(names):
            raise ValueError('Missing GTFS files: ' + ', '.join(sorted(required - names.keys())))
        def read(name):
            with z.open(names[name]) as raw:
                return list(csv.DictReader(io.TextIOWrapper(raw, encoding='utf-8-sig', newline='')))
        agencies = read('agency.txt')
        if not agencies or not any('isere' in (a.get('agency_name') or '').casefold().replace('è','e').replace('é','e') for a in agencies):
            raise ValueError('Expected Isere operator absent from agency.txt')
        stops = read('stops.txt')
        ids = [row.get('stop_id') for row in stops]
        if any(not i for i in ids) or len(ids) != len(set(ids)):
            raise ValueError('Empty or duplicate stop_id')
        stop_times = read('stop_times.txt')
        used = {row.get('stop_id') for row in stop_times}
        if None in used or '' in used or not used.issubset(ids):
            raise ValueError('Invalid or orphan stop_id in stop_times.txt')
        trips = read('trips.txt')
        routes = read('routes.txt')
        trip_ids = {row.get('trip_id') for row in trips}
        route_ids = {row.get('route_id') for row in routes}
        if any(not t for t in trip_ids) or len(trip_ids) != len(trips):
            raise ValueError('Empty or duplicate trip_id')
        if any(not r for r in route_ids) or len(route_ids) != len(routes):
            raise ValueError('Empty or duplicate route_id')
        if any(row.get('trip_id') not in trip_ids for row in stop_times):
            raise ValueError('Orphan trip_id in stop_times.txt')
        if any(row.get('route_id') not in route_ids for row in trips):
            raise ValueError('Orphan route_id in trips.txt')
        # Schedule signatures avoid assuming trip_id stability across exports.
        times_by_trip = defaultdict(list)
        for row in stop_times:
            times_by_trip[row['trip_id']].append(row)
        trip_by_id = {row['trip_id']: row for row in trips}
        signatures = Counter()
        timetables = Counter()
        for trip_id, sequence in times_by_trip.items():
            trip = trip_by_id[trip_id]
            ordered = sorted(sequence, key=lambda row: int(row['stop_sequence']))
            signature = json.dumps([
                trip['route_id'], trip.get('service_id', ''),
                trip.get('direction_id', ''),
                [[row['stop_id'], row.get('arrival_time', ''), row.get('departure_time', '')]
                 for row in ordered]
            ], ensure_ascii=False, separators=(',', ':'))
            signatures[signature] += 1
            # Service IDs can change across publications; this checks timetable shape only.
            # It does not establish equivalent service dates.
            timetable = json.dumps([
                trip['route_id'], trip.get('direction_id', ''),
                [[row['stop_id'], row.get('arrival_time', ''), row.get('departure_time', '')]
                 for row in ordered]
            ], ensure_ascii=False, separators=(',', ':'))
            timetables[timetable] += 1
        calendar_rows = {name: read(name) for name in ('calendar.txt', 'calendar_dates.txt') if name in names}
        calendar_digest = hashlib.sha256(json.dumps(
            {name: sorted(json.dumps(row, sort_keys=True) for row in rows)
             for name, rows in calendar_rows.items()}, sort_keys=True).encode()).hexdigest()
        end_dates = []
        for name, field in [('calendar.txt', 'end_date'), ('calendar_dates.txt', 'date')]:
            if name in names:
                end_dates.extend(row[field] for row in read(name) if row.get(field))
        if not end_dates:
            raise ValueError('No calendar dates')
        return {
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'agency': sorted({a.get('agency_name', '') for a in agencies}),
            'stops': len(ids), 'served_stops': len(used),
            'routes': len(route_ids), 'trips': len(trip_ids),
            'stop_time_rows': len(stop_times),
            'unserved_stops': len(set(ids) - used),
            'calendar_last_date': max(end_dates),
            'calendar_sha256': calendar_digest,
            'scheduled_trip_signatures': sum(signatures.values()),
            'fare_tables': sorted(required_name for required_name in
                ('fare_attributes.txt', 'fare_rules.txt', 'fare_products.txt', 'fare_media.txt')
                if required_name in names),
        }, set(ids), used, signatures, timetables


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('old_zip', type=Path)
    parser.add_argument('new_zip', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    old, old_ids, old_served, old_signatures, old_timetables = inspect(args.old_zip)
    new, new_ids, new_served, new_signatures, new_timetables = inspect(args.new_zip)
    result = {'old': old, 'new': new, 'added_stop_ids': sorted(new_ids-old_ids),
              'removed_stop_ids': sorted(old_ids-new_ids),
              'stop_id_intersection': len(old_ids & new_ids),
              'added_served_stop_ids': sorted(new_served - old_served),
              'removed_served_stop_ids': sorted(old_served - new_served),
              'served_stop_id_intersection': len(old_served & new_served),
              'scheduled_trips_unchanged': sum((old_signatures & new_signatures).values()),
              'scheduled_trips_added_or_changed': sum((new_signatures - old_signatures).values()),
              'scheduled_trips_removed_or_changed': sum((old_signatures - new_signatures).values()),
              'calendar_tables_identical': old['calendar_sha256'] == new['calendar_sha256'],
              'timetables_unchanged_ignoring_service_ids': sum((old_timetables & new_timetables).values()),
              'timetables_added_or_changed_ignoring_service_ids': sum((new_timetables - old_timetables).values()),
              'timetables_removed_or_changed_ignoring_service_ids': sum((old_timetables - new_timetables).values()),
              'service_calendar_equivalence_verified': False,
              'zones_verified': 0, 'fares_verified': 0,
              'safe_to_auto_replace': False}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in result.items() if k not in ('added_stop_ids','removed_stop_ids','added_served_stop_ids','removed_served_stop_ids')}, ensure_ascii=False))


if __name__ == '__main__':
    main()
