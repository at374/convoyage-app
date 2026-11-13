/* Convoyage Ultra — registre des tarifs officiels prouvés (EUR / CHF).
 * Un tarif n'est appliqué que si : réseau identifié EXPLICITEMENT par le fournisseur (nom d'opérateur),
 * mode compatible, période de validité couvrant la date du trajet, source officielle datée.
 * Aucun tarif zonal n'est appliqué sans preuve de zone. Registre vide = « Prix à confirmer ».
 * Pour ajouter une grille : une entrée par titre « 1 voyage » plein tarif, vérifiée sur le site officiel.
 */
(function(root){
'use strict';
// Entrées vérifiées uniquement. Laisser vide plutôt qu'approximatif.
const GRIDS=[
 // Sibra (Grand Annecy) : CGV « Règlement bus et cars 2026/2027 », gamme applicable à partir du 01/07/2026
 // sur l'ensemble du réseau : 1 voyage vendu sans support (rechargement / achat digital) 2,00 € ; à bord 2,50 € ;
 // valable 1 h, correspondances comprises. Vérifié le 13/11/2026.
 {network:'Sibra',operatorPattern:'^sibra$',modes:['Bus'],amount:2.00,currency:'EUR',
  product:'1 voyage (achat digital ou rechargement ; 2,50 € à bord), 1 h correspondances comprises',validityMinutes:60,
  validFrom:'2026-07-01',validUntil:'2027-06-30',source:'https://www.sibra.fr/app/uploads/2026/07/Reglement_BUS_CARS_CGV_01072026_3.pdf',
  checkedAt:'2026-11-13',flat:true},
 // M réso (Métropole grenobloise, Grésivaudan, Voironnais) : tarifs au 01/09/2026 (reso-m.fr) :
 // 1 voyage 2,00 € valable 1 h sur tout M réso, correspondances et retours compris ; 2,60 € à bord.
 // 2,00 € est toujours un prix valable ; un trajet entièrement intra-Grésivaudan peut coûter 1,00 €.
 {network:'M réso',operatorPattern:'^m\\s?r[ée]so\\b',modes:['Bus','Tram'],amount:2.00,currency:'EUR',
  product:'1 voyage 1 h, tout M réso (2,60 € à bord ; 1,00 € si trajet intra-Grésivaudan)',validityMinutes:60,
  validFrom:'2026-09-01',validUntil:'2027-08-31',source:'https://www.reso-m.fr/67-un-tarif-pour-chacun.htm',
  checkedAt:'2026-11-13',flat:true},
 // Ondéa Grand Lac (Aix-les-Bains) : « Titres pour tous - tarifs applicables du 1er juillet 2026 » (ondeagrandlac.fr) :
 // titre 1 voyage (M-Ticket, appli) 1,70 €, 1 h, correspondances autorisées. Non utilisable sur les lignes de
 // proximité/scolaires en car (100 à 105, 200 à 208, 301, 303, 304, 400…) : lignes numérotées ≥ 100 exclues.
 {network:'Ondéa',operatorPattern:'^ond[ée]a\\b',modes:['Bus'],amount:1.70,currency:'EUR',excludeLines:'^\\d{3,}$',
  product:'1 voyage M-Ticket (application Ondéa Grand Lac), 1 h',validityMinutes:60,
  validFrom:'2026-07-01',validUntil:'2027-06-30',source:'https://www.ondeagrandlac.fr/tarifs/choisir-son-titre',
  checkedAt:'2026-11-13',flat:true},
 // TAC Mobilités (Annemasse Agglo, zone 210) : « Guide des tarifs », TARIFS EN VIGUEUR AU 14/12/2025 (PDF de mars 2026,
 // files.tac-mobilites.fr, texte relu le 13/11/2026) : ticket unité valable 60 minutes 1,70 € (carte bancaire sans contact,
 // application, ou conducteur toutes lignes) ; 2,00 € auprès du conducteur à bord de la T1 ; tous transports de la zone 210
 // (bus, tram, TAD). Fin de validité prudente : 12/12/2026 (changement de service annuel).
 {network:'TAC',operatorPattern:'^tac\\b',modes:['Bus','Tram'],amount:1.70,currency:'EUR',
  product:'ticket unité 60 min, zone 210 (2,00 € auprès du conducteur de la T1)',validityMinutes:60,
  validFrom:'2025-12-14',validUntil:'2026-12-12',
  source:'https://files.tac-mobilites.fr/s3fs-public/documents/Guide%20des%20tarifs%20MARS%202026%20VF%20%28DIGITAL%29.pdf',
  checkedAt:'2026-11-13',flat:true},
 // Synchro Bus (Grand Chambéry) : délibération n° 080-25 C du 10/04/2025, « tarifs applicables à compter du
 // 7 juillet 2025 » : ticket 1 voyage 1,40 €, valable 1 h correspondance comprise (1,70 € vendu à bord en espèces
 // ou CB). Recherché le 13/11/2026 : aucune délibération de 2026 modifiant ce tarif n'a été trouvée (les actes de
 // 2026 trouvés — lignes Montagne 20/12/2025, achat de bus 26/02/2026 — ne touchent pas le ticket 1 voyage de base).
 // À revérifier si une révision « juillet 2026 » est publiée.
 {network:'Synchro',operatorPattern:'^synchro\\b',modes:['Bus'],amount:1.40,currency:'EUR',
  product:'1 voyage, 1 h correspondance comprise (1,70 € vendu à bord)',validityMinutes:60,
  validFrom:'2025-07-07',validUntil:'2026-12-31',
  source:'https://www.grandchambery.fr/fileadmin/mediatheque/Oxyad/DelmDec/indexdelm_20250410/Acte16655.pdf',
  checkedAt:'2026-11-13',flat:true},
 // TAM (Ambérieu-en-Bugey) : livret officiel TAM 2026, publié en février 2026 :
 // titre 1 voyage tout public 1,10 €, valable 1 h avec correspondance.
 // Document hébergé dans l'espace de publication des transports de l'Ain ; lignes urbaines TAM uniquement.
 {network:'TAM',operatorPattern:'^TAM(?:\\s+Amb[ée]rieu(?:-en-Bugey)?)?$',modes:['Bus'],amount:1.10,currency:'EUR',
  product:'1 voyage tout public, 1 h avec correspondance',validityMinutes:60,
  validFrom:'2026-02-01',validUntil:'2026-12-31',source:'https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/02/Livret_TAM_2026.pdf',
  checkedAt:'2026-11-13',flat:true},
 // STAR'T (Thonon-les-Bains) : star-t.fr, « Titres et abonnements », tarifs « Depuis le 19/12/2022 » (vérifié
 // le 13/11/2026 par accès direct au site officiel) : ticket 1 heure tout public, zone A, 1,20 €. Réservé aux
 // lignes urbaines explicitement identifiées (A, B, C, D, M, N, NL) ; les lignes interurbaines et les trajets
 // A+B restent à confirmer tant que les zones des arrêts ne sont pas établies.
 {network:"STAR'T zone A",operatorPattern:"^(?:star['’]?t(?:\\s+thonon)?|thonon-les-bains\\s*-\\s*star['’]?t)$",
  modes:['Bus'],includeLines:'^(?:A|B|C|D|M|N|NL)$',amount:1.20,currency:'EUR',
  product:'ticket 1 heure tout public, zone A',validityMinutes:60,
  validFrom:'2022-12-19',validUntil:'2026-12-31',
  source:'https://www.star-t.fr/titres-abonnements/titres-abonnements',
  checkedAt:'2026-11-13',flat:true}
 // Exemple de format (NE PAS activer sans preuve) :
 // {network:'Exemple',operatorPattern:'^exemple$',modes:['Bus'],amount:0,currency:'EUR',product:'1 voyage',
 //  validFrom:'2026-01-01',validUntil:'2026-12-31',source:'https://www.sibra.fr/…',checkedAt:'2026-11-13',flat:true}
];
function valid(e){
 return e&&typeof e.network==='string'&&typeof e.operatorPattern==='string'&&Array.isArray(e.modes)&&
  typeof e.amount==='number'&&Number.isFinite(e.amount)&&e.amount>=0&&/^(EUR|CHF)$/.test(e.currency)&&
  /^https:\/\//.test(e.source||'')&&/^\d{4}-\d{2}-\d{2}$/.test(e.validFrom||'')&&/^\d{4}-\d{2}-\d{2}$/.test(e.validUntil||'')&&
  /^\d{4}-\d{2}-\d{2}$/.test(e.checkedAt||'')&&e.flat===true;
}
// Grilles officielles déjà présentes dans le dépôt (zones prouvées arrêt par arrêt).
function officialZoneFare(leg){
 const y51=root.CPTY51Fares;
 if(!y51||!leg||!leg.gtfsRaw)return null;
 let q=null;try{q=y51.reference({legs:[leg.gtfsRaw]}).portions[0];}catch(_){return null;}
 if(!q||typeof q.amountEUR!=='number'||!Number.isFinite(q.amountEUR))return null;
 return {amount:q.amountEUR,currency:'EUR',source:'Y51 '+q.fromArea+' → '+q.toArea+' · '+(q.zone==='S'?'zone SIBRA':'zone '+q.zone)+
  ' · '+q.product+' · grille officielle AURA en vigueur au '+q.effectiveFrom+' (vérifiée le '+q.checkedOn+')',url:q.source};
}
// Léman Pass multizones 10 + 210 : 4,80 € plein tarif, 90 min, tous modes dans les deux zones.
// Sources lues le 13/11/2026 : grille Jacquet « Déplacements transfrontaliers, valables à partir du 14/12/2025 »
// (Léman Pass multizones 10, 210 : billet unité 4,80 €) ; tpg « Occasional travelers » (multizones : 90 minutes) ;
// grille tpg/Alpbus 14/12/2025 → 12/12/2026 (même prix 4,80 € pour 10 + 230). Fin de validité prudente : 12/12/2026.
// Appliqué seulement à un TRAIN dont un arrêt est la gare d'Annemasse (zone 210) et l'autre une gare Léman
// Express du canton de Genève (zone 10). Tout autre cas : pas de prix.
const LEMAN_PASS={amount:4.80,currency:'EUR',network:'Léman Pass multizones 10+210',validityMinutes:90,
 validFrom:'2025-12-14',validUntil:'2026-12-12',checkedAt:'2026-11-13',
 source:'https://jacquet-autocars.com/wp-content/uploads/2025/11/Grille-tarifaire-TRANSFRONTALIERS-2025-2026.pdf'};
const ZONE10_STATIONS=['geneve','geneve cornavin','geneve-secheron','geneve-aeroport','lancy-pont-rouge','lancy-bachet',
 'geneve-champel','geneve-eaux-vives','chene-bourg','chambesy','les tuileries','genthod-bellevue','creux-de-genthod',
 'versoix','pont-ceard','vernier','meyrin','zimeysa','satigny','russin','la plaine'];
const ZONE210_STATIONS=['annemasse'];
function stationKey(name){
 return String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/^gare (de |d')?/,'').replace(/,? ?gare$/,'').replace(/\s*\(.*\)$/,'').replace(/\s+/g,' ').trim();
}
// 13/11/2026 : DÉSACTIVÉ. Le guide des tarifs TAC (en vigueur au 14/12/2025) indique 4,90 € pour le ticket unité
// Léman Pass zones 210+10 (16 ans et +, 90 min), alors que la grille Jacquet indique 4,80 €. Deux sources officielles
// contradictoires = pas de prix. Réactiver seulement avec la grille lemanpass.com en vigueur.
const LEMAN_PASS_ACTIVE=false;
function lemanPassFare(leg){
 if(!LEMAN_PASS_ACTIVE)return null;
 if(!leg||leg.mode!=='Train'||typeof leg.departure!=='string')return null;
 const day=leg.departure.slice(0,10);if(day<LEMAN_PASS.validFrom||day>LEMAN_PASS.validUntil)return null;
 const a=stationKey(leg.from),b=stationKey(leg.to);
 const pair=(ZONE210_STATIONS.includes(a)&&ZONE10_STATIONS.includes(b))||(ZONE210_STATIONS.includes(b)&&ZONE10_STATIONS.includes(a));
 if(!pair)return null;
 return {amount:LEMAN_PASS.amount,currency:LEMAN_PASS.currency,network:LEMAN_PASS.network,validityMinutes:LEMAN_PASS.validityMinutes,
  source:LEMAN_PASS.network+' · billet unité plein tarif, 90 min · '+LEMAN_PASS.source+' (valable jusqu’au 12/12/2026, vérifié le '+LEMAN_PASS.checkedAt+')'};
}
// STAR'T : trajets interzones A+B prouvés sur les lignes L et 142.
// Les Arts (Thonon, zone A) ↔ Mairie (Bons-en-Chablais, zone B).
// Ne pas généraliser à d'autres arrêts sans leur commune/zone vérifiée.
function startInterzoneFare(leg){
 if(!leg||leg.kind==='walk'||leg.mode!=='Bus'||typeof leg.provider!=='string')return null;
 if(!/^(?:star['’]?t(?:\s+thonon)?|thonon-les-bains\s*-\s*star['’]?t)$/i.test(leg.provider.trim()))return null;
 if(!/^(?:L|142)$/i.test(String(leg.line||'').trim()))return null;
 const day=typeof leg.departure==='string'?leg.departure.slice(0,10):'';
 if(day<'2022-12-19'||day>'2026-12-31')return null;
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const a=norm(leg.from),b=norm(leg.to);
 const thonon=s=>s==='les arts'||s==='thonon les bains les arts'||s==='sacre coeur'||s==='thonon les bains sacre coeur';
 const bons=s=>s==='mairie'||s==='bons en chablais mairie';
 if(!((thonon(a)&&bons(b))||(thonon(b)&&bons(a))))return null;
 return {amount:2.20,currency:'EUR',network:"STAR'T zones A+B",validityMinutes:60,
  source:"STAR'T · ticket 1 heure tout public A+B · https://www.star-t.fr/titres-abonnements/titres-abonnements (vérifié le 13/11/2026)"};
}
function fareFor(leg,grids){
 if(!Array.isArray(grids))grids=GRIDS;
 const zoned=officialZoneFare(leg);if(zoned)return zoned;
 const leman=lemanPassFare(leg);if(leman)return leman;
 const startAB=startInterzoneFare(leg);if(startAB)return startAB;
 if(!leg||leg.kind==='walk'||typeof leg.provider!=='string'||!leg.provider.trim())return null;
 const day=typeof leg.departure==='string'?leg.departure.slice(0,10):null;if(!day)return null;
 const matches=grids.filter(e=>valid(e)&&e.modes.includes(leg.mode)&&new RegExp(e.operatorPattern,'i').test(leg.provider.trim())&&
  day>=e.validFrom&&day<=e.validUntil&&
  !(typeof e.excludeLines==='string'&&new RegExp(e.excludeLines,'i').test(String(leg.line||'').trim()))&&
  !(typeof e.includeLines==='string'&&!new RegExp(e.includeLines,'i').test(String(leg.line||'').trim())));
 if(matches.length!==1)return null; // ambiguïté = pas de prix
 const e=matches[0];
 return {amount:e.amount,currency:e.currency,network:e.network,validityMinutes:Number.isFinite(e.validityMinutes)?e.validityMinutes:null,
  source:e.network+' · '+e.product+' · '+e.source+' (vérifié le '+e.checkedAt+')'};
}
const api={GRIDS,fareFor,valid,officialZoneFare,lemanPassFare,startInterzoneFare,stationKey};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPTransportFareGrids=api;
})(typeof window!=='undefined'?window:globalThis);
