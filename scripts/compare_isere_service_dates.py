#!/usr/bin/env python3
"""Compare actual GTFS trip operation dates, independent of service/trip IDs."""
import argparse
import csv
import datetime as dt
import io
import json
import zipfile
from collections import Counter, defaultdict
from pathlib import Path


def rows(z, name):
    matches = [n for n in z.namelist() if Path(n).name == name]
    if not matches:
        return []
    if len(matches) != 1:
        raise ValueError('Duplicate GTFS table: ' + name)
    with z.open(matches[0]) as stream:
        return list(csv.DictReader(io.TextIOWrapper(stream, encoding='utf-8-sig')))


def date(value):
    return dt.datetime.strptime(value, '%Y%m%d').date()


def inspect(path):
    with zipfile.ZipFile(path) as z:
        calendar = rows(z, 'calendar.txt')
        exceptions = rows(z, 'calendar_dates.txt')
        trips = rows(z, 'trips.txt')
        times = rows(z, 'stop_times.txt')
        if not trips or not times or (not calendar and not exceptions):
            raise ValueError('Missing trip, stop time or calendar data')
        service_days = defaultdict(set)
        for r in calendar:
            start, end = date(r['start_date']), date(r['end_date'])
            if end < start:
                raise ValueError('Invalid calendar range')
            if (end - start).days > 1100:
                raise ValueError('Unreasonably long calendar range')
            for n in range((end - start).days + 1):
                d = start + dt.timedelta(days=n)
                if r[d.strftime('%A').lower()] == '1':
                    service_days[r['service_id']].add(d.isoformat())
        for r in exceptions:
            d = date(r['date']).isoformat()
            kind = r['exception_type']
            if kind == '1':
                service_days[r['service_id']].add(d)
            elif kind == '2':
                service_days[r['service_id']].discard(d)
            else:
                raise ValueError('Invalid exception_type')
        stops_by_trip = defaultdict(list)
        for r in times:
            stops_by_trip[r['trip_id']].append(r)
        by_day = defaultdict(Counter)
        for trip in trips:
            trip_id = trip['trip_id']
            if trip_id not in stops_by_trip:
                raise ValueError('Trip without stop_times: ' + trip_id)
            ordered = sorted(stops_by_trip[trip_id], key=lambda x: int(x['stop_sequence']))
            signature = json.dumps([
                trip['route_id'], trip.get('direction_id', ''),
                [[s['stop_id'], s.get('arrival_time', ''), s.get('departure_time', '')]
                 for s in ordered]
            ], ensure_ascii=False, separators=(',', ':'))
            for day in service_days[trip['service_id']]:
                by_day[day][signature] += 1
        return by_day


def compare(old_path, new_path):
    old, new = inspect(old_path), inspect(new_path)
    days = sorted(set(old) | set(new))
    changed = []
    same = 0
    added = removed = 0
    for day in days:
        before, after = old.get(day, Counter()), new.get(day, Counter())
        plus, minus = sum((after - before).values()), sum((before - after).values())
        if plus or minus:
            changed.append({'date': day, 'added_or_changed': plus, 'removed_or_changed': minus})
            added += plus
            removed += minus
        else:
            same += 1
    return {'dates_compared': len(days), 'identical_dates': same,
            'different_dates': len(changed), 'added_or_changed_trip_days': added,
            'removed_or_changed_trip_days': removed, 'changes_by_date': changed,
            'calendar_equivalent': not changed,
            'safe_to_auto_replace': False}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('old_zip', type=Path)
    p.add_argument('new_zip', type=Path)
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args()
    result = compare(a.old_zip, a.new_zip)
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in result.items() if k != 'changes_by_date'}))


if __name__ == '__main__':
    main()
