const test=require('node:test'),assert=require('node:assert/strict');
const {quote,completeOverlay}=require('../toll-aprr-open.cjs');
const data=require('../data/tolls/reviewed/aprr-area-open-2026.json');
const overlay=require('../peages-overlay.json');
const request={date:'2026-11-02',asOf:'2026-11-01',vehicleClass:1,road:'A432',stationCode:'09153'};
test('APRR open source preserves 20 distinct codes and all 100 published amounts',()=>{
 assert.equal(data.rows.length,20);assert.equal(new Set(data.rows.map(r=>r.stationCode)).size,20);
 assert.equal(data.rows.filter(r=>r.barrierId).length,14);
 for(const row of data.rows){assert.equal(row.prices.length,5);for(let c=1;c<=5;c++){
  assert.ok(Number.isFinite(row.prices[c-1])&&row.prices[c-1]>=0);
  const q=quote({...request,road:row.road,stationCode:row.stationCode,vehicleClass:c});
  assert.equal(q.amount,row.prices[c-1]);assert.equal(q.routeVerified,false);
 }}
 assert.equal(data.verification.downloadedBytesVerified,false);assert.equal(data.verification.rawSha256,null);
 // Independent transcription anchors from both operator sections of the PDF.
 assert.deepEqual(data.rows.find(r=>r.stationCode==='09153').prices,[2.4,3.9,6.2,8,1.5]);
 assert.deepEqual(data.rows.find(r=>r.stationCode==='03070').prices,[2.3,3.6,5.7,7,1.1]);
 assert.deepEqual(data.rows.find(r=>r.stationCode==='15019').prices,[2.9,5.4,8.7,11.1,1.8]);
 assert.equal(quote({...request,road:'A41N',stationCode:'15019'}).geographyBound,false);
});
test('APRR lookup refuses name guesses, wrong roads, classes and dates',()=>{
 for(const fields of [{stationCode:9153},{stationCode:'LA BOISSE'},{stationCode:'09153',road:'A42'},{vehicleClass:'1'},{vehicleClass:0},{vehicleClass:6},{date:'2026-02-30'},{date:'2026-01-31'},{date:'2027-01-01'},{asOf:'2026-10-31'},{asOf:'2026-11-09'},{date:undefined}])assert.equal(quote({...request,...fields}).amount,null,JSON.stringify(fields));
 assert.equal(quote({...request,date:'2026-02-01'}).amount,2.4);
 assert.equal(quote({...request,date:'2026-12-31',asOf:'2026-11-08'}).amount,2.4);
 assert.equal(quote({...request,road:'A432',stationCode:'03070'}).amount,2.3);
 assert.equal(quote({...request,road:'TML',stationCode:'09429',vehicleClass:4}).amount,31.9);
});
test('APRR completion fills 42 missing classes without altering existing rates, geometry or inputs',()=>{
 const legacy=JSON.parse(JSON.stringify(overlay));
 legacy.tarifs=legacy.tarifs.filter(t=>!t.id.startsWith('aprr-open-2026-'));
 const before=JSON.stringify(legacy),r=completeOverlay(legacy);
 assert.equal(r.added,42);assert.equal(JSON.stringify(legacy),before);
 assert.equal(r.boundRows,14);assert.equal(r.pendingGeography.length,6);
 assert.deepEqual(r.overlay.tarifs.slice(0,legacy.tarifs.length),legacy.tarifs);
 assert.deepEqual(r.overlay.barrieres,legacy.barrieres);assert.deepEqual(r.overlay.gares,legacy.gares);
 const {creerMoteur}=require('../peage-engine.js');
 const engine=creerMoteur({versions:r.overlay.tarifs.map(t=>({barrier_station_id:t.b,vehicle_class:t.c,amount_eur:t.a,status:t.s,effective_from:t.f,effective_to:t.t,source_url:r.overlay.u[t.u]}))});
 for(const row of data.rows.filter(r=>r.barrierId))for(let c=1;c<=5;c++)assert.equal(engine.barriere(row.barrierId,c,request.date).amount,row.prices[c-1]);
 for(const row of data.rows.filter(r=>!r.barrierId))assert.equal(r.overlay.barrieres_preuves.some(p=>p.sourceStationCode===row.stationCode),false);
 assert.equal(completeOverlay(r.overlay).added,0);assert.deepEqual(completeOverlay(r.overlay).overlay,r.overlay);
 for(const t of r.overlay.tarifs.filter(t=>t.id.startsWith('aprr-open-2026-')))assert.equal(t.t,'2026-12-31');
});
test('APRR completion aborts on conflicting rates or ambiguous/missing barrier bindings',()=>{
 for(const change of [o=>{o.tarifs.find(t=>t.b==='aprr-area-ouvert-myennes'&&t.c===1).a=999;},o=>{o.barrieres=o.barrieres.filter(b=>b.id!=='aprr-area-ouvert-myennes');},o=>{o.barrieres.push(o.barrieres.find(b=>b.id==='aprr-area-ouvert-myennes'));},o=>{o.tarifs.find(t=>t.b==='aprr-area-ouvert-myennes'&&t.c===1).k={unknown:true};}]){
  const o=JSON.parse(JSON.stringify(overlay));change(o);const before=JSON.stringify(o);assert.throws(()=>completeOverlay(o));assert.equal(JSON.stringify(o),before);
 }
});
