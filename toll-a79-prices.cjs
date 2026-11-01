'use strict';
const data=require('./data/tolls/reviewed/aliae-a79-2026.json');
const {validDate}=require('./toll-official-catalogue.cjs');
const unknown=reason=>({status:'unconfirmed',amount:null,reason,routeVerified:false});
function quotePassage(request={}){
 const asOf=request.asOf||new Date().toISOString().slice(0,10);
 if(!validDate(request.date)||!validDate(asOf))return unknown('invalid-date');
 if(data.reviewedAt>asOf||Date.parse(asOf)-Date.parse(data.reviewedAt)>7*86400000)return unknown('source-not-fresh');
 if(request.date<data.effectiveFrom||request.date>data.reviewedThrough)return unknown('outside-reviewed-tariff-period');
 const row=data.rows.find(r=>r.point===request.point&&r.movement===request.movement);
 if(!row)return unknown('exact-published-point-and-movement-required');
 const c=request.vehicleClass;let amount;
 if(data.lightVehicleClassOrder.includes(c)){
  if(!data.nativeEmissionCategories.includes(request.nativeEmissionCategory)||request.nativeEuroGroup!=null)return unknown('native-light-emission-category-required');
  amount=row.light[request.nativeEmissionCategory][data.lightVehicleClassOrder.indexOf(c)];
 }else if(data.heavyVehicleClassOrder.includes(c)){
  if(!data.nativeEuroGroups.includes(request.nativeEuroGroup)||request.nativeEmissionCategory!=null)return unknown('native-heavy-euro-group-required');
  amount=row.heavy[request.nativeEuroGroup][data.heavyVehicleClassOrder.indexOf(c)];
 }else return unknown('published-vehicle-class-required');
 if(!Number.isFinite(amount)||amount<0)return unknown('source-amount-unavailable');
 return {status:'official-source-passage-price',amount,currency:data.currency,point:row.point,movement:row.movement,
  vehicleClass:c,nativeEmissionCategory:request.nativeEmissionCategory||null,nativeEuroGroup:request.nativeEuroGroup||null,
  sourceUrl:data.sourceUrl,effectiveFrom:data.effectiveFrom,reviewedAt:data.reviewedAt,
  routeVerified:false,vehicleClassificationVerified:false};
}
// Caller-supplied products only, one movement per pricing point. A subtotal
// must never be exposed as the price of a fully checked driving itinerary.
function subtotalKnownPassages(request={}){
 const fail=reason=>({...unknown(reason),subtotal:null,completeRoutePrice:null});
 if(!Array.isArray(request.passages)||!request.passages.length)return fail('explicit-passages-required');
 const seen=new Set(),lines=[];
 for(const p of request.passages){
  if(!p||typeof p!=='object'||Array.isArray(p))return fail('invalid-passage');
  if(seen.has(p.point))return fail('duplicate-or-competing-movements');
  seen.add(p.point);
  // Per-line input cannot override the shared date or vehicle classification.
  const q=quotePassage({...request,point:p.point,movement:p.movement});
  if(q.amount==null)return fail(q.reason);
  lines.push(q);
 }
 return {status:'official-source-passages-subtotal',subtotal:Math.round(lines.reduce((n,l)=>n+Math.round(l.amount*100),0))/100,
  currency:data.currency,lines,amount:null,completeRoutePrice:null,routeVerified:false,vehicleClassificationVerified:false};
}
module.exports={quotePassage,subtotalKnownPassages};
