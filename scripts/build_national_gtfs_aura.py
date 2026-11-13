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
    with zipfile.ZipFile(args.input) as source:
        validate(source)
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
              'details': info}
    with open(target + '.json', 'w', encoding='utf-8') as output:
        json.dump(result, output, ensure_ascii=False, indent=2)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
