'use strict';
// Exact published station IDs only. A source amount never certifies a crossing.
const data=require('./data/tolls/reviewed/aprr-area-open-2026.json');
const {validDate}=require('./toll-official-catalogue.cjs');
function quote(request={}){
 const unknown=reason=>({status:'unconfirmed',amount:null,reason,routeVerified:false});
 const asOf=request.asOf||new Date().toISOString().slice(0,10);
 if(!validDate(request.date)||!validDate(asOf))return unknown('invalid-date');
 if(data.reviewedAt>asOf||Date.parse(asOf)-Date.parse(data.reviewedAt)>7*86400000)return unknown('source-not-fresh');
 if(request.date<data.effectiveFrom||request.date>data.reviewedThrough)return unknown('outside-reviewed-tariff-period');
 if(!Number.isInteger(request.vehicleClass)||request.vehicleClass<1||request.vehicleClass>5)return unknown('published-vehicle-class-required');
 const rows=data.rows.filter(r=>r.road===request.road&&r.stationCode===request.stationCode);
 if(rows.length!==1)return unknown('exact-road-and-station-code-required');
 const r=rows[0];
 return {status:'official-source-price',amount:r.prices[request.vehicleClass-1],currency:data.currency,
  stationCode:r.stationCode,road:r.road,publishedName:r.publishedName,vehicleClass:request.vehicleClass,
  sourceUrl:data.sourceUrl,effectiveFrom:data.effectiveFrom,reviewedAt:data.reviewedAt,
  routeVerified:false,geographyBound:r.barrierId!==null,barrierId:r.barrierId};
}
// Add only absent classes for already bound barriers. Verify every existing
// overlapping source amount first; contradictions abort the entire operation.
function completeOverlay(overlay){
 const result=JSON.parse(JSON.stringify(overlay));let added=0;
 for(const row of data.rows.filter(r=>r.barrierId)){
  if(result.barrieres.filter(b=>b.id===row.barrierId).length!==1)throw Error('Missing or ambiguous barrier: '+row.barrierId);
  for(let c=1;c<=5;c++)for(const t of result.tarifs.filter(t=>t.b===row.barrierId&&t.c===c&&t.f<=data.reviewedThrough&&(!t.t||t.t>=data.effectiveFrom))){
   if(t.k!=null||t.a==null||Math.round(t.a*100)!==Math.round(row.prices[c-1]*100))throw Error('Conflicting existing tariff: '+row.stationCode+' class '+c);
  }
 }
 let sourceIndex=result.u.indexOf(data.sourceUrl);if(sourceIndex<0){sourceIndex=result.u.length;result.u.push(data.sourceUrl);}
 result.barrieres_preuves ||= [];
 for(const row of data.rows.filter(r=>r.barrierId)){
  for(let c=1;c<=5;c++){
   // An overlapping record must cover the full reviewed interval to suppress
   // insertion. Partial histories are preserved and not treated as full coverage.
   const existing=result.tarifs.some(t=>t.b===row.barrierId&&t.c===c&&t.f<=data.effectiveFrom&&(!t.t||t.t>=data.reviewedThrough));
   if(existing)continue;
   const id='aprr-open-2026-'+row.stationCode+'-c'+c;
   if(result.tarifs.some(t=>t.id===id))throw Error('Duplicate tariff ID: '+id);
   result.tarifs.push({id,b:row.barrierId,c,a:row.prices[c-1],s:'PROUVE',f:data.effectiveFrom,t:data.reviewedThrough,u:sourceIndex});added++;
  }
  if(!result.barrieres_preuves.some(p=>p.barrierId===row.barrierId&&p.sourceStationCode===row.stationCode))result.barrieres_preuves.push({
   barrierId:row.barrierId,sourceStationCode:row.stationCode,publishedRoad:row.road,publishedName:row.publishedName,
   publishedClassPrices:row.prices,sourceUrl:data.sourceUrl,effectiveFrom:data.effectiveFrom,reviewedAt:data.reviewedAt,
   sourceLocal:'data/tolls/reviewed/aprr-area-open-2026.json',sourceBytesVerified:false,crossingVerified:false,completeRouteVerified:false});
 }
 return {overlay:result,added,sourceRows:data.rows.length,boundRows:data.rows.filter(r=>r.barrierId).length,
  pendingGeography:data.rows.filter(r=>!r.barrierId).map(r=>({stationCode:r.stationCode,road:r.road,publishedName:r.publishedName}))};
}
module.exports={quote,completeOverlay};
