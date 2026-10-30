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
  const api={fare};if(typeof module==='object'&&module.exports)module.exports=api;
  root.CPTransportFares=api;
})(typeof window!=='undefined'?window:globalThis);
