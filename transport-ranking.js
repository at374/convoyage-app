/* Convoyage Ultra: pure multimodal ranking, no mission writes.
 * Only confirmed door-to-door journeys may receive the "réalisable" label.
 */
(function(root){
  'use strict';
  function finite(v){return typeof v==='number'&&Number.isFinite(v);}
  function validTime(v){return typeof v==='string'&&/T\d{2}:\d{2}/.test(v)&&/(Z|[+-]\d{2}:\d{2})$/i.test(v)&&Number.isFinite(Date.parse(v));}
  function point(value){
    return value&&finite(value.lat)&&finite(value.lon??value.lng)&&Math.abs(value.lat)<=90&&Math.abs(value.lon??value.lng)<=180;
  }
  function metres(a,b){
    const rad=Math.PI/180,lat1=a.lat*rad,lat2=b.lat*rad;
    const dLat=lat2-lat1,dLon=((b.lon??b.lng)-(a.lon??a.lng))*rad;
    const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
    return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));
  }
  function evaluate(item,opts={}){
    const legs=Array.isArray(item.legs)?item.legs:[];
    const departure=validTime(item.departure)?Date.parse(item.departure):NaN;
    const arrival=validTime(item.arrival)?Date.parse(item.arrival):NaN;
    const valid=Number.isFinite(departure)&&Number.isFinite(arrival)&&arrival>departure;
    const price=finite(item.priceEUR)&&item.priceEUR>=0?item.priceEUR:null;
    const minimumMargin=opts.exactGPSReliable===true&&item.exactDestination===true&&item.accessVerified===true?5:15;
    const margin=finite(opts.marginMinutes)?Math.max(minimumMargin,opts.marginMinutes):minimumMargin;
    const deadline=validTime(opts.deadline)?Date.parse(opts.deadline):NaN;
    const slack=valid&&Number.isFinite(deadline)?Math.floor((deadline-arrival)/60000):null;
    // Confirmed services still need a chronological, connectable itinerary.
    // Legacy legs without times retain their existing service-confirmation semantics.
    let previousArrival=departure,previousPoint=null;
    const connected=legs.every(leg=>{
      if(!leg||leg.departure==null&&leg.arrival==null)return true;
      if(!validTime(leg.departure)||!validTime(leg.arrival))return false;
      const start=Date.parse(leg.departure),end=Date.parse(leg.arrival);
      if(start<previousArrival||end<=start||end>arrival)return false;
      if(previousPoint&&point(leg.fromPoint)&&metres(previousPoint,leg.fromPoint)>50)return false;
      previousPoint=point(leg.toPoint)?leg.toPoint:null;
      previousArrival=end;
      return true;
    });
    const allTimed=legs.length>0&&legs.every(leg=>leg&&validTime(leg.departure)&&validTime(leg.arrival));
    const boundsMatch=!allTimed||(Date.parse(legs[0].departure)===departure&&Date.parse(legs.at(-1).arrival)===arrival);
    const spatialEvidence=legs.length===1||legs.every(leg=>point(leg.fromPoint)&&point(leg.toPoint));
    const allVerified=legs.length>0&&connected&&boundsMatch&&(legs.length===1||allTimed)&&spatialEvidence&&legs.every(leg=>leg&&leg.serviceConfirmed===true);
    const doorToDoor=item.exactOrigin===true&&item.exactDestination===true;
    const feasible=valid&&allVerified&&doorToDoor&&item.accessVerified===true&&
      Number.isFinite(deadline)&&slack>=margin;
    return {...item,priceEUR:price,durationMinutes:valid?Math.ceil((arrival-departure)/60000):null,
      slackMinutes:slack,feasible,displayStatus:feasible?'Réalisable':'Transport non confirmé — vérifiez vous-même'};
  }
  function rank(items,opts={}){
    const enriched=(Array.isArray(items)?items:[]).map(x=>evaluate(x,opts));
    const valid=enriched.filter(x=>x.durationMinutes!==null&&
      (x.slackMinutes===null||x.slackMinutes>=(finite(opts.marginMinutes)?Math.max(opts.marginMinutes,opts.exactGPSReliable===true&&x.exactDestination===true&&x.accessVerified===true?5:15):(opts.exactGPSReliable===true&&x.exactDestination===true&&x.accessVerified===true?5:15))));
    const byPrice=(a,b)=>Number(b.feasible)-Number(a.feasible)||
      ((a.priceEUR??Infinity)===(b.priceEUR??Infinity)?0:(a.priceEUR??Infinity)-(b.priceEUR??Infinity))||a.durationMinutes-b.durationMinutes;
    const byDuration=(a,b)=>Number(b.feasible)-Number(a.feasible)||
      a.durationMinutes-b.durationMinutes||
      ((a.priceEUR??Infinity)===(b.priceEUR??Infinity)?0:(a.priceEUR??Infinity)-(b.priceEUR??Infinity));
    const priced=valid.filter(x=>x.priceEUR!==null);
    const cheapest=[...priced].sort(byPrice)[0];
    const fastest=[...valid].sort(byDuration)[0];
    const compromise=[...valid].sort((a,b)=>{
      const score=x=>{
        const price=x.priceEUR===null?100000:x.priceEUR;
        const safety=x.slackMinutes===null?100:Math.max(0,45-x.slackMinutes)*2;
        return price+safety+x.durationMinutes/20;
      };
      return Number(b.feasible)-Number(a.feasible)||score(a)-score(b);
    })[0];
    const unique=[];for(const [label,journey] of [['Moins cher',cheapest],['Compromis',compromise],['Plus rapide',fastest]]){
      if(journey&&!unique.some(x=>x.journey===journey))unique.push({label,journey});
    }
    return unique;
  }
  const api={evaluate,rank};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CPTransportRanking=api;
})(typeof window!=='undefined'?window:globalThis);
