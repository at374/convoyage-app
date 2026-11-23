#!/usr/bin/env python3
"""Inventory actual GTFS stop_ids for official Isere fare-zone reconciliation.

Does NOT assign, infer, or certify any fare zone.
"""
import csv
import io
import json
import sys
import zipfile
from collections import Counter
from pathlib import Path


def build(source):
    with zipfile.ZipFile(source) as archive:
        names = {Path(name).name: name for name in archive.namelist() if not name.endswith('/')}
        if not {'stops.txt', 'stop_times.txt'} <= names.keys():
            raise ValueError('Missing stops.txt or stop_times.txt')
        with archive.open(names['stops.txt']) as f:
            stops = list(csv.DictReader(io.TextIOWrapper(f, encoding='utf-8-sig', newline='')))
        with archive.open(names['stop_times.txt']) as f:
            used = Counter(row['stop_id'] for row in csv.DictReader(
                io.TextIOWrapper(f, encoding='utf-8-sig', newline='')) if row.get('stop_id'))
    ids = [row.get('stop_id', '') for row in stops]
    if any(not sid for sid in ids) or len(ids) != len(set(ids)):
        raise ValueError('Empty or duplicate stop_id in stops.txt')
    lookup = {row['stop_id']: row for row in stops}
    orphan = sorted(set(used) - set(lookup))
    rows = []
    for sid in sorted(used):
        row = lookup.get(sid, {})
        rows.append({
            'stop_id': sid, 'stop_name': row.get('stop_name', ''),
            'stop_lat': row.get('stop_lat', ''), 'stop_lon': row.get('stop_lon', ''),
            'parent_station': row.get('parent_station', ''),
            'stop_times_count': used[sid], 'present_in_stops_txt': sid in lookup,
        })
    return rows, {
        'stops_txt': len(stops), 'served_stop_ids': len(used),
        'orphan_stop_ids': orphan, 'zone_assignments_created': 0,
    }


def main():
    if len(sys.argv) != 4:
        raise SystemExit('Usage: inventory-isere-gtfs-stops.py INPUT_ZIP OUTPUT_CSV OUTPUT_JSON')
    rows, summary = build(Path(sys.argv[1]))
    output = Path(sys.argv[2])
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'stop_id', 'stop_name', 'stop_lat', 'stop_lon', 'parent_station',
            'stop_times_count', 'present_in_stops_txt',
        ])
        writer.writeheader()
        writer.writerows(rows)
    Path(sys.argv[3]).write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False))
    if summary['orphan_stop_ids']:
        raise SystemExit('Orphan stop_ids found; no fare reference may be certified')


if __name__ == '__main__':
    main()
