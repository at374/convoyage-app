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
        serviceConfirmed:false
      })),
      source:'SNCF GTFS théorique',
      fareStatus:'Prix non vérifié',
      detailStatus:'Accès aux gares, correspondances et circulation réelle à vérifier'
    }));
  }
  const api={adaptSNCF};
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.CPTransportAdapters=Object.assign(root.CPTransportAdapters||{},api);
})(typeof window!=='undefined'?window:globalThis);
