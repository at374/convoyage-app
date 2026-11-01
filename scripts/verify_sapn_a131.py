"""Verify the Tancarville column by PDF word coordinates, never by summing segments."""
from __future__ import annotations
import argparse, datetime as dt, decimal, hashlib, json, re, subprocess, tempfile, urllib.request, urllib.parse
from pathlib import Path
import xml.etree.ElementTree as ET

URL='https://www.autoroutes.sanef.com/sites/default/files/2026-01/2026_02-Grille-SAPN.pdf'
NS={'x':'http://www.w3.org/1999/xhtml'}
NUM=re.compile(r'^\d+(?:[,.]\d{1,2})?$')

def price(word):
    return decimal.Decimal(word['text'].replace(',','.'))

def words(page):
    return [{'text':w.text or '',**{k:float(w.attrib[k]) for k in ['xMin','xMax','yMin','yMax']}}
            for w in page.findall('.//x:word',NS)]

def label_row(items,label):
    labels=[w for w in items if w['text'].strip(' ,:;')==label]
    candidates=[]
    for w in labels:
        values=sorted([v for v in items if NUM.fullmatch(v['text']) and abs(v['yMin']-w['yMin'])<2.5
                       and v['xMax']<w['xMin']],key=lambda v:v['xMin'])
        if len(values)>=2:candidates.append((w,values))
    if len(candidates)!=1:
        raise ValueError('Expected one numeric row for '+label+'; candidates='+str(len(candidates)))
    return candidates[0]

def verify_pages(pages,spec):
    if len(pages)!=2:raise ValueError('Expected exactly the two requested class pages')
    result=[]
    for cls,page in zip([1,2],pages):
        items=words(page)
        label,anchor=label_row(items,'BOURNEVILLE')
        expected_anchor=decimal.Decimal('3.40' if cls==1 else '5.50')
        if price(anchor[-1])!=expected_anchor:raise ValueError('Tancarville anchor differs on class '+str(cls))
        center=lambda w:(w['xMin']+w['xMax'])/2
        x=center(anchor[-1]);step=x-center(anchor[-2])
        if not 5<step<70:raise ValueError('Invalid column spacing')
        records=[]
        for entry in spec['rows']:
            label,row=label_row(items,entry['pdfLabel'])
            matches=[w for w in row if abs(center(w)-x)<step*.42]
            if len(matches)!=1:raise ValueError('Ambiguous source column for '+entry['origin'])
            cell=matches[0];actual=price(cell)
            expected=decimal.Decimal(str(entry['class'+str(cls)]))
            if actual!=expected:raise ValueError('Unexpected source amount for '+entry['origin']+' class '+str(cls)+': '+str(actual))
            records.append({'origin':entry['origin'],'destination':spec['destination'],'vehicleClass':cls,
                            'amountEur':float(actual),'sourcePage':spec['pages'][str(cls)],
                            'sourceCell':{k:cell[k] for k in ['xMin','xMax','yMin','yMax']}})
        result.extend(records)
    return result

