import copy, importlib.util, json, pathlib, unittest, xml.etree.ElementTree as ET
from decimal import Decimal
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('sapn',ROOT/'scripts/verify_sapn_a131.py')
sapn=importlib.util.module_from_spec(spec);spec.loader.exec_module(sapn)
N='{http://www.w3.org/1999/xhtml}'

def page(anchor,actual):
    root=ET.Element(N+'page')
    def word(text,x,y):
        w=ET.SubElement(root,N+'word',xMin=str(x),xMax=str(x+4),yMin=str(y),yMax=str(y+5));w.text=text
    word('1,00',0,10);word(anchor,20,10);word('BOURNEVILLE',50,10)
    word('2,00',0,20);word(actual,20,20);word('INCARVILLE',50,20)
    return root

class SourceCoordinates(unittest.TestCase):
    def setUp(self):
        self.spec={'destination':'TANCARVILLE (A131)','pages':{'1':2,'2':3},
                   'rows':[{'origin':'INCARVILLE','pdfLabel':'INCARVILLE','class1':5.8,'class2':9.4}]}
    def test_selects_same_column_not_an_adjacent_price(self):
        rows=sapn.verify_pages([page('3,40','5,80'),page('5,50','9,40')],self.spec)
        self.assertEqual([r['amountEur'] for r in rows],[5.8,9.4])
        self.assertEqual([r['sourcePage'] for r in rows],[2,3])
    def test_rejects_wrong_anchor(self):
        with self.assertRaises(ValueError):sapn.verify_pages([page('3,30','5,80'),page('5,50','9,40')],self.spec)
    def test_rejects_wrong_price(self):
        with self.assertRaises(ValueError):sapn.verify_pages([page('3,40','5,70'),page('5,50','9,40')],self.spec)
    def test_rejects_duplicate_station_rows(self):
        p=page('3,40','5,80');w=ET.SubElement(p,N+'word',xMin='50',xMax='80',yMin='20',yMax='25');w.text='INCARVILLE'
        with self.assertRaises(ValueError):sapn.verify_pages([p,page('5,50','9,40')],self.spec)

class ReviewedExtract(unittest.TestCase):
    def setUp(self):
        self.spec=json.loads((ROOT/'data/tolls/reviewed/sapn-a131-2026.json').read_text())
        self.extract=json.loads((ROOT/'data/tolls/reviewed/sapn-a131-source-extract-2026.json').read_text())
    def test_exact_column_across_three_known_anchors(self):
        records=sapn.verify_extract(self.extract,self.spec)
        self.assertEqual(len(records),8)
        self.assertEqual([r['amountEur'] for r in records if r['vehicleClass']==2],[9.4,9.4,12.6,17.5])
        self.assertTrue(all(r['sourceColumnIndex']==10 for r in records))
    def test_adjacent_cell_cannot_replace_tancarville(self):
        self.extract['rowsByClass']['2']['INCARVILLE'][10]=9.2
        with self.assertRaises(ValueError):sapn.verify_extract(self.extract,self.spec)
    def test_rejects_source_identity_change(self):
        self.extract['sourceUrl']='https://example.invalid/unofficial'
        with self.assertRaises(ValueError):sapn.verify_extract(self.extract,self.spec)

if __name__=='__main__':unittest.main()

