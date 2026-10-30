/* Convoyage Ultra: pure multimodal ranking, no mission writes.
 * Only confirmed door-to-door journeys may receive the "réalisable" label.
 */
(function(root){
  'use strict';
  function finite(v){return typeof v==='number'&&Number.isFinite(v);}
  function validTime(v){return typeof v==='string'&&/T\d{2}:\d{2}/.test(v)&&/(Z|[+-]\d{2}:\d{2})$/i.test(v)&&Number.isFinite(Date.parse(v));}
  function evaluate(item,opts={}){
    const legs=Array.isArray(item.legs)?item.legs:[];
    const departure=validTime(item.departure)?Date.parse(item.departure):NaN;
    const arrival=validTime(item.arrival)?Date.parse(item.arrival):NaN;
    const valid=Number.isFinite(departure)&&Number.isFinite(arrival)&&arrival>departure;
    const price=finite(item.priceEUR)&&item.priceEUR>=0?item.priceEUR:null;
    const margin=finite(opts.marginMinutes)?Math.max(15,opts.marginMinutes):30;
    const deadline=validTime(opts.deadline)?Date.parse(opts.deadline):NaN;
    const slack=valid&&Number.isFinite(deadline)?Math.floor((deadline-arrival)/60000):null;
    const allVerified=legs.length>0&&legs.every(leg=>leg&&leg.serviceConfirmed===true);
    const doorToDoor=item.exactOrigin===true&&item.exactDestination===true;
    const feasible=valid&&allVerified&&doorToDoor&&item.accessVerified===true&&
      Number.isFinite(deadline)&&slack>=margin;
    return {...item,priceEUR:price,durationMinutes:valid?Math.ceil((arrival-departure)/60000):null,
      slackMinutes:slack,feasible,displayStatus:feasible?'Réalisable':'Transport non confirmé — vérifiez vous-même'};
  }
  function rank(items,opts={}){
    const enriched=(Array.isArray(items)?items:[]).map(x=>evaluate(x,opts));
    const valid=enriched.filter(x=>x.durationMinutes!==null&&
      (x.slackMinutes===null||x.slackMinutes>=15));
    const byPrice=(a,b)=>Number(b.feasible)-Number(a.feasible)||
      (a.priceEUR??Infinity)-(b.priceEUR??Infinity)||a.durationMinutes-b.durationMinutes;
    const byDuration=(a,b)=>Number(b.feasible)-Number(a.feasible)||
      a.durationMinutes-b.durationMinutes||
      (a.priceEUR??Infinity)-(b.priceEUR??Infinity);
    const cheapest=[...valid].sort(byPrice)[0];
    const fastest=[...valid].sort(byDuration)[0];
    const compromise=[...valid].sort((a,b)=>Number(b.feasible)-Number(a.feasible)||
      (a.priceEUR??Infinity)-(b.priceEUR??Infinity)||a.durationMinutes-b.durationMinutes)[0];
    const unique=[];for(const [label,journey] of [['Moins cher',cheapest],['Compromis',compromise],['Plus rapide',fastest]]){
      if(journey&&!unique.some(x=>x.journey===journey))unique.push({label,journey});
    }
    return unique;
  }
  const api={evaluate,rank};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CPTransportRanking=api;
})(typeof window!=='undefined'?window:globalThis);
