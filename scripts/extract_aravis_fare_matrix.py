#!/usr/bin/env python3
"""Digitise the two visually reviewed 2026 Y62/Y63 matrices, by pinned PDF.

Requires PyMuPDF. Refuses unknown files, colours and asymmetric matrices.
This does not map GTFS stops to the tariff areas or verify future prices.
"""
import argparse
import hashlib
import json
from pathlib import Path
import fitz

AREAS = ['Annecy','Annecy Albigny','Veyrier-du-Lac Chavoires','Veyrier-du-Lac',
         'Menthon-Saint-Bernard','Alex','Annecy-le-Vieux','Dingy-Saint-Clair',
         'La Balme-de-Thuy','Thônes Morette / Thuy','Thônes','Les Villards-sur-Thônes',
         'Saint-Jean-de-Sixt','Le Grand-Bornand','La Clusaz']
# RGB fills obtained from the PDF drawing paths, then visually checked against
# the legend. Sample away from the white circles overlaid on Sibra cells.
COLOURS = {'1':(0.900,0.441,0.620),'2':(0.980,0.620,0.250),
           '3':(0.910,0.340,0.180),'4':(0.128,0.249,0.603),'SIBRA':(0.0,0.650,0.709),'UNSPECIFIED':(1.,1.,1.)}

def matrix(path, top):
    doc = fitz.open(path)
    if len(doc) != 1:
        raise ValueError('unexpected page count')
    page = doc[0]
    pix = page.get_pixmap(matrix=fitz.Matrix(3,3), alpha=False)
    rows = []
    for origin in range(15):
        row = []
        for destination in range(15):
            x = 101.4705 + (destination + .22) * (264.9535-101.4705)/15
            y = top + (14-origin + .22) * 155.54/15
            pixel = tuple(v/255 for v in pix.pixel(round(x*3),round(y*3))[:3])
            distances = sorted((sum((a-b)**2 for a,b in zip(pixel,colour)),zone) for zone,colour in COLOURS.items())
            if distances[0][0] > .02:
                raise ValueError(f'unrecognised matrix colour at {origin},{destination}: {pixel}; {distances[0]}')
            row.append(distances[0][1])
        rows.append(row)
    if any(rows[i][j] != rows[j][i] for i in range(15) for j in range(15)):
        raise ValueError('asymmetric matrix: check cell coordinates')
    return rows

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf_directory',type=Path)
    parser.add_argument('output',type=Path)
    args = parser.parse_args()
    pins = json.loads((Path(__file__).resolve().parents[1]/'data/transport/aravis-fare-pdf-pins.json').read_text())
    result = {'schemaVersion':1,'checkedOn':'2026-11-06','effectiveFrom':'2026-03-01',
              'validUntil':None,'kind':'official_tariff_reference_not_current_journey_quote',
              'areas':AREAS,'adultSingleEUR':{'1':1.7,'2':4,'3':6.6,'4':8.9},
              'declicSingleEUR':{'1':.8,'2':2,'3':3.3,'4':4.4},
              'declicEligibility':'under_26_with_identity_proof',
              'excludedZone':'SIBRA','gtfsStopMappingVerified':False,'lines':{}}
    for line, top in [('Y62',494.3868),('Y63',509.3868)]:
        pin = pins[line]
        path = args.pdf_directory / pin['filename']
        sha = hashlib.sha256(path.read_bytes()).hexdigest()
        if sha != pin['sha256']:
            raise ValueError('source changed: visual review required for '+line)
        result['lines'][line] = {'source':pin['url'],'sha256':sha,'matrix':matrix(path,top)}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print('Two symmetric 15x15 matrices extracted; SIBRA cells excluded from fare quoting.')

if __name__ == '__main__':
    main()
