'use strict';
const data=require('./data/tolls/reviewed/aura-swiss-prices-2026-11-01.json'),{validDate}=require('./toll-official-catalogue.cjs');
const unknown=reason=>({status:'unconfirmed',amount:null,reason,routeVerified:false});
function current(request){const asOf=request.asOf||new Date().toISOString().slice(0,10);return validDate(request.date)&&validDate(asOf)&&asOf>=data.reviewedAt&&Date.parse(asOf)-Date.parse(data.reviewedAt)<=7*86400000;}
function vignette(){
 const v=data.vignette;
 // User's vignette is already represented in existing toll inputs. This helper
 // exposes the official reference, never another purchase or per-trip charge.
 return {status:'reference-only',component:v.id,amount:0,currency:v.currency,referenceUnitAmount:v.amount,insertIntoBudget:false,accounting:'existing-toll-input',validFrom:v.validFrom,validThrough:v.validThrough,sourceUrl:v.source,entitlementVerified:false,routeVerified:false};
}
function grandSaintBernard(request){
 if(!current(request))return unknown('invalid-date-or-source-not-fresh');
 const t=data.grandSaintBernard;
 if(request.date<t.effectiveFrom||Number(request.date.slice(0,4))!==t.reviewedYear)return unknown('outside-reviewed-tariff-period');
 const currency=Object.hasOwn(t.paymentCurrencyByDepartureSide,request.departureSide)?t.paymentCurrencyByDepartureSide[request.departureSide]:null;
 const prices=Object.hasOwn(t.prices,request.nativeCategory)?t.prices[request.nativeCategory]:null;
 if(!currency||!prices)return unknown('native-category-or-departure-side-required');
 const i=t.productOrder.indexOf(request.product);
 if(i<0)return unknown('unsupported-product-or-entitlement-required');
 return {status:'official-source-purchase-price',amount:prices[currency][i],currency,product:request.product,sourceUrl:t.source,effectiveFrom:t.effectiveFrom,validity:t.validity,routeVerified:false,eligibilityVerified:false,incrementalTripCostVerified:false};
}
module.exports={vignette,grandSaintBernard};
