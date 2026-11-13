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
function fareFor(leg,grids){
 if(!Array.isArray(grids))grids=GRIDS;
 const zoned=officialZoneFare(leg);if(zoned)return zoned;
 if(!leg||leg.kind==='walk'||typeof leg.provider!=='string'||!leg.provider.trim())return null;
 const day=typeof leg.departure==='string'?leg.departure.slice(0,10):null;if(!day)return null;
 const matches=grids.filter(e=>valid(e)&&e.modes.includes(leg.mode)&&new RegExp(e.operatorPattern,'i').test(leg.provider.trim())&&
  day>=e.validFrom&&day<=e.validUntil);
 if(matches.length!==1)return null; // ambiguïté = pas de prix
 const e=matches[0];
 return {amount:e.amount,currency:e.currency,network:e.network,validityMinutes:Number.isFinite(e.validityMinutes)?e.validityMinutes:null,
  source:e.network+' · '+e.product+' · '+e.source+' (vérifié le '+e.checkedAt+')'};
}
const api={GRIDS,fareFor,valid,officialZoneFare};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPTransportFareGrids=api;
})(typeof window!=='undefined'?window:globalThis);
