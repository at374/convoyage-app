/* SANEF A1 2026: verified Sunday schedule, Paris-bound, class 1 only.
 * Source https://www.autoroutes.sanef.com/fr/assistance/modulation-prix-peage
 * Returns a tariff COLOR, never invents a price. For special public holidays
 * the precise applicability must be independently verified.
 */
(function(root){'use strict';
function determiner(input){
  if(!input || input.classe!==1 || input.direction!=='VERS_PARIS')return {statut:'NORMAL',couleur:'normal',motif:'classe_ou_sens_non_eligible'};
  if(typeof input.passageLocal!=='string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(input.passageLocal))return {statut:'INCONNU',couleur:null,motif:'heure_locale_absente'};
  const [date,heure]=input.passageLocal.split('T');
  const [y,m,d]=date.split('-').map(Number);const [h,min,sec]=heure.split(':').map(Number);
  const dt=new Date(Date.UTC(y,m-1,d));
  if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d||h>23||min>59||sec>59)return {statut:'INCONNU',couleur:null,motif:'date_invalide'};
  if(input.passageLocal<'2026-02-01T00:00:00'||input.passageLocal>='2027-02-01T00:00:00')return {statut:'INCONNU',couleur:null,motif:'hors_grille_2026'};
  // Holiday exceptions have not been certified for this dataset, even on Sundays.
  if(input.jourFerie===true || input.lundiFerie===true || input.mardiFerie===true)
    return {statut:'INCONNU',couleur:null,motif:'calendrier_ferie_a_verifier'};
  const dimanche=dt.getUTCDay()===0;
  if(!dimanche){
    if(input.jourFerie===true || input.lundiFerie===true || input.mardiFerie===true)return {statut:'INCONNU',couleur:null,motif:'calendrier_ferie_a_verifier'};
    if(input.calendrierFeriesVerifie!==true)return {statut:'INCONNU',couleur:null,motif:'jour_special_non_exclu'};
    return {statut:'NORMAL',couleur:'normal',motif:'hors_dimanche_et_jour_special'};
  }
  const t=h*3600+min*60+sec;
  if(t>=14*3600+30*60 && t<16*3600+30*60 || t>=20*3600+30*60 && t<23*3600+30*60)return {statut:'HORAIRE_OFFICIEL',couleur:'vert',motif:'dimanche_vers_paris'};
  if(t>=16*3600+30*60 && t<20*3600+30*60)return {statut:'HORAIRE_OFFICIEL',couleur:'rouge',motif:'dimanche_vers_paris'};
  return {statut:'NORMAL',couleur:'normal',motif:'hors_plage_modulee'};
}
root.SanefA1ReglesOfficielles2026=Object.freeze({determiner});
})(typeof window!=='undefined'?window:globalThis);