def run(spec_path,output,source_copy=None):
    spec=json.loads(Path(spec_path).read_text(encoding='utf-8'))
    if spec['sourceUrl']!=URL:raise ValueError('Unexpected source URL')
    request=urllib.request.Request(URL,headers={'User-Agent':'ConvoyageUltra/1.0 official tariff verification'})
    with urllib.request.urlopen(request,timeout=25) as response:
        if urllib.parse.urlparse(response.geturl()).hostname!='www.autoroutes.sanef.com':raise ValueError('Unexpected redirect')
        data=response.read(10_000_001)
    if len(data)>10_000_000 or not data.startswith(b'%PDF-'):raise ValueError('Invalid or oversized PDF')
    with tempfile.TemporaryDirectory(prefix='sapn-a131-') as tmp:
        pdf=Path(tmp)/'source.pdf';xml=Path(tmp)/'words.xml';pdf.write_bytes(data)
        subprocess.run(['pdftotext','-f','2','-l','3','-bbox',str(pdf),str(xml)],check=True,timeout=30)
        pages=ET.parse(xml).getroot().findall('.//x:page',NS)
        try: rows=verify_pages(pages,spec)
        except ValueError:
            labels={'BOURNEVILLE','INCARVILLE','HEUDEBOUVILLE','CHAUFOUR','POISSY'}
            debug=[]
            for page in pages:
                items=words(page); named=[w for w in items if w['text'].strip(' ,:;') in labels]
                debug.append({'labels':named,'nearbyNumbers':[
                    v for v in items if NUM.fullmatch(v['text']) and any(abs(v['yMin']-w['yMin'])<8 for w in named)
                ]})
            print('SAPN_A131_DIAGNOSTIC='+json.dumps(debug,separators=(',',':')))
            raise
        for cls in [1,2]:
            text=subprocess.check_output(['pdftotext','-f',str(cls+1),'-l',str(cls+1),str(pdf),'-'],timeout=15).decode('utf-8')
            if not re.search(r'CLASSE\s*'+str(cls),text):raise ValueError('Class header missing')
            if '01/02/2026' not in text:raise ValueError('Effective date missing')
    report={'status':'source-coordinate-verified','sourceUrl':URL,'sourceSha256':hashlib.sha256(data).hexdigest(),
            'downloadedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'effectiveFrom':spec['effectiveFrom'],
            'records':rows,'routeVerified':False,'nationalCompletenessVerified':False}
    out=Path(output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    if source_copy:
        target=Path(source_copy);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
    print('SAPN_A131_RESULT='+json.dumps(report,ensure_ascii=False,separators=(',',':')))
    return report


def verify_extract(extract,spec):
    if extract['sourceUrl']!=spec['sourceUrl'] or extract['effectiveFrom']!=spec['effectiveFrom']:
        raise ValueError('Extract source identity/date mismatch')
    result=[]
    for cls in [1,2]:
        rows=extract['rowsByClass'][str(cls)]
        anchor=decimal.Decimal(str(extract['anchorAmountByClass'][str(cls)]))
        columns=None
        for name in extract['knownColumnAnchors']:
            possible={i for i,value in enumerate(rows[name]) if decimal.Decimal(str(value))==anchor}
            columns=possible if columns is None else columns & possible
        if columns is None or len(columns)!=1:raise ValueError('Ambiguous Tancarville column in reviewed extract')
        column=next(iter(columns))
        for entry in spec['rows']:
            row=rows[entry['pdfLabel']]
            if column>=len(row):raise ValueError('Incomplete source row')
            value=decimal.Decimal(str(row[column]))
            if value!=decimal.Decimal(str(entry['class'+str(cls)])):raise ValueError('Reviewed cell mismatch')
            result.append({'origin':entry['origin'],'destination':spec['destination'],'vehicleClass':cls,
                           'amountEur':float(value),'sourcePage':extract['pages'][str(cls)],
                           'sourceColumnIndex':column,'sourceRowLabel':entry['pdfLabel']})
    return result

def run_extract(spec_path,extract_path,output):
    spec=json.loads(Path(spec_path).read_text(encoding='utf-8'))
    data=Path(extract_path).read_bytes();extract=json.loads(data)
    records=verify_extract(extract,spec)
    report={'status':'official-extract-column-verified','sourceUrl':spec['sourceUrl'],
            'sourceExtractSha256':hashlib.sha256(data).hexdigest(),'sourceDocumentSha256':None,
            'effectiveFrom':spec['effectiveFrom'],'verifiedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
            'records':records,'routeVerified':False,'nationalCompletenessVerified':False,
            'rawPdfDownload':'HTTP 403 on GitHub; source text reviewed separately'}
    out=Path(output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('SAPN_A131_RESULT='+json.dumps(report,ensure_ascii=False,separators=(',',':')))
    return report

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--spec',default='data/tolls/reviewed/sapn-a131-2026.json')
    ap.add_argument('--output',default='tmp/sapn-a131-result.json');ap.add_argument('--source-copy');ap.add_argument('--extract')
    a=ap.parse_args()
    if a.extract:run_extract(a.spec,a.extract,a.output)
    else:run(a.spec,a.output,a.source_copy)
