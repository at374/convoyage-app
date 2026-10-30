/* Read-only adapter for theoretical SNCF station-to-station itineraries.
 * Never invent a fare, confirmed service, door-to-door access or walking time.
 */
(function(root){
  'use strict';
  function adaptSNCF(itineraries){
    return (Array.isArray(itineraries)?itineraries:[]).map((it,index)=>({
      id:'sncf-theoretical-'+index,
      provider:'SNCF',
      departure:it.departure,
      arrival:it.arrival,
      priceEUR:null,
      exactOrigin:false,
      exactDestination:false,
      accessVerified:false,
      legs:(Array.isArray(it.legs)?it.legs:[]).map(leg=>({
        provider:'SNCF',
        line:leg.line||null,
        from:leg.from||null,
        to:leg.to||null,
        departure:leg.departure,
        arrival:leg.arrival,
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
    return (Array.isArray(itineraries)?itineraries:[]).map((it,index)=>({
      id:'gtfs-'+index,
      provider:name,
      departure:it.departure,
      arrival:it.arrival,
      priceEUR:null,
      exactOrigin:false,
      exactDestination:false,
      accessVerified:false,
      legs:(Array.isArray(it.legs)?it.legs:[]).map(leg=>({
        provider:name,
        line:leg.line||leg.route||null,
        from:leg.from||leg.fromStop||null,
        to:leg.to||leg.toStop||null,
        departure:leg.departure,
        arrival:leg.arrival,
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
    const ms=typeof value==='number'?value:
      typeof value==='string'?Date.parse(value):NaN;
    return Number.isFinite(ms)&&Math.abs(ms)<=8640000000000000?new Date(ms).toISOString():null;
  }
  function adaptRegional(itineraries,provider){
    return adaptGTFS((Array.isArray(itineraries)?itineraries:[]).map(it=>({
      departure:toISO(it.startTime),
      arrival:toISO(it.endTime),
      legs:(Array.isArray(it.legs)?it.legs:[]).map(leg=>({
        ...leg,
        departure:toISO(leg.departure??leg.startTime),
        arrival:toISO(leg.arrival??leg.endTime)
      }))
    })),provider||'Régional');
  }
  // Fare evidence is injected only after adapting untrusted schedule feeds.
  // Each item must identify the itinerary, leg index and exact departure.
  function applyFareEvidence(journeys,evidence=[]){
    const records=Array.isArray(evidence)?evidence:[];
    return (Array.isArray(journeys)?journeys:[]).map(journey=>({
      ...journey,
      legs:(Array.isArray(journey.legs)?journey.legs:[]).map((leg,index)=>{
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
    const calculator=root.CPTransportFares;
    return (Array.isArray(journeys)?journeys:[]).map(journey=>{
      if(!calculator||typeof calculator.fare!=='function')
        return {...journey,priceEUR:null,fareStatus:'Tarif non vérifié'};
      const result=calculator.fare(journey.legs,{...options,travelDate:options.travelDate||journey.departure});
      return {...journey,priceEUR:result.known?result.totalEUR:null,
        fareStatus:result.status,fareBreakdown:result.breakdown};
    });
  }
  const api={adaptSNCF,adaptGTFS,adaptRegional,applyFareEvidence,withVerifiedFares};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CPTransportAdapters=Object.assign(root.CPTransportAdapters||{},api);
})(typeof window!=='undefined'?window:globalThis);
