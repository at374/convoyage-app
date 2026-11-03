"""Offline audit: extract the official 2026 Y51 colour matrix and pin known stops.
Requires PyMuPDF and Pillow. No network access or application writes.
Usage: python scripts/extract_y51_tariff_reference.py PDF GTFS_ZIP OUTPUT_JSON
"""
import csv, hashlib, io, json, pathlib, sys, zipfile
import fitz
from PIL import Image

AREAS=['Annecy','Sevrier','Saint-Jorioz','Duingt','Doussard Bredannaz','Doussard Bout du Lac','Lathuile','Doussard Gare','Giez','Faverges-Seythenex','Saint-Ferréol','Val de Chaise','Ugine','Marthod','Albertville']
COLORS={(230,112,158):'1',(249,158,63):'2',(231,87,47):'3',(32,64,154):'4',(0,166,181):'S',(124,81,161):'A'}
PDF_SOURCE='https://annecy.transdev.com/wp-content/uploads/2021/04/AURA-FICHES-TARIFAIRES-2026-Y51_mars-2026.pdf'
TIMETABLE='https://annecy.transdev.com/wp-content/uploads/2026/07/Y51_FP_2026-2027_acy-abt_Vdef.pdf'

def extract(pdf_path, gtfs_path):
    page=fitz.open(pdf_path)[0]
    if abs(page.rect.width-595.276)>0.01 or abs(page.rect.height-841.89)>0.01:
        raise ValueError('PDF layout changed; manual review required')
    text=page.get_text()
    for value in ['1er mars 2026','8,90','1,40']:
        if value not in text: raise ValueError('Unexpected PDF contents: '+value)
    pix=page.get_pixmap(matrix=fitz.Matrix(4,4),alpha=False)
    image=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
    sx,sy=image.width/page.rect.width,image.height/page.rect.height
    grid=[]
    for row in range(15):
        cells=[]
        for col in range(15):
            # Offset from the centre avoids the white concession marker.
            rgb=image.getpixel((int((92.855+11.0685*(col+.2))*sx),int((500.106+11.6*(row+.2))*sy)))
            distances=[(sum((a-b)**2 for a,b in zip(rgb,c)),zone) for c,zone in COLORS.items()]
            distance,zone=min(distances)
            if distance>16: raise ValueError(f'Unknown colour at {row},{col}: {rgb}')
            cells.append(zone)
        grid.append(cells)
    matrix=list(reversed(grid))  # PDF arrival rows run south-to-north.
    if any(matrix[i][j]!=matrix[j][i] for i in range(15) for j in range(15)):
        raise ValueError('Matrix is not symmetric; manual review required')
    if matrix[0][14]!='4' or matrix[0][3]!='S' or matrix[12][14]!='A':
        raise ValueError('Reference cells differ from manual PDF review')
    known=json.loads(pathlib.Path('data/interurban/y51-gtfs-source.json').read_text())
    with zipfile.ZipFile(gtfs_path) as archive:
        current={s['stop_id']:s for s in csv.DictReader(io.TextIOWrapper(archive.open('stops.txt'),encoding='utf-8-sig'))}
    prefix_area={'74010':0,'74267':1,'74242':2,'74108':3,'74147':6,'74135':8,'74123':9,'74234':10,'74167':11,'73303':12,'73153':13,'73292':13,'73011':14}
    stops=[]
    for old in known['stops']:
        value=current.get(old['stop_id'])
        if not value or any(old[k]!=value[k] for k in ['stop_name','stop_lat','stop_lon']):
            raise ValueError('Known stop changed: '+old['stop_id'])
        area=prefix_area.get(value['stop_id'].split(':')[1])
        if value['stop_id'].startswith('FR:74104:'):
            area={'Bredannaz':4,'Bout du Lac':5,'Marceau la Plaine':7,'Guinettes':7,'Poste':7,'Ancienne Gare':7}.get(value['stop_name'])
        if value['stop_name']=='Chez Daviet': area=3  # Published timetable groups this stop under Duingt.
        if area is None: raise ValueError('Stop area needs manual review: '+value['stop_id'])
        stops.append([value['stop_id'],float(value['stop_lat']),float(value['stop_lon']),area,value['stop_name']])
    return {'effectiveFrom':'2026-03-01','checkedOn':'2026-10-31','referenceYear':2026,'source':PDF_SOURCE,'timetableSource':TIMETABLE,
            'pdfSHA256':hashlib.sha256(pathlib.Path(pdf_path).read_bytes()).hexdigest(),
            'gtfsSource':known['source'],'gtfsSHA256':hashlib.sha256(pathlib.Path(gtfs_path).read_bytes()).hexdigest(),
            'areas':AREAS,'matrix':[''.join(row) for row in matrix],
            'singleFullFareEUR':{'1':1.7,'2':4,'3':6.6,'4':8.9,'S':2.5,'A':1.4},'stops':stops,
            'limitations':['Dated tariff reference, not a reservation or confirmed current quote','No invented validity end','No automatic pass deduction, ticket combination, transfer pricing or concession','Year 2026 only as application scope, not a claimed tariff expiry']}

if __name__=='__main__':
    result=extract(sys.argv[1],sys.argv[2])
    pathlib.Path(sys.argv[3]).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'areas':len(result['areas']),'matrixCells':225,'pinnedStops':len(result['stops'])}))
