/* Conservative fare calculation: never infer prices or pass validity from GTFS.
 * All amounts are EUR and must come from a verified source.
 */
(function(root){
  'use strict';
  function money(value){return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;}
  function fare(legs,options={}){
    const items=Array.isArray(legs)?legs:[];
    if(!items.length)return {totalEUR:null,known:false,breakdown:[],status:'Tarif non vérifié'};
    const breakdown=items.map(leg=>{
      const price=money(leg?.verifiedPriceEUR);
      const covered=leg?.passAccepted===true&&
        leg?.passProduct==='SIBRA'&&options.sibraPassActive===true&&
        leg?.passEligibilityVerified===true;
      return {provider:leg?.provider||'Inconnu',amountEUR:covered?0:price,
        passApplied:covered,verified:covered||price!==null};
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
