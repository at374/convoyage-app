/* Conservative fare calculation: never infer prices or pass validity from GTFS.
 * All amounts are EUR and must come from a verified source.
 */
(function(root){
  'use strict';
  function money(value){if(typeof value!=='number'||!Number.isFinite(value)||value<0)return null;const cents=value*100;return Number.isSafeInteger(Math.round(cents))&&Math.abs(cents-Math.round(cents))<1e-7?value:null;}
  function validTimestamp(value){
    if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value))return NaN;
    const day=Date.parse(value.slice(0,10)+'T12:00:00Z');
    return Number.isFinite(day)&&new Date(day).toISOString().slice(0,10)===value.slice(0,10)?Date.parse(value):NaN;
  }
  function validForTravel(leg,travelDate){
    if(travelDate==null)return true;
    if(typeof travelDate!=='string'||!/^(20\d{2})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(travelDate))return false;
    const day=Date.parse(travelDate.slice(0,10)+'T12:00:00Z');
    if(!Number.isFinite(day)||new Date(day).toISOString().slice(0,10)!==travelDate.slice(0,10))return false;
    const when=Date.parse(travelDate);
    if(!Number.isFinite(when))return false;
    const start=leg?.fareValidFrom?validTimestamp(leg.fareValidFrom):NaN;
    const end=leg?.fareValidUntil?validTimestamp(leg.fareValidUntil):NaN;
    return Number.isFinite(start)&&Number.isFinite(end)&&start<=end&&start<=when&&when<=end;
  }
  function fare(legs,options={}){
    options=options&&typeof options==='object'?options:{};
    const items=Array.isArray(legs)?legs:[];
    if(!items.length)return {totalEUR:null,known:false,knownSubtotalEUR:0,unknownLegCount:0,breakdown:[],status:'Tarif non vérifié'};
    const breakdown=items.map(leg=>{
      // A later boarding can fall on another day (or after a pass expires).
      // The itinerary's date is only a fallback for legs without a departure.
      const travelDate=leg?.departure??options.travelDate;
      // A numerical amount is not evidence: require an explicit verified source.
      // Walking and stationary transfer/wait legs are not ticketed rides.
      const nonTicketed=leg?.mode==='wa_wal'||leg?.mode==='stationary_transfer'||leg?.mode==='stationary_wait';
      const price=!nonTicketed&&leg?.fareVerified===true && typeof leg?.fareSource==='string' && leg.fareSource.trim() && validForTravel(leg,travelDate)?money(leg.verifiedPriceEUR):null;
      const covered=!nonTicketed&&Boolean(travelDate!=null && leg?.passValidFrom && leg?.passValidUntil && validForTravel({fareValidFrom:leg.passValidFrom,fareValidUntil:leg.passValidUntil},travelDate)&&leg?.passAccepted===true&&
        leg?.passProduct==='SIBRA'&&options.sibraPassActive===true&&
        leg?.passEligibilityVerified===true&&
        typeof leg?.passEligibilitySource==='string'&&leg.passEligibilitySource.trim());
      return {provider:leg?.provider||(nonTicketed?'Marche / correspondance':'Inconnu'),nonTicketed,amountEUR:nonTicketed||covered?0:price,
        passApplied:!nonTicketed&&covered,verified:nonTicketed||covered||price!==null,
        source:nonTicketed?'Aucun titre de transport requis':covered?leg.passEligibilitySource:price!==null?leg.fareSource:null,
        validFrom:covered?leg.passValidFrom||null:price!==null?leg.fareValidFrom||null:null,
        validUntil:covered?leg.passValidUntil||null:price!==null?leg.fareValidUntil||null:null};
    });
    let subtotalCents=0,overflow=false;
    for(const item of breakdown){
      if(!item.verified)continue;
      const cents=Math.round(item.amountEUR*100);
      if(!Number.isSafeInteger(cents)||!Number.isSafeInteger(subtotalCents+cents)){overflow=true;break;}
      subtotalCents+=cents;
    }
    const known=breakdown.every(x=>x.verified)&&!overflow;
    const knownSubtotalEUR=overflow?null:subtotalCents/100;
    const unknownLegCount=breakdown.filter(x=>!x.verified).length;
    const totalEUR=known?knownSubtotalEUR:null;
    const noTicketRequired=breakdown.every(x=>x.nonTicketed);
    return {totalEUR,known,knownSubtotalEUR,unknownLegCount,calculationOverflow:overflow,breakdown,status:noTicketRequired?'Aucun billet requis':known?'Tarif vérifié':'Tarif non vérifié'};
  }
  function describe(result){
    if(!result||!Array.isArray(result.breakdown))return 'Tarif non vérifié';
    const portions=result.breakdown.map((leg,index)=>{
      const name=String(leg.provider||'Portion '+(index+1));
      if(leg.nonTicketed)return name+' : sans billet';
      if(leg.passApplied)return name+' : 0,00 € (abonnement vérifié)';
      return name+' : '+(leg.verified&&money(leg.amountEUR)!==null?
        leg.amountEUR.toFixed(2).replace('.',',')+' €':'prix inconnu');
    });
    const partial=!result.known&&result.breakdown.some(x=>x.verified&&!x.nonTicketed);
    const verifiedSubtotal=partial&&money(result.knownSubtotalEUR)!==null?result.knownSubtotalEUR:null;
    const unknownCount=partial?result.breakdown.filter(x=>!x.verified).length:0;
    const heading=result.calculationOverflow===true?'Total indisponible : dépassement de précision du calcul':result.breakdown.length&&result.breakdown.every(x=>x.nonTicketed)?'Aucun billet requis':result.known?'Total : '+result.totalEUR.toFixed(2).replace('.',',')+' €':
      partial&&verifiedSubtotal!==null?'Total inconnu · Sous-total vérifié : '+verifiedSubtotal.toFixed(2).replace('.',',')+' € · '+unknownCount+' portion'+(unknownCount>1?'s':'')+' sans prix':'Total inconnu';
    return heading+(portions.length?' · '+portions.join(' · '):'');
  }
  function describeLeg(leg){
    if(!leg||typeof leg!=='object')return 'Tarif inconnu';
    if(leg.nonTicketed)return 'Sans billet';
    if(leg.passApplied)return 'Couvert par abonnement vérifié';
    return leg.verified&&money(leg.amountEUR)!==null?'Tarif vérifié : '+leg.amountEUR.toFixed(2).replace('.',',')+' €':'Tarif inconnu';
  }
  const api={fare,describe,describeLeg};if(typeof module==='object'&&module.exports)module.exports=api;
  root.CPTransportFares=api;
})(typeof window!=='undefined'?window:globalThis);
