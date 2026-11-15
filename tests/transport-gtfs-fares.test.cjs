const {test}=require('node:test');
const assert=require('node:assert/strict');
globalThis.CPGTFSIndex=require('../transport-gtfs-index.js');
const F=require('../transport-gtfs-fares.js');
const H=require('../transport-mission-hub.js');
const base={
 'stops.txt':'stop_id,stop_name,stop_lat,stop_lon,zone_id\nA,Gare,45.90,6.12,Z1\nB,Mairie,45.91,6.13,Z1\nC,Lointain,46.00,6.20,Z2',
 'routes.txt':'route_id,route_short_name,route_type\nR1,1,3\nR2,2,3',
 'trips.txt':'route_id,service_id,trip_id\nR1,S,T1\nR2,S,T2',
 'stop_times.txt':'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT1,08:00:00,08:00:00,A,1\nT1,08:10:00,08:10:00,B,2\nT1,08:30:00,08:30:00,C,3\nT2,09:00:00,09:00:00,B,1\nT2,09:20:00,09:20:00,C,2'
};
const idx=files=>globalThis.CPGTFSIndex.buildIndex(files);

test('tarif unique sans fare_rules : appliqué à toute course du réseau',()=>{
 const files={...base,'fare_attributes.txt':'fare_id,price,currency_type,payment_method,transfers,transfer_duration\nU,1.60,EUR,0,,3600'};
 const f=F.legFare(F.prepare(files),idx(files),{tripId:'T1',from:'A',to:'B'});
 assert.deepEqual([f.amount,f.currency,f.transferMinutes,f.transfers],[1.6,'EUR',60,null]);
});

test('tarif par zones (origine/destination) et par ligne',()=>{
 const files={...base,
  'fare_attributes.txt':'fare_id,price,currency_type,payment_method,transfers\nZ11,2.00,EUR,0,0\nZ12,3.70,EUR,0,0\nL2,1.00,EUR,0,0',
  'fare_rules.txt':'fare_id,route_id,origin_id,destination_id,contains_id\nZ11,R1,Z1,Z1,\nZ12,R1,Z1,Z2,\nL2,R2,,,'};
 const p=F.prepare(files),i=idx(files);
 assert.equal(F.legFare(p,i,{tripId:'T1',from:'A',to:'B'}).amount,2);
 assert.equal(F.legFare(p,i,{tripId:'T1',from:'A',to:'C'}).amount,3.7);
 assert.equal(F.legFare(p,i,{tripId:'T2',from:'B',to:'C'}).amount,1);
});

test('prudence : contains_id, ambiguïté, devise inconnue, flux sans tarif => pas de prix',()=>{
 const contains={...base,'fare_attributes.txt':'fare_id,price,currency_type,payment_method,transfers\nX,2,EUR,0,0','fare_rules.txt':'fare_id,route_id,origin_id,destination_id,contains_id\nX,,,,Z1'};
 assert.equal(F.legFare(F.prepare(contains),idx(contains),{tripId:'T1',from:'A',to:'B'}),null);
 const amb={...base,'fare_attributes.txt':'fare_id,price,currency_type,payment_method,transfers\nX,2,EUR,0,0\nY,3,EUR,0,0','fare_rules.txt':'fare_id,route_id\nX,R1\nY,R1'};
 assert.equal(F.legFare(F.prepare(amb),idx(amb),{tripId:'T1',from:'A',to:'B'}),null);
 const usd={...base,'fare_attributes.txt':'fare_id,price,currency_type,payment_method,transfers\nX,2,USD,0,0'};
 assert.equal(F.legFare(F.prepare(usd),idx(usd),{tripId:'T1',from:'A',to:'B'}),null);
 assert.equal(F.legFare(F.prepare(base),idx(base),{tripId:'T1',from:'A',to:'B'}),null);
 const two={...base,'fare_attributes.txt':'fare_id,price,currency_type,payment_method,transfers\nX,2,EUR,0,0\nY,3,EUR,0,0'};
 assert.equal(F.legFare(F.prepare(two),idx(two),{tripId:'T1',from:'A',to:'B'}),null,'plusieurs tarifs sans règle');
});

test('hub : tarif GTFS repris comme prix fournisseur, correspondance couverte pendant transfer_duration',()=>{
 const g={amount:1.6,currency:'EUR',fareId:'U',transferMinutes:60,transfers:null};
 const row={network:'TAC Annemasse',departure:'2026-11-16T07:00:00.000Z',arrival:'2026-11-16T07:40:00.000Z',
  originStop:{name:'A',lat:46.19,lon:6.23},destinationStop:{name:'C',lat:46.20,lon:6.25},transferStop:{name:'B',lat:46.195,lon:6.24},
  legs:[{line:'1',network:'TAC Annemasse',departure:'2026-11-16T07:00:00.000Z',arrival:'2026-11-16T07:15:00.000Z',gtfsFare:g},
        {line:'2',network:'TAC Annemasse',departure:'2026-11-16T07:20:00.000Z',arrival:'2026-11-16T07:40:00.000Z',gtfsFare:g}]};
 const [j]=H.fromGTFS([row]);
 const p=H.priceOf(j);
 assert.equal(p.status,'verified');assert.equal(p.label,'1,60 €');assert.match(p.sources[0],/GTFS officiel/);
 const [k]=H.fromGTFS([{...row,legs:row.legs.map(l=>({...l,gtfsFare:{...g,transfers:0}}))}]);
 assert.equal(H.priceOf(k).label,'3,20 €','transfers=0 : chaque montée payée');
});
