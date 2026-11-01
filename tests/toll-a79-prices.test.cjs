const test=require('node:test'),assert=require('node:assert/strict');
const {quotePassage,subtotalKnownPassages}=require('../toll-a79-prices.cjs');
const data=require('../data/tolls/reviewed/aliae-a79-2026.json');
const request={date:'2026-11-02',asOf:'2026-11-01',point:'Le Montet',movement:'Transit',vehicleClass:1,nativeEmissionCategory:'e'};
test('A79 retains all ten branch products and 140 native context amounts',()=>{
 assert.equal(data.rows.length,10);assert.equal(new Set(data.rows.map(r=>r.point+'|'+r.movement)).size,10);
 let n=0;
 for(const row of data.rows){
  for(const price of [...Object.values(row.light).flat(),...Object.values(row.heavy).flat()])assert.ok(Number.isFinite(price)&&price>=0);
  for(const group of data.nativeEmissionCategories)for(const c of data.lightVehicleClassOrder){const q=quotePassage({...request,point:row.point,movement:row.movement,vehicleClass:c,nativeEmissionCategory:group});assert.equal(q.amount,row.light[group][data.lightVehicleClassOrder.indexOf(c)]);assert.equal(q.routeVerified,false);n++;}
  for(const group of data.nativeEuroGroups)for(const c of data.heavyVehicleClassOrder){const q=quotePassage({...request,point:row.point,movement:row.movement,vehicleClass:c,nativeEmissionCategory:undefined,nativeEuroGroup:group});assert.equal(q.amount,row.heavy[group][data.heavyVehicleClassOrder.indexOf(c)]);n++;}
 }
 assert.equal(n,140);assert.equal(data.geometry.gpsBindingsVerified,false);
 // Independent table anchors: non-emitting VL and Euro 6 PL are not defaults.
 assert.equal(quotePassage({...request,point:'Montbeugny',vehicleClass:2,nativeEmissionCategory:'ne'}).amount,2.2);
 assert.equal(quotePassage({...request,point:'Montbeugny',vehicleClass:4,nativeEmissionCategory:undefined,nativeEuroGroup:'6'}).amount,8.8);
});
test('A79 source lookup refuses missing/guessed context, unknown branches and out-of-period dates',()=>{
 for(const fields of [{nativeEmissionCategory:undefined},{nativeEmissionCategory:'electric'},{nativeEmissionCategory:'__proto__'},{nativeEuroGroup:'6'},{vehicleClass:'1'},{vehicleClass:0},{point:'MONTET'},{movement:'west'},{point:'Deux-Chaises',movement:'Transit'},{date:'2026-02-30'},{date:'2026-01-31'},{date:'2027-01-01'},{asOf:'2026-10-31'},{asOf:'2026-11-09'}])assert.equal(quotePassage({...request,...fields}).amount,null,JSON.stringify(fields));
 for(const group of [undefined,'EURO 6',6,'7','__proto__'])assert.equal(quotePassage({...request,vehicleClass:3,nativeEmissionCategory:undefined,nativeEuroGroup:group}).amount,null);
 assert.equal(quotePassage({...request,date:'2026-02-01',asOf:'2026-11-08'}).amount,1.2);
 assert.equal(quotePassage({...request,date:'2026-12-31'}).amount,1.2);
});
test('A79 Transit is one product; known-product sums never claim a complete route or double-charge an interchange',()=>{
 assert.equal(quotePassage(request).amount,1.2);
 assert.equal(quotePassage({...request,movement:'Ouest'}).amount,.4);
 assert.equal(quotePassage({...request,movement:'Est'}).amount,1.1);
 const passages=[{point:'Le Montet',movement:'Transit'},{point:'Montbeugny',movement:'Transit'},{point:'Molinet',movement:'Transit'}];
 const q=subtotalKnownPassages({...request,passages});assert.equal(q.subtotal,4.4);assert.equal(q.amount,null);assert.equal(q.completeRoutePrice,null);assert.equal(q.routeVerified,false);
 assert.equal(subtotalKnownPassages({...request,nativeEmissionCategory:'ne',passages}).subtotal,3.4);
 for(const invalid of [[],[null],[passages[0],passages[0]],[{point:'Le Montet',movement:'Ouest'},{point:'Le Montet',movement:'Est'}],[passages[0],{point:'unknown',movement:'Transit'}]])assert.equal(subtotalKnownPassages({...request,passages:invalid}).subtotal,null);
 assert.equal(subtotalKnownPassages({...request,passages:[{...passages[0],nativeEmissionCategory:'ne',vehicleClass:4}]}).subtotal,1.2);
 const two=quotePassage({...request,point:'Deux-Chaises',movement:'Ouest'});assert.equal(two.amount,.2);assert.equal(two.routeVerified,false);
});
