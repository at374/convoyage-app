/* Conservative fare calculation: never infer prices or pass validity from GTFS.
 * All amounts are EUR and must come from a verified source.
 */
(function(root){
  'use strict';
  function money(value){return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;}
  function validForTravel(leg,travelDate){
    if(travelDate==null)return true;
    const when=Date.parse(travelDate);
    if(!Number.isFinite(when))return false;
    const start=leg?.fareValidFrom?Date.parse(leg.fareValidFrom):NaN;
    const end=leg?.fareValidUntil?Date.parse(leg.fareValidUntil):NaN;
    return Number.isFinite(start)&&Number.isFinite(end)&&start<=when&&when<=end;
  }
  function fare(legs,options={}){
    const items=Array.isArray(legs)?legs:[];
    if(!items.length)return {totalEUR:null,known:false,breakdown:[],status:'Tarif non vérifié'};
    const breakdown=items.map(leg=>{
      // A later boarding can fall on another day (or after a pass expires).
      // The itinerary's date is only a fallback for legs without a departure.
      const travelDate=leg?.departure??options.travelDate;
      // A numerical amount is not evidence: require an explicit verified source.
      const price=leg?.fareVerified===true && typeof leg?.fareSource==='string' && leg.fareSource.trim() && validForTravel(leg,travelDate)?money(leg.verifiedPriceEUR):null;
      const covered=Boolean((travelDate==null || (leg?.passValidFrom && leg?.passValidUntil && validForTravel({fareValidFrom:leg.passValidFrom,fareValidUntil:leg.passValidUntil},travelDate)))&&leg?.passAccepted===true&&
        leg?.passProduct==='SIBRA'&&options.sibraPassActive===true&&
        leg?.passEligibilityVerified===true&&
        typeof leg?.passEligibilitySource==='string'&&leg.passEligibilitySource.trim());
      return {provider:leg?.provider||'Inconnu',amountEUR:covered?0:price,
        passApplied:covered,verified:covered||price!==null,
        source:covered?leg.passEligibilitySource:price!==null?leg.fareSource:null,
        validFrom:covered?leg.passValidFrom||null:price!==null?leg.fareValidFrom||null:null,
        validUntil:covered?leg.passValidUntil||null:price!==null?leg.fareValidUntil||null:null};
    });
    const known=breakdown.every(x=>x.verified);
    const totalEUR=known?Math.round(breakdown.reduce((n,x)=>n+x.amountEUR,0)*100)/100:null;
    return {totalEUR,known,breakdown,status:known?'Tarif vérifié':'Tarif non vérifié'};
  }
  function describe(result){
    if(!result||!Array.isArray(result.breakdown))return 'Tarif non vérifié';
    const portions=result.breakdown.map((leg,index)=>{
      const name=String(leg.provider||'Portion '+(index+1));
      if(leg.passApplied)return name+' : 0,00 € (abonnement vérifié)';
      return name+' : '+(leg.verified&&money(leg.amountEUR)!==null?
        leg.amountEUR.toFixed(2).replace('.',',')+' €':'prix inconnu');
    });
    return (result.known?'Total : '+result.totalEUR.toFixed(2).replace('.',',')+' €':'Total inconnu')+
      (portions.length?' · '+portions.join(' · '):'');
  }
  const api={fare,describe};if(typeof module==='object'&&module.exports)module.exports=api;
  root.CPTransportFares=api;
})(typeof window!=='undefined'?window:globalThis);
