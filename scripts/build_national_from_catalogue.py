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
import urllib.parse

OPERATORS = ('sncf', 'blablacarBus', 'flixbus')
MAX_DOWNLOAD = 250 * 1024 * 1024


ALLOWED_SOURCE_HOSTS = {
    'eu.ftp.opendatasoft.com', 'drive.google.com', 'gtfs.gis.flix.tech'
}


def trusted_download_url(url, redirect=False):
    if not isinstance(url, str):
        return False
    parsed = urllib.parse.urlsplit(url)
    host = (parsed.hostname or '').lower()
    if parsed.scheme != 'https' or parsed.username or parsed.password:
        return False
    if host in ALLOWED_SOURCE_HOSTS:
        return True
    # Google Drive uses temporary download endpoints under googleusercontent.com.
    return redirect and (host == 'googleusercontent.com' or
                         host.endswith('.googleusercontent.com'))


class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not trusted_download_url(newurl, redirect=True):
            raise ValueError('Untrusted national GTFS redirect host')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch(url, destination):
    if not trusted_download_url(url):
        raise ValueError('Untrusted national GTFS download host')
    request = urllib.request.Request(url, headers={'User-Agent': 'ConvoyageUltra-GTFS/1.0'})
    opener = urllib.request.build_opener(SafeRedirectHandler())
    with opener.open(request, timeout=60) as response:
        if not trusted_download_url(response.url, redirect=True):
            raise ValueError('Untrusted national GTFS final download URL')
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
        # Only the nationwide SNCF archive can represent SNCF national coverage.
        # Never silently label Transilien, Bretagne or a shuttle as nationwide SNCF.
        if operator == 'sncf':
            feeds = [feed for feed in feeds if isinstance(feed, dict) and
                     'Export_OpenData_SNCF_GTFS_NewTripId.zip' in str(feed.get('url', ''))]
            if not feeds:
                report['results'][operator] = {
                    'status': 'unavailable', 'attempts': 0,
                    'errors': [{'error': 'National SNCF GTFS resource absent; regional feeds are not a substitute'}]}
                continue
        errors = []
        for feed in feeds:
            if not isinstance(feed, dict):
                errors.append({'resourceId': None, 'error': 'Malformed feed record'})
                continue
            url = feed.get('url')
            if not isinstance(url, str) or not url.startswith('https://'):
                errors.append({'resourceId': feed.get('id'), 'error': 'Missing HTTPS resource URL'})
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
