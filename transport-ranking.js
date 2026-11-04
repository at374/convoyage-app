/* Convoyage Ultra: pure multimodal ranking, no mission writes.
 * Only confirmed door-to-door journeys may receive the "réalisable" label.
 */
(function(root){
  'use strict';
  function finite(v){return typeof v==='number'&&Number.isFinite(v);}
  function validTime(v){
    if(typeof v!=='string'||!/^20\d{2}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(v))return false;
    const offset=v.match(/([+-])(\d{2}):(\d{2})$/);
    if(offset&&Number(offset[2])===14&&Number(offset[3])!==0)return false;
    const day=Date.parse(v.slice(0,10)+'T12:00:00Z');
    return Number.isFinite(day)&&new Date(day).toISOString().slice(0,10)===v.slice(0,10)&&Number.isFinite(Date.parse(v));
  }
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
    if(!item||typeof item!=='object'||Array.isArray(item))item={};
    if(!opts||typeof opts!=='object')opts={};
    const legs=Array.isArray(item.legs)?item.legs:[];
    const departure=validTime(item.departure)?Date.parse(item.departure):NaN;
    const arrival=validTime(item.arrival)?Date.parse(item.arrival):NaN;
    const valid=Number.isFinite(departure)&&Number.isFinite(arrival)&&arrival>departure;
    // Never present a provider-declared unverified fare as a known price.
    const price=item.fareVerified===false||item.priceVerified===false?null:finite(item.priceEUR)&&item.priceEUR>=0&&Number.isSafeInteger(Math.round(item.priceEUR*100))&&Math.abs(item.priceEUR*100-Math.round(item.priceEUR*100))<1e-7?item.priceEUR:null;
    const minimumMargin=opts.exactGPSReliable===true&&item.exactDestination===true&&item.accessVerified===true?5:15;
    const margin=finite(opts.marginMinutes)?Math.max(minimumMargin,opts.marginMinutes):minimumMargin;
    const deadlineProvided=opts.deadline!==undefined&&opts.deadline!==null;
    const deadlineValid=!deadlineProvided||validTime(opts.deadline);
    const deadline=deadlineProvided&&deadlineValid?Date.parse(opts.deadline):NaN;
    const slack=valid&&Number.isFinite(deadline)?Math.floor((deadline-arrival)/60000):null;
    // Confirmed services still need a chronological, connectable itinerary.
    // Legacy legs without times retain their existing service-confirmation semantics.
    const transferMinutes=finite(opts.minTransferMinutes)?Math.max(0,opts.minTransferMinutes):3;
    const boardingMinutes=finite(opts.minBoardingMinutes)?Math.max(0,opts.minBoardingMinutes):1;
    let previousArrival=departure,previousPoint=null,previousLeg=null;
    const connected=legs.every(leg=>{
      if(!leg||leg.departure==null&&leg.arrival==null)return true;
      if(!validTime(leg.departure)||!validTime(leg.arrival))return false;
      const start=Date.parse(leg.departure),end=Date.parse(leg.arrival);
      if(start<previousArrival||end<=start||end>arrival)return false;
      // A walking connection must allow enough time to cover its GPS distance.
      if(leg.mode==='wa_wal'){
        const gpsDistance=point(leg.fromPoint)&&point(leg.toPoint)?metres(leg.fromPoint,leg.toPoint):null;
        const reportedDistance=finite(leg.distanceMeters)&&leg.distanceMeters>=0?leg.distanceMeters:null;
        if(gpsDistance===null&&reportedDistance===null)return false;
        if(Math.max(gpsDistance??0,reportedDistance??0)>2*((end-start)/1000)+10)return false;
      }
      if(previousLeg&&previousLeg.mode!=='wa_wal'&&leg.mode!=='wa_wal'&&start-previousArrival<transferMinutes*60000)return false;
      if(previousLeg?.mode==='wa_wal'&&leg.mode!=='wa_wal'&&start-previousArrival<boardingMinutes*60000)return false;
      // A transfer with missing GPS cannot be certified, even if stop names match.
      if(previousLeg&&(!point(previousPoint)||!point(leg.fromPoint)))return false;
      if(previousPoint&&point(leg.fromPoint)&&metres(previousPoint,leg.fromPoint)>10)return false;
      previousPoint=point(leg.toPoint)?leg.toPoint:null;
      previousArrival=end;
      previousLeg=leg;
      return true;
    });
    const allTimed=legs.length>0&&legs.every(leg=>leg&&validTime(leg.departure)&&validTime(leg.arrival));
    const boundsMatch=!allTimed||(Date.parse(legs[0].departure)===departure&&Date.parse(legs.at(-1).arrival)===arrival);
    const spatialEvidence=legs.length===1||legs.every(leg=>point(leg.fromPoint)&&point(leg.toPoint));
    const allVerified=legs.length>0&&connected&&boundsMatch&&(legs.length===1||allTimed)&&spatialEvidence&&legs.every(leg=>leg&&leg.serviceConfirmed===true);
    const doorToDoor=item.exactOrigin===true&&item.exactDestination===true;
    // A return journey has no pickup deadline; it still requires verified
    // door-to-door legs, access and a valid chronological itinerary.
    const returnJourney=opts.direction==='return';
    const feasible=valid&&deadlineValid&&allVerified&&doorToDoor&&item.accessVerified===true&&
      (returnJourney?(!Number.isFinite(deadline)||slack>=0):
        Number.isFinite(deadline)&&slack>=margin);
    return {...item,priceEUR:price,durationMinutes:valid?Math.ceil((arrival-departure)/60000):null,
      slackMinutes:slack,feasible,displayStatus:feasible?'Réalisable':'Transport non confirmé — vérifiez vous-même'};
  }
  function rank(items,opts={}){
    if(!opts||typeof opts!=='object')opts={};
    const enriched=(Array.isArray(items)?items:[]).filter(x=>x&&typeof x==='object'&&!Array.isArray(x)).map(x=>evaluate(x,opts));
    const valid=enriched.filter(x=>{
      if(x.durationMinutes===null)return false;
      // A malformed supplied deadline must not become an unrestricted search.
      if(opts.deadline!=null&&!validTime(opts.deadline))return false;
      // Return legs have no pickup margin. A supplied deadline still bounds arrival.
      if(opts.direction==='return')return x.slackMinutes===null||x.slackMinutes>=0;
      const minimum=opts.exactGPSReliable===true&&x.exactDestination===true&&x.accessVerified===true?5:15;
      const margin=finite(opts.marginMinutes)?Math.max(opts.marginMinutes,minimum):minimum;
      return x.slackMinutes===null||x.slackMinutes>=margin;
    });
    // Provider responses can arrive in any order. Keep equal-score choices stable
    // across refreshes without relying on arrival order or a locale-dependent sort.
    const stableKey=x=>[x.provider,x.id,x.departure,x.arrival].map(v=>String(v??'')).join('|');
    const stableCompare=(a,b)=>{
      const left=stableKey(a),right=stableKey(b);
      return left<right?-1:left>right?1:0;
    };
    const byPrice=(a,b)=>Number(b.feasible)-Number(a.feasible)||
      ((a.priceEUR??Infinity)===(b.priceEUR??Infinity)?0:(a.priceEUR??Infinity)-(b.priceEUR??Infinity))||a.durationMinutes-b.durationMinutes||stableCompare(a,b);
    const byDuration=(a,b)=>Number(b.feasible)-Number(a.feasible)||
      a.durationMinutes-b.durationMinutes||
      ((a.priceEUR??Infinity)===(b.priceEUR??Infinity)?0:(a.priceEUR??Infinity)-(b.priceEUR??Infinity))||stableCompare(a,b);
    const priced=valid.filter(x=>x.priceEUR!==null);
    const cheapest=[...priced].sort(byPrice)[0];
    const fastest=[...valid].sort(byDuration)[0];
    const compromise=[...valid].sort((a,b)=>{
      const score=x=>{
        const price=x.priceEUR===null?100000:x.priceEUR;
        const safety=x.slackMinutes===null?100:Math.max(0,45-x.slackMinutes)*2;
        return price+safety+x.durationMinutes/20;
      };
      return Number(b.feasible)-Number(a.feasible)||score(a)-score(b)||stableCompare(a,b);
    })[0];
    const unique=[];for(const [label,journey] of [['Moins cher',cheapest],['Compromis',compromise],['Plus rapide',fastest]]){
      if(journey&&!unique.some(x=>x.journey===journey))unique.push({label,journey});
    }
    return unique;
  }
  // Join two already discovered stop-to-stop journeys at the same GPS stop.
  // No walking connector is invented: different stops require a routed walk.
  // The combined candidate remains unverified until independently checked.
  function connectJourneys(first,second,opts={}){
    if(!first||!second||typeof first!=='object'||typeof second!=='object')return null;
    const a=Array.isArray(first.legs)?first.legs:[],b=Array.isArray(second.legs)?second.legs:[];
    if(!a.length||!b.length||!a.every(l=>l&&validTime(l.departure)&&validTime(l.arrival))||
      !b.every(l=>l&&validTime(l.departure)&&validTime(l.arrival)))return null;
    if(!validTime(first.departure)||!validTime(first.arrival)||
      !validTime(second.departure)||!validTime(second.arrival))return null;
    if(Date.parse(a[0].departure)!==Date.parse(first.departure)||
      Date.parse(a[a.length-1].arrival)!==Date.parse(first.arrival)||
      Date.parse(b[0].departure)!==Date.parse(second.departure)||
      Date.parse(b[b.length-1].arrival)!==Date.parse(second.arrival))return null;
    // Reject internally inconsistent provider legs before composing a new itinerary.
    const ordered=legs=>legs.every((leg,index)=>{
      const start=Date.parse(leg.departure),end=Date.parse(leg.arrival);
      return end>start&&(index===0||start>=Date.parse(legs[index-1].arrival));
    });
    if(!ordered(a)||!ordered(b))return null;
    const arrival=Date.parse(first.arrival),departure=Date.parse(second.departure);
    const transfer=finite(opts.minTransferMinutes)?Math.max(0,opts.minTransferMinutes):3;
    if(departure-arrival<transfer*60000)return null;
    const end=a[a.length-1].toPoint,start=b[0].fromPoint;
    if(!point(end)||!point(start))return null;
    const sameStop=metres(end,start)<=10;
    // Distinct stops require an independently routed, timed walking segment.
    // Coordinates alone never imply a pedestrian path or walking duration.
    let walking=null;
    if(!sameStop){
      const walk=opts.walkingConnection;
      if(!walk||walk.mode!=='wa_wal'||walk.routeVerified!==true||
        !validTime(walk.departure)||!validTime(walk.arrival)||
        !/(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(walk.departure)||
        !/(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(walk.arrival)||
        !point(walk.fromPoint)||!point(walk.toPoint)||
        metres(end,walk.fromPoint)>10||metres(start,walk.toPoint)>10||
        Date.parse(walk.departure)<arrival||
        Date.parse(walk.arrival)>departure||
        Date.parse(walk.arrival)<=Date.parse(walk.departure)||
        !finite(walk.distanceMeters)||walk.distanceMeters<0||
        // A routed walk must be at least the straight-line distance.
        walk.distanceMeters+10<metres(walk.fromPoint,walk.toPoint)||
        walk.distanceMeters>2*((Date.parse(walk.arrival)-Date.parse(walk.departure))/1000)+10||
        departure-Date.parse(walk.arrival)<60000)return null;
      walking={...walk,serviceConfirmed:false};
    }
    const candidate={
      id:String(first.id??'regional')+'+'+String(second.id??'long-distance'),
      provider:'Multiréseau',departure:first.departure,arrival:second.arrival,
      legs:[...a,...(walking?[walking]:[]),...b],priceEUR:null,fareVerified:false,
      exactOrigin:first.exactOrigin===true,exactDestination:second.exactDestination===true,
      accessVerified:false,serviceConfirmed:false,
      source:'Correspondance multiréseau à vérifier',
      detailStatus:'Circulation, tarifs, accès et correspondance à confirmer'
    };
    return evaluate(candidate,opts).durationMinutes===null?null:candidate;
  }
  const api={evaluate,rank,connectJourneys};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CPTransportRanking=api;
})(typeof window!=='undefined'?window:globalThis);
