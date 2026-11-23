/* Convoyage Ultra — tarif 1 voyage Cars Région Isère, grille officielle du 01/03/2026.
 * Ne fournit aucun tarif à partir des seules communes ou coordonnées GPS.
 * Les zones doivent être attestées pour le trajet complet (y compris zones intermédiaires).
 * Source : https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/03/cars_region_isere_tarifs_20260301.pdf (p. 6)
 */
(function(root){
'use strict';
const SOURCE='https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/03/cars_region_isere_tarifs_20260301.pdf';
const VALID_FROM='2026-03-01';
const FULL=[null,4.30,6.00,7.70,9.40,11.10,12.80];
const ECO=[null,3.20,4.40,5.60,6.80,8.00,9.20];
// Prépare une preuve depuis la séquence COMPLÈTE des arrêts réellement parcourus.
// La correspondance stop_id -> zone doit provenir d'une table officielle contrôlée,
// pas d'une déduction par coordonnées ou par commune supposée.
function evidenceFromStops({stopIds,stopZones,source,complete=false}={}){
 if(complete!==true||!Array.isArray(stopIds)||stopIds.length<2||
  !stopZones||typeof stopZones!=='object'||Array.isArray(stopZones)||
  typeof source!=='string'||!/^https:\/\//.test(source))return null;
 // Ne pas confondre une URL quelconque avec une attestation de zones.
 // Les zones doivent être certifiées par le référentiel officiel et sa version.
 if(!/^https:\/\/(?:www\.)?(?:laregionvoustransporte\.fr|carsisere\.auvergnerhonealpes\.fr|data\.auvergnerhonealpes\.fr)(?:\/|$)/i.test(source))return null;
 const traversedZones=[];
 for(const id of stopIds){
  if(typeof id!=='string'||!id.trim()||!Object.prototype.hasOwnProperty.call(stopZones,id))return null;
  const zone=stopZones[id];
  if(typeof zone!=='string'||!/^(A|B|C|D|E|RH|S|HT1|HT2)$/.test(zone))return null;
  if(!traversedZones.includes(zone))traversedZones.push(zone);
 }
 if(traversedZones.length>6)return null;
 return {verified:true,traversedZones,source,stopIds:stopIds.slice()};
}
function quote({zones,departure,profile='full',zoneEvidence,ecoEligible=false,network='Cars Région Isère',line=null}={}){
 if(!Number.isInteger(zones)||zones<1||zones>6)return null;
 if(network!=='Cars Région Isère'||/transaltitude/i.test(String(line||'')))return null;
 // Le profil Éco est réservé aux moins de 26 ans ; ne jamais l'appliquer par défaut.
 if(profile==='eco'&&ecoEligible!==true)return null;
 const date=typeof departure==='string'?departure.slice(0,10):'';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<VALID_FROM)return null;
 // Preuve obligatoire : liste ordonnée des zones effectivement traversées, issue d'un référentiel.
 if(!zoneEvidence||zoneEvidence.verified!==true||!Array.isArray(zoneEvidence.traversedZones)||
  zoneEvidence.traversedZones.length!==zones||
  new Set(zoneEvidence.traversedZones).size!==zones||
  !zoneEvidence.traversedZones.every(z=>typeof z==='string'&&/^(A|B|C|D|E|RH|S|HT1|HT2)$/.test(z))||
  typeof zoneEvidence.source!=='string'||!/^https:\/\/(?:www\.)?(?:laregionvoustransporte\.fr|carsisere\.auvergnerhonealpes\.fr|data\.auvergnerhonealpes\.fr)(?:\/|$)/i.test(zoneEvidence.source)||!Array.isArray(zoneEvidence.stopIds)||zoneEvidence.stopIds.length<2||!zoneEvidence.stopIds.every(id=>typeof id==='string'&&id.trim()))return null;
 const table=profile==='full'?FULL:profile==='eco'?ECO:null;
 if(!table)return null;
 return {amount:table[zones],currency:'EUR',zones,profile,validityMinutes:zones===1?60:zones===2?90:120,
  product:'Cars Région Isère · 1 voyage · '+zones+' zone'+(zones>1?'s':'')+(profile==='eco'?' · Éco moins de 26 ans':''),
  source:SOURCE,zoneSource:zoneEvidence.source,validFrom:VALID_FROM};
}
// Ne calcule que sur une séquence de tous les arrêts parcourus, fournie par le moteur GTFS.
// Si le moteur ne peut pas garantir l'exhaustivité, aucune tarification n'est produite.
function quoteFromStops({stopIds,stopZones,source,complete=false,departure,profile='full',ecoEligible=false,network='Cars Région Isère',line=null}={}){
 const zoneEvidence=evidenceFromStops({stopIds,stopZones,source,complete});
 if(!zoneEvidence)return null;
 return quote({zones:zoneEvidence.traversedZones.length,departure,profile,ecoEligible,network,line,zoneEvidence});
}
// Extrait la séquence parcourue d'un index GTFS réel : ne pas confondre
// arrêts d'origine/destination et toutes les zones intermédiaires.
function evidenceFromGTFS(index,{tripId,fromStopId,toStopId,stopZones,source}={}){
 if(!index||!(index.timesByTrip instanceof Map)||typeof tripId!=='string'||
  typeof fromStopId!=='string'||typeof toStopId!=='string'||fromStopId===toStopId)return null;
 const times=index.timesByTrip.get(tripId);
 if(!Array.isArray(times)||times.length<2)return null;
 const origins=[],destinations=[];
 for(let i=0;i<times.length;i++){
  if(times[i]?.stop_id===fromStopId)origins.push(i);
  if(times[i]?.stop_id===toStopId)destinations.push(i);
 }
 // Boucles GTFS : sans indices d'embarquement/débarquement non ambigus, refuser.
 if(origins.length!==1||destinations.length!==1||origins[0]>=destinations[0])return null;
 const slice=times.slice(origins[0],destinations[0]+1);
 if(slice.some((t,i)=>!t||typeof t.stop_id!=='string'||
  !Number.isFinite(Number(t.stop_sequence))||
  (i>0&&Number(t.stop_sequence)<=Number(slice[i-1].stop_sequence))))return null;
 return evidenceFromStops({stopIds:slice.map(t=>t.stop_id),stopZones,source,complete:true});
}
const api={quote,quoteFromStops,evidenceFromStops,evidenceFromGTFS,SOURCE,FULL,ECO,VALID_FROM};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPIsereZonalFares=api;
})(typeof window!=='undefined'?window:globalThis);
