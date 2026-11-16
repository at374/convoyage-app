const test=require('node:test');
const assert=require('node:assert/strict');
const {csvRows}=require('../scripts/otp-gtfs-audit.cjs');
test('CSV GTFS : en-têtes et CRLF',()=>{
 assert.deepEqual(csvRows('stop_id,stop_name\r\n1,Annecy\r\n'),[['stop_id','stop_name'],['1','Annecy']]);
});
test('CSV GTFS : champs entre guillemets et virgules',()=>{
 assert.deepEqual(csvRows('id,name\n1,"Annecy, gare"\n2,"Station ""Centre"""\n'),[
 ['id','name'],['1','Annecy, gare'],['2','Station "Centre"']]);
});
test('CSV GTFS : dernière ligne sans saut de ligne',()=>{
 assert.deepEqual(csvRows('a,b\n1,2'),[['a','b'],['1','2']]);
});
