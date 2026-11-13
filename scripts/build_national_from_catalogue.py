#!/usr/bin/env python3
"""Prepare AURA national GTFS slices from audited public resources, server-side only.
Never invent fares, schedules or feeds. Failed operators are reported, not silently omitted.
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
import urllib.request

OPERATORS = ('sncf', 'blablacarBus', 'flixbus')
MAX_DOWNLOAD = 250 * 1024 * 1024


def fetch(url, destination):
    if not isinstance(url, str) or not url.startswith('https://'):
        raise ValueError('HTTPS source required')
    request = urllib.request.Request(url, headers={'User-Agent': 'ConvoyageUltra-GTFS/1.0'})
    with urllib.request.urlopen(request, timeout=60) as response:
        if response.url.split(':', 1)[0] != 'https':
            raise ValueError('Insecure redirect')
        size = 0
        with open(destination, 'wb') as output:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_DOWNLOAD:
                    raise ValueError('National archive exceeds 250 MiB download cap')
                output.write(chunk)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--audit', default='docs/audit-national-operators.json')
    parser.add_argument('--out', default='data/gtfs')
    parser.add_argument('--operator', choices=OPERATORS, help='Build only this operator')
    args = parser.parse_args()
    with open(args.audit, encoding='utf-8') as source:
        audit = json.load(source)
    if not isinstance(audit, dict):
        parser.error('Audit must be a JSON object')
    if audit.get('source') != 'https://transport.data.gouv.fr/api/datasets':
        parser.error('Audit provenance does not match the public catalogue')
    operators = (args.operator,) if args.operator else OPERATORS
    report = {'sourceAudit': args.audit, 'results': {}}
    for operator in operators:
        feeds = audit.get('operators', {}).get(operator, {}).get('feeds', [])
        if not isinstance(feeds, list):
            report['results'][operator] = {'status': 'invalid-audit', 'attempts': 0, 'errors': ['Feeds must be an array']}
            continue
        errors = []
        for feed in feeds:
            url = feed.get('url')
            if not isinstance(url, str) or not url.startswith('https://'):
                continue
            try:
                with tempfile.TemporaryDirectory() as directory:
                    archive = os.path.join(directory, 'source.zip')
                    fetch(url, archive)
                    command = [sys.executable, os.path.join(os.path.dirname(__file__), 'build_national_gtfs_aura.py'),
                               '--input', archive, '--operator', operator, '--out', args.out, '--source-url', url]
                    output = subprocess.run(command, capture_output=True, text=True, timeout=180)
                    if output.returncode:
                        raise RuntimeError(output.stderr.strip() or output.stdout.strip() or 'GTFS slice failed')
                    report['results'][operator] = {'status': 'built', 'data': json.loads(output.stdout)}
                    break
            except Exception as error:
                errors.append({'resourceId': feed.get('id'), 'error': str(error)[:300]})
        else:
            report['results'][operator] = {'status': 'unavailable', 'attempts': len(feeds), 'errors': errors}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if any(x['status'] != 'built' for x in report['results'].values()):
        raise SystemExit(2)


if __name__ == '__main__':
    main()
