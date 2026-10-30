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
        verifiedPriceEUR:leg.verifiedPriceEUR,
        fareVerified:leg.fareVerified===true,
        fareSource:leg.fareSource||null,
        fareValidFrom:leg.fareValidFrom||null,
        fareValidUntil:leg.fareValidUntil||null,
        passAccepted:leg.passAccepted===true,
        passProduct:leg.passProduct||null,
        passEligibilityVerified:leg.passEligibilityVerified===true,
        passEligibilitySource:leg.passEligibilitySource||null,
        passValidFrom:leg.passValidFrom||null,
        passValidUntil:leg.passValidUntil||null
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
        fareVerified:leg.fareVerified===true,
        fareSource:leg.fareSource||null,
        fareValidFrom:leg.fareValidFrom||null,
        fareValidUntil:leg.fareValidUntil||null,
        passAccepted:leg.passAccepted===true,
        passProduct:leg.passProduct||null,
        passEligibilityVerified:leg.passEligibilityVerified===true,
        passEligibilitySource:leg.passEligibilitySource||null,
        passValidFrom:leg.passValidFrom||null,
        passValidUntil:leg.passValidUntil||null
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
    return Number.isFinite(ms)?new Date(ms).toISOString():null;
  }
  function adaptRegional(itineraries,provider){
    return adaptGTFS((Array.isArray(itineraries)?itineraries:[]).map(it=>({
      departure:toISO(it.startTime),
      arrival:toISO(it.endTime),
      legs:Array.isArray(it.legs)?it.legs:[]
    })),provider||'Régional');
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
  const api={adaptSNCF,adaptGTFS,adaptRegional,withVerifiedFares};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CPTransportAdapters=Object.assign(root.CPTransportAdapters||{},api);
})(typeof window!=='undefined'?window:globalThis);
