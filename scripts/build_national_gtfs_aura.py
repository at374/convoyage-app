#!/usr/bin/env python3
"""Build a bounded AURA national GTFS slice from an already downloaded official operator archive.
No timetable or ticket price is generated. Run on server/CI, not Android.
"""
import argparse
import hashlib
import io
import json
import os
import sys
import zipfile

sys.path.insert(0, os.path.dirname(__file__))
from build_regional_gtfs import filter_by_bounds, validate

BOUNDS = (44.0, 3.6, 46.7, 7.4)
OPERATORS = ('sncf', 'blablacarBus', 'flixbus')
MAX_OUTPUT = 12 * 1024 * 1024


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--input', required=True, help='Official GTFS archive downloaded server-side')
    p.add_argument('--operator', required=True, choices=OPERATORS)
    p.add_argument('--out', default='data/gtfs')
    p.add_argument('--source-url', required=True, help='Provenance URL of the official archive')
    args = p.parse_args()
    if not args.source_url.startswith('https://'):
        p.error('Official HTTPS provenance URL required')
    if not zipfile.is_zipfile(args.input):
        p.error('Invalid source ZIP')
    excluded_detour_count = 0
    with zipfile.ZipFile(args.input) as source:
        entries = source.infolist()
        names = [item.filename for item in entries]
        if len(entries) > 2000 or len(names) != len(set(names)):
            raise SystemExit('Unsafe GTFS archive: too many or duplicate entries')
        if any(item.flag_bits & 1 or item.filename.startswith('/') or
               '..' in item.filename.split('/') for item in entries):
            raise SystemExit('Unsafe GTFS archive: encrypted or traversing entry')
        if sum(item.file_size for item in entries) > 1024 * 1024 * 1024:
            raise SystemExit('GTFS archive expands beyond 1 GiB safety limit')
        validate(source)
        # Reject an archive with stops outside AURA between two retained stops:
        # removing intermediate stops would falsely present an out-of-area detour as local.
        from build_regional_gtfs import read_table
        _, stops = read_table(source, 'stops.txt')
        inside = set()
        for stop in stops:
            try:
                lat, lon = float(stop.get('stop_lat') or 'nan'), float(stop.get('stop_lon') or 'nan')
                if BOUNDS[0] <= lat <= BOUNDS[2] and BOUNDS[1] <= lon <= BOUNDS[3]:
                    inside.add(stop['stop_id'])
            except (TypeError, ValueError, KeyError):
                pass
        _, times = read_table(source, 'stop_times.txt')
        by_trip = {}
        for row in times:
            by_trip.setdefault(row['trip_id'], []).append(row)
        detours = set()
        for trip_id, rows in by_trip.items():
            ordered = sorted(rows, key=lambda row: int(row['stop_sequence']))
            positions = [i for i, row in enumerate(ordered) if row['stop_id'] in inside]
            if len(positions) >= 2 and any(ordered[i]['stop_id'] not in inside
                    for i in range(positions[0], positions[-1] + 1)):
                detours.add(trip_id)
        excluded_detour_count = len(detours)
        if detours:
            from build_regional_gtfs import write_table
            filtered = io.BytesIO()
            with zipfile.ZipFile(filtered, 'w', zipfile.ZIP_DEFLATED) as safe:
                for name in source.namelist():
                    if name == 'stop_times.txt':
                        fields, rows = read_table(source, name)
                        write_table(safe, name, fields, [row for row in rows if row['trip_id'] not in detours])
                    elif name == 'trips.txt':
                        fields, rows = read_table(source, name)
                        write_table(safe, name, fields, [row for row in rows if row['trip_id'] not in detours])
                    elif not name.endswith('/'):
                        safe.writestr(name, source.read(name))
            filtered.seek(0)
            with zipfile.ZipFile(filtered) as safe:
                data, info = filter_by_bounds(safe, {'bounds': BOUNDS})
        else:
            data, info = filter_by_bounds(source, {'bounds': BOUNDS})
    if data is None:
        raise SystemExit('No AURA trips: ' + str(info))
    if len(data) > MAX_OUTPUT:
        raise SystemExit('Regional slice exceeds 12 MiB; split by corridor before publishing')
    with zipfile.ZipFile(io.BytesIO(data)) as check:
        validate(check)
    os.makedirs(args.out, exist_ok=True)
    name = 'national-' + args.operator + '-aura.zip'
    target = os.path.join(args.out, name)
    with open(target, 'wb') as output:
        output.write(data)
    result = {'operator': args.operator, 'file': name, 'sha256': hashlib.sha256(data).hexdigest(),
              'bytes': len(data), 'bounds': BOUNDS, 'source': args.source_url,
              'scope': 'AURA-only static GTFS; no live ticket prices or seat availability',
              'excludedOutOfRegionDetourTrips': excluded_detour_count,
              'details': info}
    with open(target + '.json', 'w', encoding='utf-8') as output:
        json.dump(result, output, ensure_ascii=False, indent=2)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
