#!/usr/bin/env python3
"""Discover official Cars Region departmental fare pages and linked PDFs.

Metadata only: does not parse PDF prices or establish operator/line coverage.
"""
import concurrent.futures
import datetime
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import urllib.parse
import urllib.request

ROOT = 'https://www.laregionvoustransporte.fr/cars-region/'
MAX_HTML = 3 * 1024 * 1024

class Links(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.href = None
        self.text = []
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.href = dict(attrs).get('href')
            self.text = []
    def handle_data(self, data):
        if self.href is not None:
            self.text.append(data)
    def handle_endtag(self, tag):
        if tag == 'a' and self.href is not None:
            self.links.append((self.href, ' '.join(' '.join(self.text).split())))
            self.href = None

def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent':'ConvoyageUltra-FareSourceDiscovery/1.0'})
    with urllib.request.urlopen(request, timeout=30) as response:
        if urllib.parse.urlsplit(response.url).scheme != 'https':
            raise ValueError('insecure redirect')
        raw = response.read(MAX_HTML + 1)
        if len(raw) > MAX_HTML:
            raise ValueError('HTML size limit exceeded')
    parser = Links()
    parser.feed(raw.decode('utf-8'))
    return {'url':url, 'sha256':hashlib.sha256(raw).hexdigest(),
            'links':[(urllib.parse.urljoin(url, h), t) for h,t in parser.links]}

def candidates(page, base):
    return sorted({h for h,t in page['links'] if (h.startswith(base) or h.startswith(ROOT + 'infos-et-services-cars-region-' + base.rstrip('/').rsplit('/cars-region-', 1)[-1])) and
                   ('infos-et-services' in h or 'titres-et-tarifs' in h or 'tarifs' in h) and
                   not urllib.parse.urlsplit(h).fragment and not h.lower().endswith('.pdf')})

def discover_department(base):
    result = {'departmentPage':base, 'pages':[], 'documents':[], 'errors':[],
              'pricesExtracted':False, 'operatorCoverageVerified':False}
    # The public site's btn_infos navigation is assigned by JavaScript.
    # Reproduce that observed link rule instead of silently missing tariff pages.
    suffix = base.rstrip('/').rsplit('/cars-region-', 1)[-1]
    pending = [base, ROOT + 'infos-et-services-cars-region-' + suffix + '/']
    seen = set()
    for depth in range(3):
        next_pages = set()
        for url in pending:
            if url in seen:
                continue
            seen.add(url)
            if len(seen) > 12:
                result['errors'].append({'url':url,'error':'department page limit reached'})
                continue
            try:
                page = fetch(url)
                result['pages'].append({'url':url,'sha256':page['sha256']})
                for h, label in page['links']:
                    if re.search(r'\.pdf(?:$|[?#])', h, re.I) and urllib.parse.urlsplit(h).scheme == 'https':
                        result['documents'].append({'url':h,'label':label,'foundOn':url,
                            'fareCandidate':bool(re.search(r'tarif|titre|voyage|billet', label, re.I))})
                next_pages.update(candidates(page, base))
            except (OSError, ValueError) as error:
                result['errors'].append({'url':url,'error':str(error)})
        pending = sorted(next_pages - seen)
    if pending:
        result['unvisitedPages'] = pending
    # Preserve every provenance page, while deduplicating identical links on a page.
    result['documents'] = list({(d['url'],d['foundOn']):d for d in result['documents']}.values())
    return result

def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: discover_aura_fare_documents.py OUTPUT.json')
    root = fetch(ROOT)
    bases = sorted({h for h,t in root['links'] if re.fullmatch(re.escape(ROOT)+r'cars-region-[a-z-]+/', h)})
    report = {'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'source':ROOT,'rootSHA256':root['sha256'],
              'scope':'Official departmental HTML pages and linked PDFs only. Documents not downloaded; no prices, dates or complete line/operator coverage validated.',
              'departmentsFound':len(bases),'departments':[]}
    output = Path(sys.argv[1])
    output.parent.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for department in pool.map(discover_department,bases):
            report['departments'].append(department)
            output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
            print(department['departmentPage'].rstrip('/').rsplit('/',1)[-1], len(department['documents']), 'PDF links,', len(department['errors']), 'errors',flush=True)
    report['uniquePDFCount'] = len({d['url'] for dep in report['departments'] for d in dep['documents']})
    report['fareCandidatePDFCount'] = len({d['url'] for dep in report['departments'] for d in dep['documents'] if d['fareCandidate']})
    output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')

if __name__ == '__main__':
    main()
