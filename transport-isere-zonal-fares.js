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
  typeof zoneEvidence.source!=='string'||!/^https:\/\//.test(zoneEvidence.source))return null;
 const table=profile==='full'?FULL:profile==='eco'?ECO:null;
 if(!table)return null;
 return {amount:table[zones],currency:'EUR',zones,profile,validityMinutes:zones===1?60:zones===2?90:120,
  product:'Cars Région Isère · 1 voyage · '+zones+' zone'+(zones>1?'s':'')+(profile==='eco'?' · Éco moins de 26 ans':''),
  source:SOURCE,zoneSource:zoneEvidence.source,validFrom:VALID_FROM};
}
const api={quote,SOURCE,FULL,ECO,VALID_FROM};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPIsereZonalFares=api;
})(typeof window!=='undefined'?window:globalThis);
