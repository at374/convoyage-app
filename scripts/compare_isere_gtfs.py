#!/usr/bin/env python3
"""Compare exact stop IDs and GTFS metadata; never infer fares or zones."""
import argparse
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
        used = {row.get('stop_id') for row in read('stop_times.txt')}
        if None in used or '' in used or not used.issubset(ids):
            raise ValueError('Invalid or orphan stop_id in stop_times.txt')
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
            'calendar_last_date': max(end_dates),
            'fare_tables': sorted(required_name for required_name in
                ('fare_attributes.txt', 'fare_rules.txt', 'fare_products.txt', 'fare_media.txt')
                if required_name in names),
        }, set(ids)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('old_zip', type=Path)
    parser.add_argument('new_zip', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    old, old_ids = inspect(args.old_zip)
    new, new_ids = inspect(args.new_zip)
    result = {'old': old, 'new': new, 'added_stop_ids': sorted(new_ids-old_ids),
              'removed_stop_ids': sorted(old_ids-new_ids),
              'stop_id_intersection': len(old_ids & new_ids),
              'zones_verified': 0, 'fares_verified': 0,
              'safe_to_auto_replace': False}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in result.items() if k not in ('added_stop_ids','removed_stop_ids')}, ensure_ascii=False))


if __name__ == '__main__':
    main()
