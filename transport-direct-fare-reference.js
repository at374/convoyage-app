/* Official tariff references are never verified prices or ranking inputs. */
(function(root){
'use strict';
function reference(row){
 if(!row||row.legs?.length||typeof row.departure!=='string'||!Number.isFinite(Date.parse(row.departure)))return null;
 try{
  if(row.line==='Y51'){
   const portions=root.CPTY51Fares?.reference(row)?.portions;
   const fare=Array.isArray(portions)&&portions.length===1?portions[0]:null;
   return fare&&fare.confirmedCurrentFare===false&&Number.isFinite(fare.amountEUR)&&fare.amountEUR>=0?
    {line:'Y51',amount:fare.amountEUR,digitalAlternativeEUR:fare.digitalAlternativeEUR,source:fare.source,fareVerified:false,serviceConfirmed:false}:null;
  }
  const date=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(row.departure)).map(p=>[p.type,p.value]));
  const stop=s=>({id:s?.stopId,lat:s?.lat,lon:s?.lon});
  const input={networkId:row.networkId,line:row.line,fromStop:stop(row.originStop),toStop:stop(row.destinationStop),travelDate:date.year+'-'+date.month+'-'+date.day,profile:'adult'};
  const api=row.line==='272'?root.CP272Fares:row.line==='274'?root.CP274Fares:row.line==='Y02'?root.CPY02Fares:row.line==='Y21'?root.CPY21Fares:row.line==='Y22'?root.CPY22Fares:
   ['Y62','Y63'].includes(row.line)&&root.CPAravisFareData?root.CPAravisFares?.createCalculator(root.CPAravisFareData):null;
  const value=api?.stopReference({...input,...(['272','274'].includes(row.line)?{product:'parcours'}:{})}) ||
   (row.line==='274'?api?.stopReference({...input,product:'multizones_10_210'}):null);
  return value&&value.fareVerified===false&&Number.isFinite(value.amount)&&value.amount>=0?value:null;
 }catch(_){return null;}
}
const api={reference};if(typeof module==='object'&&module.exports)module.exports=api;root.CPDirectFareReference=api;
})(typeof window!=='undefined'?window:globalThis);
