/* Convoyage Ultra: pure multimodal ranking, no mission writes.
 * Only confirmed door-to-door journeys may receive the "réalisable" label.
 */
(function(root){
  'use strict';
  function finite(v){return typeof v==='number'&&Number.isFinite(v);}
  function validTime(v){
    if(typeof v!=='string')return false;
    const m=/^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,3})?)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/i.exec(v);
    if(!m)return false;
    const year=Number(m[1]),month=Number(m[2]),day=Number(m[3]);
    const calendar=new Date(Date.UTC(year,month-1,day));
    const offset=m[7].match(/^([+-])(\d{2}):(\d{2})$/);
    if(offset&&(Number(offset[2])>14||(Number(offset[2])===14&&Number(offset[3])!==0)))return false;
    return year>=100&&calendar.getUTCFullYear()===year&&calendar.getUTCMonth()===month-1&&calendar.getUTCDate()===day&&Number.isFinite(Date.parse(v));
  }
  function location(p){return p&&finite(p.lat)&&finite(p.lon??p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lon??p.lng)<=180;}
  function meters(a,b){
    const rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=((b.lon??b.lng)-(a.lon??a.lng))*rad;
    const h=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
    return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));
  }
  function evaluate(item,opts={}){
    if(!item||typeof item!=='object'||Array.isArray(item))item={};
    if(!opts||typeof opts!=='object')opts={};
    const legs=Array.isArray(item.legs)?item.legs:[];
    const departure=validTime(item.departure)?Date.parse(item.departure):NaN;
    const arrival=validTime(item.arrival)?Date.parse(item.arrival):NaN;
    const valid=Number.isFinite(departure)&&Number.isFinite(arrival)&&arrival>departure;
    const cents=item.priceEUR*100;
    const price=item.fareVerified===false||item.priceVerified===false?null:
      finite(item.priceEUR)&&item.priceEUR>=0&&Number.isSafeInteger(Math.round(cents))&&
      Math.abs(cents-Math.round(cents))<1e-7?item.priceEUR:null;
    const isReturn=opts.direction==='return';
    const minimumMargin=opts.exactGPSReliable===true&&item.exactDestination===true&&item.accessVerified===true?5:15;
    const margin=finite(opts.marginMinutes)?Math.max(minimumMargin,opts.marginMinutes):minimumMargin;
    const earliestProvided=opts.earliestDeparture!=null;
    const earliestValid=!earliestProvided||validTime(opts.earliestDeparture);
    const earliest=earliestProvided&&earliestValid?Date.parse(opts.earliestDeparture):NaN;
    const deadlineValid=opts.deadline==null||validTime(opts.deadline);
    const deadline=validTime(opts.deadline)?Date.parse(opts.deadline):NaN;
    const slack=valid&&Number.isFinite(deadline)?Math.floor((deadline-arrival)/60000):null;
    // A confirmed service cannot make an itinerary feasible if its supplied leg
    // timestamps overlap or fall outside the displayed journey window.
    const hasTimedLeg=legs.some(leg=>leg&&(leg.departure!==undefined||leg.arrival!==undefined));
    let timelineValid=true,previousEnd=departure;
    for(const leg of legs){
      // Legacy journeys may omit all leg timestamps. Mixed timed/untimed legs
      // cannot certify the chronology of a multimodal connection.
      if(leg?.departure===undefined&&leg?.arrival===undefined){
        if(hasTimedLeg){timelineValid=false;break;}
        continue;
      }
      if(!validTime(leg?.departure)||!validTime(leg?.arrival)){timelineValid=false;break;}
      const start=Date.parse(leg.departure),end=Date.parse(leg.arrival);
      if(!Number.isFinite(previousEnd)||start<previousEnd||end<=start||end>arrival){timelineValid=false;break;}
      previousEnd=end;
    }
    // A timed journey must cover the displayed endpoints; otherwise a hidden
    // first/last transfer could be missing despite individually valid legs.
    if(hasTimedLeg&&legs.length&&timelineValid){
      timelineValid=Date.parse(legs[0].departure)===departure&&
        Date.parse(legs[legs.length-1].arrival)===arrival;
    }
    // When providers supply stop coordinates, a transfer cannot silently
    // jump between distant stops without a walking or other connecting leg.
    for(let i=0;i<legs.length&&timelineValid;i++){
      const leg=legs[i];
      if(leg?.fromPoint!==undefined&&!location(leg.fromPoint)||leg?.toPoint!==undefined&&!location(leg.toPoint)){
        timelineValid=false;break;
      }
      if(i&&legs[i-1]?.toPoint!==undefined&&leg?.fromPoint!==undefined&&
        meters(legs[i-1].toPoint,leg.fromPoint)>50){timelineValid=false;break;}
    }
    // Multi-leg journeys require per-leg timestamps to verify each connection.
    // A single legacy untimed leg remains supported for direct services.
    const chronologyVerified=legs.length<=1||hasTimedLeg;
    const allVerified=timelineValid&&chronologyVerified&&legs.length>0&&legs.every(leg=>leg&&leg.serviceConfirmed===true);
    const doorToDoor=item.exactOrigin===true&&item.exactDestination===true;
    const interchangeVerified=item.interNetwork!==true||item.transferVerified===true;
    const feasible=valid&&earliestValid&&deadlineValid&&(!earliestProvided||departure>=earliest)&&
      allVerified&&doorToDoor&&interchangeVerified&&item.accessVerified===true&&
      (isReturn?(!Number.isFinite(deadline)||slack>=0):Number.isFinite(deadline)&&slack>=margin);
    return {...item,priceEUR:price,durationMinutes:valid?Math.ceil((arrival-departure)/60000):null,
      slackMinutes:slack,feasible,displayStatus:feasible?'Réalisable':'Transport non confirmé — vérifiez vous-même'};
  }
  function rank(items,opts={}){
    if(!opts||typeof opts!=='object')opts={};
    const enriched=(Array.isArray(items)?items:[]).map(x=>evaluate(x,opts));
    const valid=enriched.filter(x=>{
      if(x.durationMinutes===null||opts.deadline!=null&&!validTime(opts.deadline)||
        opts.earliestDeparture!=null&&!validTime(opts.earliestDeparture))return false;
      if(opts.earliestDeparture!=null&&Date.parse(x.departure)<Date.parse(opts.earliestDeparture))return false;
      if(opts.direction==='return')return x.slackMinutes===null||x.slackMinutes>=0;
      const minimum=opts.exactGPSReliable===true&&x.exactDestination===true&&x.accessVerified===true?5:15;
      const margin=finite(opts.marginMinutes)?Math.max(minimum,opts.marginMinutes):minimum;
      return x.slackMinutes===null||x.slackMinutes>=margin;
    });
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
