/* Convoyage Ultra — tarif 1 voyage Cars Région Isère, grille officielle du 01/03/2026.
 * Ne fournit aucun tarif à partir des seules communes ou coordonnées GPS.
 * Les zones doivent être attestées pour le trajet complet (y compris zones intermédiaires).
 * Source : https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/03/cars_region_isere_tarifs_20260301.pdf (p. 6)
 */
(function(root){
'use strict';
const SOURCE='https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/03/cars_region_isere_tarifs_20260301.pdf';
const VALID_FROM='2026-03-01';
// Fin de validité de cette grille millésimée : ne jamais extrapoler les prix 2026.
const VALID_THROUGH='2026-12-31';
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
 // N'accepter qu'une date ISO complète ou une date-heure ISO, jamais un préfixe arbitraire.
 if(typeof departure!=='string'||!/^\d{4}-\d{2}-\d{2}(?:$|T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$)/.test(departure)||
  !Number.isFinite(Date.parse(date+'T00:00:00Z'))||
  new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||
  date<VALID_FROM||date>VALID_THROUGH)return null;
 // Date.parse du jour seul ne valide pas les heures : contrôler séparément HH:mm:ss et fuseau.
 const clock=/T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|([+-])(\d{2}):(\d{2}))?$/.exec(departure);
 if(clock&&(Number(clock[1])>23||Number(clock[2])>59||Number(clock[3]||0)>59||
  (clock[5]!==undefined&&(Number(clock[5])>23||Number(clock[6])>59))))return null;
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
  source:SOURCE,zoneSource:zoneEvidence.source,validFrom:VALID_FROM,validThrough:VALID_THROUGH};
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
// Audit des arrêts réellement nécessaires : prépare l'import du référentiel officiel
// sans jamais transformer les communes, les coordonnées ou zone_id GTFS en tarifs.
function auditGTFSZones(index,stopZones){
 if(!index||!(index.timesByTrip instanceof Map)||!(index.stopById instanceof Map)||
  !stopZones||typeof stopZones!=='object'||Array.isArray(stopZones))return null;
 const used=new Set();
 for(const times of index.timesByTrip.values())for(const t of times||[]){
  if(typeof t?.stop_id==='string'&&t.stop_id)used.add(t.stop_id);
 }
 const covered=[],missing=[],invalid=[];
 for(const id of [...used].sort()){
  const value=Object.prototype.hasOwnProperty.call(stopZones,id)?stopZones[id]:undefined;
  if(value===undefined)missing.push(id);
  else if(typeof value!=='string'||!/^(A|B|C|D|E|RH|S|HT1|HT2)$/.test(value))invalid.push(id);
  else covered.push(id);
 }
 return {total:used.size,covered:covered.length,missing,invalid,
  coveragePercent:used.size?Math.round(10000*covered.length/used.size)/100:0};
}
// Audit par course et par paire d'arrêts : la couverture des arrêts isolés
// ne suffit pas à prouver qu'un voyage complet est tarifable.
function auditGTFSJourneys(index,journeys,{stopZones,source}={}){
 if(!Array.isArray(journeys))return null;
 const result={total:0,priced:0,missingZone:0,ambiguous:0,invalidJourney:0};
 for(const row of journeys){
  result.total++;
  const tripId=row?.tripId,fromStopId=row?.fromStopId||row?.originStop?.stopId||row?.originStop?.stop_id||row?.from;
  const toStopId=row?.toStopId||row?.destinationStop?.stopId||row?.destinationStop?.stop_id||row?.to;
  if(typeof tripId!=='string'||typeof fromStopId!=='string'||typeof toStopId!=='string'){
   result.invalidJourney++;continue;
  }
  const times=index?.timesByTrip instanceof Map?index.timesByTrip.get(tripId):null;
  if(!Array.isArray(times)||times.length<2){result.invalidJourney++;continue;}
  const starts=times.map((t,i)=>t?.stop_id===fromStopId?i:-1).filter(i=>i>=0);
  const ends=times.map((t,i)=>t?.stop_id===toStopId?i:-1).filter(i=>i>=0);
  if(starts.length!==1||ends.length!==1||starts[0]>=ends[0]){result.ambiguous++;continue;}
  if(evidenceFromGTFS(index,{tripId,fromStopId,toStopId,stopZones,source}))result.priced++;
  else result.missingZone++;
 }
 return {...result,coveragePercent:result.total?Math.round(10000*result.priced/result.total)/100:0};
}
// Référentiel importé : chaque ligne doit être rattachée à un stop_id GTFS exact.
// Ne jamais fabriquer une correspondance par rapprochement du nom d'une commune.
function validateOfficialStopZones(index,reference){
 if(!index||!(index.stopById instanceof Map)||!reference||reference.verified!==true||
  typeof reference.source!=='string'||
  !/^https:\/\/(?:www\.)?(?:laregionvoustransporte\.fr|carsisere\.auvergnerhonealpes\.fr|data\.auvergnerhonealpes\.fr)(?:\/|$)/i.test(reference.source)||
  !reference.stopZones||typeof reference.stopZones!=='object'||Array.isArray(reference.stopZones))return null;
 const clean=Object.create(null),unknown=[],invalid=[];
 // Un référentiel vide n'atteste aucune zone et ne doit pas être déclaré disponible.
 if(Object.keys(reference.stopZones).length===0)return {valid:false,unknown:[],invalid:[],stopZones:null};
 for(const [id,zone] of Object.entries(reference.stopZones)){
  if(!index.stopById.has(id)){unknown.push(id);continue;}
  if(typeof zone!=='string'||!/^(A|B|C|D|E|RH|S|HT1|HT2)$/.test(zone)){
   invalid.push(id);continue;
  }
  clean[id]=zone;
 }
 // Rejeter intégralement un fichier contenant des identifiants inconnus ou des zones erronées.
 if(unknown.length||invalid.length)return {valid:false,unknown,invalid,stopZones:null};
 return {valid:true,unknown:[],invalid:[],stopZones:clean,source:reference.source};
}
const api={quote,quoteFromStops,evidenceFromStops,evidenceFromGTFS,auditGTFSZones,auditGTFSJourneys,validateOfficialStopZones,SOURCE,FULL,ECO,VALID_FROM,VALID_THROUGH};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPIsereZonalFares=api;
})(typeof window!=='undefined'?window:globalThis);
