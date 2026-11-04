/* Read-only adapter for theoretical SNCF station-to-station itineraries.
 * Never invent a fare, confirmed service, door-to-door access or walking time.
 */
(function(root){
  'use strict';
  function safeStopPoint(p){
    if(!p||typeof p!=='object'||Array.isArray(p)||
      typeof p.lat!=='number'||!Number.isFinite(p.lat)||Math.abs(p.lat)>90)return null;
    const lon=p.lon??p.lng;
    return typeof lon==='number'&&Number.isFinite(lon)&&Math.abs(lon)<=180?{lat:p.lat,lon}:null;
  }
  function adaptSNCF(itineraries){
    return (Array.isArray(itineraries)?itineraries:[]).filter(it=>it&&typeof it==='object'&&!Array.isArray(it)).map((it,index)=>({
      id:'sncf-theoretical-'+index,
      provider:'SNCF',
      departure:it.departure,
      arrival:it.arrival,
      priceEUR:null,
      exactOrigin:false,
      exactDestination:false,
      accessVerified:false,
      legs:(Array.isArray(it.legs)?it.legs:[]).filter(leg=>leg&&typeof leg==='object'&&!Array.isArray(leg)).map(leg=>({
        provider:'SNCF',
        line:leg.line||null,
        from:leg.from||null,
        to:leg.to||null,
        departure:leg.departure,
        arrival:leg.arrival,
        fromPoint:safeStopPoint(leg.fromPoint),
        toPoint:safeStopPoint(leg.toPoint),
        fromStopCode:typeof leg.fromStopCode==='string'&&leg.fromStopCode.trim()?leg.fromStopCode.trim():null,
        toStopCode:typeof leg.toStopCode==='string'&&leg.toStopCode.trim()?leg.toStopCode.trim():null,
        serviceTripId:typeof leg.serviceTripId==='string'&&leg.serviceTripId.trim()?leg.serviceTripId.trim():null,
        routeId:typeof leg.routeId==='string'&&leg.routeId.trim()?leg.routeId.trim():null,
        serviceConfirmed:false,
        // Raw GTFS/SNCF feeds cannot certify tariffs by self-declaration.
        verifiedPriceEUR:null,
        fareVerified:false,
        fareSource:null,
        fareValidFrom:null,
        fareValidUntil:null,
        passAccepted:false,
        passProduct:null,
        passEligibilityVerified:false,
        passEligibilitySource:null,
        passValidFrom:null,
        passValidUntil:null
      })),
      source:'SNCF GTFS théorique',
      fareStatus:'Prix non vérifié',
      detailStatus:'Accès aux gares, correspondances et circulation réelle à vérifier'
    }));
  }
  /* Generic GTFS stop-to-stop results: conservative until a provider verifies
   * exact addresses, access, operating service and fares independently.
   */
  function adaptGTFS(itineraries,provider){
    const name=typeof provider==='string'&&provider.trim()?provider.trim():'Réseau GTFS';
    return (Array.isArray(itineraries)?itineraries:[]).filter(it=>it&&typeof it==='object'&&!Array.isArray(it)).map((it,index)=>({
      id:'gtfs-'+index,
      provider:name,
      departure:it.departure,
      arrival:it.arrival,
      priceEUR:null,
      exactOrigin:false,
      exactDestination:false,
      accessVerified:false,
      legs:(Array.isArray(it.legs)?it.legs:[]).filter(leg=>leg&&typeof leg==='object'&&!Array.isArray(leg)).map(leg=>({
        provider:name,
        line:leg.line||leg.route||null,
        from:leg.from||leg.fromStop||null,
        to:leg.to||leg.toStop||null,
        departure:leg.departure,
        arrival:leg.arrival,
        fromPoint:safeStopPoint(leg.fromPoint),
        toPoint:safeStopPoint(leg.toPoint),
        fromStopCode:typeof leg.fromStopCode==='string'&&leg.fromStopCode.trim()?leg.fromStopCode.trim():null,
        toStopCode:typeof leg.toStopCode==='string'&&leg.toStopCode.trim()?leg.toStopCode.trim():null,
        serviceTripId:typeof leg.serviceTripId==='string'&&leg.serviceTripId.trim()?leg.serviceTripId.trim():null,
        routeId:typeof leg.routeId==='string'&&leg.routeId.trim()?leg.routeId.trim():null,
        serviceConfirmed:false,
        verifiedPriceEUR:leg.verifiedPriceEUR,
        fareVerified:false,
        fareSource:null,
        fareValidFrom:null,
        fareValidUntil:null,
        passAccepted:false,
        passProduct:null,
        passEligibilityVerified:false,
        passEligibilitySource:null,
        passValidFrom:null,
        passValidUntil:null
      })),
      source:name+' GTFS théorique',
      fareStatus:'Prix non vérifié',
      detailStatus:'Accès aux arrêts, correspondances et circulation réelle à vérifier'
    }));
  }
  // A timestamp may be an epoch millisecond number or an ISO string.
  // Invalid values must not become 1970 dates.
  function toISO(value){
    // Reject local-time and date-only strings: parsing them depends on the host timezone.
    const explicitZone=typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value);
    const offset=explicitZone?value.match(/([+-])(\d{2}):(\d{2})$/):null;
    const validOffset=!offset||Number(offset[2])!==14||Number(offset[3])===0;
    const validDay=explicitZone&&Number.isFinite(Date.parse(value.slice(0,10)+'T12:00:00Z'))&&
      new Date(value.slice(0,10)+'T12:00:00Z').toISOString().slice(0,10)===value.slice(0,10);
    const ms=typeof value==='number'?value:
      explicitZone&&validOffset&&validDay?Date.parse(value):NaN;
    return Number.isFinite(ms)&&Math.abs(ms)<=8640000000000000?new Date(ms).toISOString():null;
  }
  function adaptRegional(itineraries,provider){
    return adaptGTFS((Array.isArray(itineraries)?itineraries:[]).filter(it=>it&&typeof it==='object'&&!Array.isArray(it)).map(it=>({
      departure:toISO(it.startTime),
      arrival:toISO(it.endTime),
      legs:(Array.isArray(it.legs)?it.legs:[]).filter(leg=>leg&&typeof leg==='object'&&!Array.isArray(leg)).map(leg=>({
        ...leg,
        departure:toISO(leg.departure??leg.startTime),
        arrival:toISO(leg.arrival??leg.endTime)
      }))
    })),provider||'Régional');
  }
  // Normalize externally retrieved long-distance offers without claiming a live search.
  // A provider result is only a candidate until availability, address access and price are verified.
  function adaptLongDistance(offers,provider){
    if(!['FlixBus','BlaBlaCar','BlaBlaCar Bus'].includes(provider))throw new Error('Unsupported long-distance provider');
    return (Array.isArray(offers)?offers:[]).filter(o=>o&&typeof o==='object'&&!Array.isArray(o)).flatMap((o,index)=>{
      const departure=toISO(o.departure),arrival=toISO(o.arrival);
      if(!departure||!arrival||Date.parse(arrival)<=Date.parse(departure))return [];
      const from=typeof o.from==='string'&&o.from.trim()?o.from.trim():null;
      const to=typeof o.to==='string'&&o.to.trim()?o.to.trim():null;
      if(!from||!to)return [];
      const validPoint=p=>p&&typeof p==='object'&&!Array.isArray(p)&&
        typeof p.lat==='number'&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&
        typeof (p.lon??p.lng)==='number'&&Number.isFinite(p.lon??p.lng)&&Math.abs(p.lon??p.lng)<=180;
      const normalizedPoint=p=>validPoint(p)?{lat:p.lat,lon:p.lon??p.lng}:null;
      const leg={provider,line:typeof o.line==='string'?o.line:null,from,to,departure,arrival,
        fromPoint:normalizedPoint(o.fromPoint),toPoint:normalizedPoint(o.toPoint),
        serviceTripId:typeof o.serviceTripId==='string'?o.serviceTripId:null,
        routeId:typeof o.routeId==='string'?o.routeId:null,
        fromStopCode:typeof o.fromStopCode==='string'?o.fromStopCode:null,
        toStopCode:typeof o.toStopCode==='string'?o.toStopCode:null,
        serviceConfirmed:false,verifiedPriceEUR:null,fareVerified:false,fareSource:null,
        fareValidFrom:null,fareValidUntil:null,passAccepted:false,passProduct:null,
        passEligibilityVerified:false,passEligibilitySource:null,passValidFrom:null,passValidUntil:null};
      return [{id:provider.toLowerCase().replace(/\s+/g,'-')+'-candidate-'+index,
        provider,departure,arrival,legs:[leg],priceEUR:null,exactOrigin:false,
        exactDestination:false,accessVerified:false,serviceConfirmed:false,
        source:provider+' — offre externe non confirmée',fareStatus:'Prix non vérifié',
        detailStatus:'Disponibilité, tarif, points de rendez-vous et circulation à vérifier'}];
    });
  }
  // Fare evidence is injected only after adapting untrusted schedule feeds.
  // Each item must identify the itinerary, leg index and exact departure.
  function applyFareEvidence(journeys,evidence=[]){
    const records=Array.isArray(evidence)?evidence:[];
    return (Array.isArray(journeys)?journeys:[]).filter(journey=>journey&&typeof journey==='object'&&!Array.isArray(journey)).map(journey=>({
      ...journey,
      legs:(Array.isArray(journey.legs)?journey.legs:[]).map((leg,index)=>{
        if(!leg||typeof leg!=='object'||Array.isArray(leg))return leg;
        const match=records.find(item=>item&&item.journeyId===journey.id&&
          item.legIndex===index&&item.departure===leg.departure&&
          item.provider===leg.provider&&item.line===leg.line&&
          item.from===leg.from&&item.to===leg.to&&
          item.arrival===leg.arrival&&
          item.fareVerified===true&&typeof item.fareSource==='string'&&
          item.fareSource.trim()&&Number.isFinite(item.verifiedPriceEUR)&&
          item.verifiedPriceEUR>=0&&item.fareValidFrom&&item.fareValidUntil&&
          Number.isFinite(Date.parse(item.fareValidFrom))&&
          Number.isFinite(Date.parse(item.fareValidUntil))&&
          Date.parse(item.fareValidFrom)<=Date.parse(leg.departure)&&
          Date.parse(leg.departure)<=Date.parse(item.fareValidUntil)&&
          (!item.fareRetrievedAt || (Number.isFinite(Date.parse(item.fareRetrievedAt))&&
          Date.parse(item.fareRetrievedAt)<=Date.now())));
        return match?{...leg,verifiedPriceEUR:match.verifiedPriceEUR,
          fareVerified:true,fareSource:match.fareSource,
          fareRetrievedAt:match.fareRetrievedAt||null,
          fareValidFrom:match.fareValidFrom,fareValidUntil:match.fareValidUntil}:leg;
      })
    }));
  }
  function withVerifiedFares(journeys,options={}){
    if(!options||typeof options!=='object'||Array.isArray(options))options={};
    const calculator=root.CPTransportFares;
    return (Array.isArray(journeys)?journeys:[]).filter(journey=>journey&&typeof journey==='object'&&!Array.isArray(journey)).map(journey=>{
      if(!calculator||typeof calculator.fare!=='function')
        return {...journey,priceEUR:null,fareStatus:'Tarif non vérifié'};
      const result=calculator.fare(journey.legs,{...options,travelDate:options.travelDate||journey.departure});
      return {...journey,priceEUR:result.known?result.totalEUR:null,
        fareStatus:result.status,fareBreakdown:result.breakdown};
    });
  }
  const api={adaptSNCF,adaptGTFS,adaptRegional,adaptLongDistance,applyFareEvidence,withVerifiedFares};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CPTransportAdapters=Object.assign(root.CPTransportAdapters||{},api);
})(typeof window!=='undefined'?window:globalThis);
