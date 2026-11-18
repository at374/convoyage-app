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
 // Haute-Savoie : tarif PLAT OFFICIEL sur les seules lignes listées dans la grille
 // régionale « Tarifs au 1er mars 2026 », mise à jour septembre 2026.
 // ATTENTION : Y02/Y21/Y22/Y51/Y62/Y63/272/274 disposent de grilles séparées et sont exclus.
 {network:'Cars Région Haute-Savoie (lignes à tarif plat)',operatorPattern:'^cars\\s*r[ée]gion\\s*haute[- ]savoie$',modes:['Bus'],
  includeLines:'^Y(?:13|0[34]|8[1-6]|9[1-4])$',amount:1.70,currency:'EUR',
  product:'1 voyage plein tarif, lignes Y13/Y03/Y04/Y81–Y86/Y91–Y94 exclusivement',
  validFrom:'2026-03-01',validUntil:'2026-12-31',
  source:'https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/08/cars_region_haute_savoie_tarifs_MAJ-septembre_2026_Y13-03-04-81-82-83-84-85-86-91-92-93-94.pdf',
  checkedAt:'2026-11-13',flat:true},
 // Sibra (Grand Annecy) : CGV « Règlement bus et cars 2026/2027 », gamme applicable à partir du 01/07/2026
 // sur l'ensemble du réseau : 1 voyage vendu sans support (rechargement / achat digital) 2,00 € ; à bord 2,50 € ;
 // valable 1 h, correspondances comprises. Vérifié le 13/11/2026.
 {network:'Sibra',operatorPattern:'^sibra(\\s+annecy)?$',modes:['Bus'],amount:2.00,currency:'EUR',
  product:'1 voyage (achat digital ou rechargement ; 2,50 € à bord), 1 h correspondances comprises',validityMinutes:60,
  validFrom:'2026-07-01',validUntil:'2027-06-30',source:'https://www.sibra.fr/app/uploads/2026/07/Reglement_BUS_CARS_CGV_01072026_3.pdf',
  checkedAt:'2026-11-13',flat:true},
 // RTM (Marseille, zone bleue : Marseille, Allauch, Plan-de-Cuques, Septèmes) : grille officielle RTM « DOPEX 11/26 »
 // en vigueur au 01/11/2026 (PDF fourni par le convoyeur, tout public) : ticket Solo 2,00 € (sans carte), 1,60 € avec
 // recharge sur lacarte, 2,50 € à bord du bus ; valable 1 h en correspondance (grille RTM : « validable 1h en correspondance »).
 // Prix retenu : Solo 2,00 € (toujours disponible, sans support). Vérifié le 18/11/2026.
 {network:'RTM',operatorPattern:'^rtm\\b',modes:['Bus','Tram','Métro'],amount:2.00,currency:'EUR',
  product:'ticket Solo 1 voyage (1,60 € sur lacarte, 2,50 € à bord), 1 h correspondances comprises, zone bleue',validityMinutes:60,
  validFrom:'2026-11-01',validUntil:'2027-06-30',source:'https://www.rtm.fr/ — grille tarifaire RTM DOPEX 11/26 en vigueur au 01/11/2026',
  checkedAt:'2026-11-18',flat:true},
 // Lignes d'Azur (Nice, tram + bus urbains) : « Guide des tarifs » édition octobre 2026 (PDF fourni par le convoyeur) :
 // Solo 1 voyage 1,70 € (téléphone / carte), 2,00 € Solo Secours à bord ; correspondances dans les 74 min après la 1re validation.
 // Hors lignes à tarification spécifique (aéroport, interurbain Ticket Azur 2,50 €). Vérifié le 18/11/2026.
 {network:"Lignes d'Azur",operatorPattern:'^lignes d.azur\\b',modes:['Bus','Tram'],amount:1.70,currency:'EUR',
  product:'Solo 1 voyage (2,00 € à bord), correspondances 74 min, lignes urbaines hors tarification spécifique',validityMinutes:74,
  validFrom:'2026-10-01',validUntil:'2027-06-30',source:'https://www.lignesdazur.com/ — Guide des tarifs Lignes d\u2019Azur, édition octobre 2026',
  checkedAt:'2026-11-18',flat:true},
 // Tisséo (Toulouse, métro/tram/bus/téléphérique) : e-boutique Tisséo « 1 déplacement » tout public 1,90 € (ticket, carte ou
 // carte bancaire) ; 2,50 € « dernière minute ». Un déplacement = jusqu'à 4 lignes en 1 h après la 1re validation
 // (CGVU Tisséo, art. IV). Vérifié le 18/11/2026 (page transmise par le convoyeur).
 {network:'Tisséo',operatorPattern:'^tiss[ée]o\\b',modes:['Bus','Tram','Métro'],amount:1.90,currency:'EUR',
  product:'1 déplacement tout public (2,50 € dernière minute), 1 h, 4 lignes maximum',validityMinutes:60,
  validFrom:'2026-11-18',validUntil:'2027-06-30',source:'https://eboutique.tisseo.fr/fr/produits/1-deplacement-pour-tous-occ',
  checkedAt:'2026-11-18',flat:true},
 // TaM (Montpellier, tram + bus) : tickets individuels (page TaM transmise par le convoyeur) : Ticket 1h30 2,10 €,
 // valable 1h30 dès l'achat sur tout le réseau. Vérifié le 18/11/2026.
 {network:'TaM',operatorPattern:'^tam\\b',modes:['Bus','Tram'],amount:2.10,currency:'EUR',
  product:'Ticket 1h30 (4 h : 3,80 € ; 24 h : 6,50 €), tout le réseau TaM',validityMinutes:90,
  validFrom:'2026-11-18',validUntil:'2027-06-30',source:'https://www.tam-voyages.com/ — tickets individuels TaM, Ticket 1h30',
  checkedAt:'2026-11-18',flat:true},
 // Tango (Nîmes Métropole) : guide tarifaire « tarifs valables à partir du 1er septembre 2025 » (PDF fourni par le convoyeur) :
 // Pass Unité 1,40 € valable 1 heure après validation ; Pass 2 voyages 2,80 € ; Pass Journée 3,60 €. Vérifié le 18/11/2026.
 {network:'Tango',operatorPattern:'^tango\\b',modes:['Bus','Tram'],amount:1.40,currency:'EUR',
  product:'Pass Unité 1 voyage (Pass 2 voyages 2,80 € ; Pass Journée 3,60 €), 1 h après validation',validityMinutes:60,
  validFrom:'2025-09-01',validUntil:'2026-12-31',source:'https://www.tangobus.fr/ — guide tarifaire Tango, tarifs au 01/09/2025',
  checkedAt:'2026-11-18',flat:true},
 // Mistral (Toulon, bus) : page officielle reseaumistral.com « 1 voyage terrestre » 1,40 € (tout public, occasionnel).
 // Durée de validité / correspondances non précisées sur la page : chaque trajet en bus est donc compté séparément
 // (prudent). Bateau-bus (2,00 €) non géré. Vérifié le 18/11/2026.
 {network:'Mistral',operatorPattern:'^mistral\\b',modes:['Bus'],amount:1.40,currency:'EUR',
  product:'1 voyage terrestre (bus), tout public',
  validFrom:'2026-11-18',validUntil:'2027-06-30',source:'https://www.reseaumistral.com/titres/1-voyage/1-voyage-terrestre',
  checkedAt:'2026-11-18',flat:true},
 // Aix en Bus (secteur urbain Aix, niveau tarifaire 2 de La Métropole Mobilité) : gamme tarifaire urbaine au 01/11/2026
 // (page fournie par le convoyeur) : 1 voyage & open payment 1,40 €, à bord 1,90 €, 24 h 4,60 €, 10 voyages 11 €.
 // Validité 1 h : durée de la grille Métropole (comme la RTM). Vérifié le 18/11/2026.
 {network:'Aix en Bus',operatorPattern:'^aix en bus$',modes:['Bus'],amount:1.40,currency:'EUR',
  product:'1 voyage (open payment / appli, 1,90 € à bord), niveau 2 secteur Aix, 1 h',validityMinutes:60,
  validFrom:'2026-11-01',validUntil:'2027-06-30',source:'https://www.lametropolemobilite.fr/ — gamme tarifaire urbaine au 01/11/2026, niveau 2',
  checkedAt:'2026-11-18',flat:true},
 // Palm Bus (Cannes Pays de Lérins) : page tarifs Palm Bus (transmise par le convoyeur) : Ticket 1 voyage 1,80 € (à bord, conducteur
 // ou carte bancaire), validité 59 min, correspondance autorisée, aller-retour interdit. Vérifié le 18/11/2026.
 {network:'Palm Bus',operatorPattern:'^palm\\s*bus',modes:['Bus'],amount:1.80,currency:'EUR',
  product:'Ticket 1 voyage (à bord ou carte bancaire), 59 min, correspondance autorisée, aller-retour interdit',validityMinutes:59,
  validFrom:'2026-11-18',validUntil:'2027-06-30',source:'https://www.palmbus.fr/ — tarifs Palm Bus, ticket 1 voyage',
  checkedAt:'2026-11-18',flat:true},
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
 // TAM (Ambérieu-en-Bugey) : fiche tarifaire « À COMPTER DU 1ER JANVIER 2026 » hébergée sur philibert-transport.fr,
 // le site de Cars Philibert — l'exploitant du réseau TAM confirmé par transbus.org/reseaux/01500.html — donc une
 // source directement attribuable à l'opérateur (contrairement au premier lien storage.googleapis.com, un simple
 // bucket WordPress sans attribution claire, conservé ci-dessous comme corroboration). Titre 1 voyage tout public
 // 1,10 € ; enfant -4 ans gratuit ; 4-12 ans 0,60 € ; carte 10 trajets (Oùra) 9,50 € ; abonnement mensuel adulte
 // 27,00 €. Les deux sources, indépendantes, donnent le même montant : tarif confirmé. Vérifié le 13/11/2026.
 {network:'TAM',operatorPattern:'^TAM(?:\\s+Amb[ée]rieu(?:-en-Bugey)?)?$',modes:['Bus'],amount:1.10,currency:'EUR',
  product:'1 voyage tout public, 1 h avec correspondance',validityMinutes:60,
  validFrom:'2026-01-01',validUntil:'2026-12-31',
  source:'https://philibert-transport.fr/wp-content/uploads/2017/08/TAM-TARIFS-2026.pdf',
  checkedAt:'2026-11-13',flat:true},
 // J'ybus (Rumilly, réseau urbain CCRTS) : ticket unité confirmé à 1,00 € sur l'ensemble du réseau par trois
 // sources concordantes vérifiées le 13/11/2026 : (1) le règlement/CGV officiel du réseau, hébergé sur jybus.fr
 // lui-même, « Ticket unité ... Dans le bus : auprès du conducteur 1,00 € Plein tarif », valable 1 h ; (2)
 // fr.wikipedia.org/wiki/Transport_en_commun_de_Rumilly, qui précise que lors de la hausse tarifaire liée à
 // l'extension du réseau (janvier 2023) « le ticket 1 heure... est maintenu à 1 € sur l'ensemble du réseau
 // J'ybus » — donc un tarif réseau explicitement désigné comme tel, pas une extrapolation ; (3) la délibération
 // Rumilly Terre de Savoie du 03/11/2025 sur le contrat dépositaire de billetterie Oùra pour J'ybus, qui atteste
 // d'un dispositif de vente de titres toujours actif à cette date récente.
 {network:"J'ybus",operatorPattern:"^j['’]?y\\s*bus(?:\\s+rumilly)?$",modes:['Bus'],amount:1.00,currency:'EUR',
  product:'ticket unité, 1 h, tout le réseau',validityMinutes:60,
  validFrom:'2023-01-01',validUntil:'2026-12-31',
  source:'https://www.jybus.fr/sites/jybus/files/page/reglement_bus_-_rumilly_vf_1.pdf',
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
  checkedAt:'2026-11-13',flat:true},
 // Cars Région Ain : NOUVELLE GRILLE OFFICIELLE AU 01/03/2026.
 // Régie des Transports de l'Ain + Cars Philibert : 1 voyage 2,30 €, 10 voyages 17 €,
 // correspondances permises dans les 2 heures. Exceptions territoriales : Neyron–Béligneux
 // La Valbonne (1 €), tarification TCL Crépieux–Lyon, RUBIS ligne A32 Dompierre–Bourg,
 // COLIBRI Neyron–Beynost. Exclure les parcours exceptionnels non résolus plutôt que 2,30 € faux.
 {network:'Cars Région Ain',operatorPattern:'^cars\\s*r[ée]gion\\s*ain$',modes:['Bus'],amount:2.30,currency:'EUR',
  product:'1 voyage réseau hors tarifications locales dérogatoires, correspondance 2 h',validityMinutes:120,
  validFrom:'2026-03-01',validUntil:'2026-12-31',
  source:'https://transportsdelain.fr/wp-content/uploads/Nouvelle-tarification-au-01032026-2.pdf',
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
// Léman Pass multizones 10 + 210 : 4,80 € plein tarif, 90 min, tous modes dans les deux zones.
// Sources lues le 13/11/2026 : grille Jacquet « Déplacements transfrontaliers, valables à partir du 14/12/2025 »
// (Léman Pass multizones 10, 210 : billet unité 4,80 €) ; tpg « Occasional travelers » (multizones : 90 minutes) ;
// grille tpg/Alpbus 14/12/2025 → 12/12/2026 (même prix 4,80 € pour 10 + 230). Fin de validité prudente : 12/12/2026.
// Appliqué seulement à un TRAIN dont un arrêt est la gare d'Annemasse (zone 210) et l'autre une gare Léman
// Express du canton de Genève (zone 10). Tout autre cas : pas de prix.
// Léman Pass multizones 10+210 (Annemasse Agglo <> canton de Genève), billet unité 16 ans et +, 90 min, tous modes
// (bus, trams, trains Léman Express, Mouettes) : 4,90 €. Sources concordantes : guide des tarifs TAC « en vigueur au
// 14/12/2025 » et page TAC « Titres et cartes journalières Léman Pass » (4,90 €) ; tpg.ch (zone 10 : 3,20 € + zone 210 :
// 1,70 €). Les 4,80 € de la grille Jacquet 274 concernent l'arrêt de Nangy sur cette ligne et ne sont pas utilisés.
const LEMAN_PASS={amount:4.90,currency:'EUR',network:'Léman Pass multizones 10+210',validityMinutes:90,
 validFrom:'2025-12-14',validUntil:'2026-12-12',checkedAt:'2026-11-15',
 source:'https://www.lemanpass.com/points-de-vente/ (code 10210) et https://www.tac-mobilites.fr/titres/titres-et-cartes-journalieres-leman-pass'};
const ZONE10_STATIONS=['geneve','geneve cornavin','geneve-secheron','geneve-aeroport','lancy-pont-rouge','lancy-bachet',
 'geneve-champel','geneve-eaux-vives','chene-bourg','chambesy','les tuileries','genthod-bellevue','creux-de-genthod',
 'versoix','pont-ceard','vernier','meyrin','zimeysa','satigny','russin','la plaine'];
const ZONE210_STATIONS=['annemasse'];
function stationKey(name){
 return String(typeof name==='string'?name:(name&&typeof name==='object'?(name.name||name.stopName||name.label||''):'')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/^gare (de |d')?/,'').replace(/,? ?gare$/,'').replace(/\s*\(.*\)$/,'').replace(/\s+/g,' ').trim();
}
const LEMAN_PASS_ACTIVE=true;
function lemanPassFare(leg){
 if(!LEMAN_PASS_ACTIVE)return null;
 if(!leg||leg.mode!=='Train'||typeof leg.departure!=='string')return null;
 const day=leg.departure.slice(0,10);if(day<LEMAN_PASS.validFrom||day>LEMAN_PASS.validUntil)return null;
 const a=stationKey(leg.from),b=stationKey(leg.to);
 const pair=(ZONE210_STATIONS.includes(a)&&ZONE10_STATIONS.includes(b))||(ZONE210_STATIONS.includes(b)&&ZONE10_STATIONS.includes(a));
 if(!pair)return null;
 return {amount:LEMAN_PASS.amount,currency:LEMAN_PASS.currency,network:LEMAN_PASS.network,validityMinutes:LEMAN_PASS.validityMinutes,
  combined:{amount:LEMAN_PASS.amount,covers:[ZONE10.network,'TAC'],label:'billet Léman Pass multizones 10+210 (tous modes dans les deux zones)'},
  source:LEMAN_PASS.network+' · billet unité plein tarif, 90 min · '+LEMAN_PASS.source+' (valable jusqu’au 12/12/2026, vérifié le '+LEMAN_PASS.checkedAt+')'};
}
// unireso « Tout Genève », zone 10 = tout le canton de Genève, valable sur tpg, CFF et Mouettes : billet 60 min,
// 2e classe, prix entier 3,00 CHF. Sources officielles lues le 14/11/2026 : unireso.com/titres-de-transport
// (« Billet zone 10 | 60 min. | 3,00 CHF ») et dépliant tarifaire unireso « Dès le 14 décembre 2025 ». Fin de validité
// prudente : 12/12/2026 (changement d'horaire annuel). Appliqué seulement si les DEUX arrêts sont prouvés dans le
// canton : gare de la liste ZONE10_STATIONS pour un train ; pour un bus/tram, opérateur tpg ET localité genevoise
// en tête du nom d'arrêt officiel (« Genève, Bel-Air »). Un arrêt français (Saint-Julien, Collonges, Annemasse…)
// ou inconnu = pas de prix : le trajet relève alors du Léman Pass, non intégré.
const ZONE10={amount:3.00,currency:'CHF',network:'unireso Tout Genève (zone 10)',validityMinutes:60,
 validFrom:'2025-12-14',validUntil:'2026-12-12',checkedAt:'2026-11-14',source:'https://www.unireso.com/titres-de-transport/'};
const ZONE10_LOCALITIES=['geneve','geneve-eaux-vives','geneve-champel','geneve-secheron','geneve-aeroport','carouge ge','lancy',
 'lancy-bachet','lancy-pont-rouge','petit-lancy','grand-lancy','chene-bourg','chene-bougeries','thonex','vernier','meyrin','onex',
 'plan-les-ouates','grand-saconnex','le grand-saconnex','cologny','confignon','perly','troinex','bardonnex','croix-de-rozon',
 'versoix','satigny','pregny-chambesy','chambesy'];
function zone10Locality(name){
 const raw=String(typeof name==='string'?name:(name&&typeof name==='object'?(name.name||name.stopName||name.label||''):''));
 if(!raw.includes(','))return false; // forme officielle « Localité, arrêt » exigée
 const head=raw.split(',')[0].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 return ZONE10_LOCALITIES.includes(head);
}
function zone10Fare(leg){
 if(!leg||leg.kind==='walk'||typeof leg.departure!=='string'||typeof leg.provider!=='string')return null;
 const day=leg.departure.slice(0,10);if(day<ZONE10.validFrom||day>ZONE10.validUntil)return null;
 const provider=leg.provider.trim();
 // Cars transfrontaliers 271/272/274 : titre de parcours Léman Pass propre à ces lignes, non interchangeable
 // (note de validation tarifaire du 14/11/2026, lemanpass.com/faq) — jamais le billet zone 10, même entre deux
 // arrêts genevois.
 if(/^\s*(?:27[124])\s*$/.test(String(leg.line||'').replace(/^[A-Za-z]+\s+/,'')))return null;
 let inside=false;
 if(leg.mode==='Train')inside=/^(sbb|cff|sncf)\b/i.test(provider)&&ZONE10_STATIONS.includes(stationKey(leg.from))&&ZONE10_STATIONS.includes(stationKey(leg.to));
 else if(leg.mode==='Bus'||leg.mode==='Tram')inside=/^tpg$/i.test(provider)&&zone10Locality(leg.from)&&zone10Locality(leg.to);
 if(!inside)return null;
 return {amount:ZONE10.amount,currency:ZONE10.currency,network:ZONE10.network,validityMinutes:ZONE10.validityMinutes,
  source:ZONE10.network+' · billet 60 min, 2e classe, prix entier · '+ZONE10.source+' (valable jusqu’au 12/12/2026, vérifié le '+ZONE10.checkedAt+')'};
}
// LIGNE 272 Annecy – Genève (ALPBUS / Cars Région Haute-Savoie) : grille officielle « Tarification du 14/12/2025 au
// 12/12/2026 » publiée par les tpg (LIT_272_Grille_tarifaire_20251214_20261212.pdf), relue le 14/11/2026. Le prix
// dépend du couple de communes (matrice départ/arrivée du document, extraite case par case et vérifiée symétrique).
// La commune de chaque arrêt vient de son identifiant officiel dans le flux Oùra (FR:<code INSEE>:ZE:<n°>), recoupé
// avec la Base Adresse Nationale (docs/sources-tarifs/cars74-271-272-274-arrets.txt). Arrêt inconnu, non recoupé,
// même commune ou zone Sibra : aucun prix. « combined » = titre couvrant aussi la zone 10 de Genève (voir priceOf).
const L272={validFrom:'2025-12-14',validUntil:'2026-12-12',checkedAt:'2026-11-14',
 source:'https://www.tpg.ch/sites/default/files/2025-12/LIT_272_Grille_tarifaire_20251214_20261212.pdf',
 order:['GE','SJ','NEY','BEA','PRE','SBL','AND','COP','CRU','ALL','FIL','PRI','ANN'],
 // Lignes = départ, colonnes = arrivée dans l'ordre ANN PRI FIL ALL CRU COP AND SBL PRE BEA NEY SJ GE.
 rows:{GE:'5 4 4 4 3 3 3 3 L L L L -',SJ:'4 3 3 3 2 2 2 2 P P P P L',NEY:'4 3 3 2 2 1 1 1 P P P P L',BEA:'3 3 3 2 1 1 1 1 P P P P L',
  PRE:'3 3 2 2 1 1 1 1 - P P P L',SBL:'3 2 2 2 1 1 1 - 1 1 1 2 3',AND:'3 2 2 2 1 1 - 1 1 1 1 2 3',COP:'3 2 2 1 1 - 1 1 1 1 1 2 3',
  CRU:'2 2 1 1 - 1 1 1 1 1 2 2 3',ALL:'2 1 1 - 1 1 2 2 2 2 2 3 4',FIL:'S S - 1 1 2 2 2 2 3 3 3 4',PRI:'S - S 1 2 2 2 2 3 3 3 3 4',
  ANN:'- S S 2 2 3 3 3 3 3 4 4 5'},
 cols:['ANN','PRI','FIL','ALL','CRU','COP','AND','SBL','PRE','BEA','NEY','SJ','GE'],
 // [billet unité Parcours, billet unité Parcours + zone 10] ; P = zone locale 230 ; L = Léman Pass multizones 10+230.
 price:{'1':[1.60,null],'2':[3.80,null],'3':[6.40,9.60],'4':[8.60,11.80],'5':[11.30,14.50],P:[1.60,null],L:[4.80,4.80]},
 insee:{'74006':'ALL','74009':'AND','74031':'BEA','74088':'COP','74096':'CRU','74201':'NEY','74216':'PRE','74228':'SBL','74282':'FIL'},
 geneva:['6608','6623','6628','6633','6643'],
 annecy:['57539','57834','57835','57866','57867','58714','58715'],pringy:['57836','57837','57875','57876'],
 stJulien:['57858','57859','57922','57960','57961','57962','57963','58810','92693'],douane:['57860','57861'],
 excluded:['58653'] // Burgaz : identifiant « Fillière », BAN « Allonzier-la-Caille » — non recoupé, pas de prix
};
function line272Locality(id){
 const m=/^FR:(\d{4,5}):ZE:(\d+):HAUTExSAVOIE$/.exec(String(id||''));if(!m)return null;
 const [,code,ze]=m;if(L272.excluded.includes(ze))return null;
 if(L272.geneva.includes(code))return 'GE';
 if(code==='74010')return L272.annecy.includes(ze)?'ANN':L272.pringy.includes(ze)?'PRI':null;
 if(code==='74243')return L272.douane.includes(ze)?'GE':L272.stJulien.includes(ze)?'SJ':null;
 return L272.insee[code]||null;
}
function line272Fare(leg){
 if(!leg||leg.kind==='walk'||leg.mode!=='Bus'||typeof leg.provider!=='string'||typeof leg.departure!=='string')return null;
 if(!/^cars\s*r[ée]gion\s*haute[- ]savoie$/i.test(leg.provider.trim())||String(leg.line||'').trim()!=='272')return null;
 const day=leg.departure.slice(0,10);if(day<L272.validFrom||day>L272.validUntil)return null;
 const raw=leg.gtfsRaw||{},pick=(v,p)=>typeof v==='string'&&v?v:(p&&(p.stopId||p.stop_id||p.id))||null;
 const a=line272Locality(pick(raw.from,leg.fromPoint)),b=line272Locality(pick(raw.to,leg.toPoint));
 if(!a||!b)return null;
 const cell=L272.rows[a].split(' ')[L272.cols.indexOf(b)],back=L272.rows[b].split(' ')[L272.cols.indexOf(a)];
 if(cell!==back)return null; // la matrice officielle est symétrique : toute incohérence = pas de prix
 const p=L272.price[cell];if(!p)return null;
 const label=cell==='L'?'Léman Pass multizones 10+230':cell==='P'?'zone locale 230':'zone '+cell+(a==='GE'||b==='GE'?' (billet unité Parcours)':'');
 return {amount:p[0],currency:'EUR',network:'Ligne 272 ALPBUS · '+label,validityMinutes:cell==='L'?90:null,
  ...(p[1]!==null&&(a==='GE'||b==='GE')?{combined:{amount:p[1],covers:ZONE10.network,label:cell==='L'?label:'billet unité Parcours + zone 10'}}:{}),
  source:'Ligne 272 · '+label+' · grille officielle du 14/12/2025 au 12/12/2026 · '+L272.source+' (vérifiée le '+L272.checkedAt+')'};
}
// Ligne 274 Sallanches – Genève Aéroport (Jacquet / Cars Région Haute-Savoie) : grille officielle « Déplacements
// transfrontaliers » valable à partir du 14/12/2025. Billet unité Parcours par commune française <> Genève ;
// « Parcours + zone 10 » retenu seulement si le trajet continue dans Genève (priceOf). Commune = code INSEE de
// l'identifiant officiel d'arrêt, recoupé avec la Base Adresse Nationale. Nangy (multizones 10,210) non recoupé,
// trajets internes France (matrice couleur) et internes Genève : aucun prix.
const L274={validFrom:'2025-12-14',validUntil:'2026-12-12',checkedAt:'2026-11-15',
 source:'https://jacquet-autocars.com/wp-content/uploads/2025/11/Grille-tarifaire-TRANSFRONTALIERS-2025-2026.pdf',
 geneva:['6621','6623','6634'],
 zone:{'74128':1,'74241':2,'74304':2,'74311':2,'74042':3,'74276':4,'74183':4,'74256':5},
 price:{1:[4.60,4.90],2:[6.00,6.40],3:[6.40,8.10],4:[7.50,8.20],5:[11.40,14.60]}};
function line274Fare(leg){
 if(!leg||leg.kind==='walk'||leg.mode!=='Bus'||typeof leg.provider!=='string'||typeof leg.departure!=='string')return null;
 if(!/^cars\s*r[ée]gion\s*haute[- ]savoie$/i.test(leg.provider.trim())||String(leg.line||'').trim()!=='274')return null;
 const day=leg.departure.slice(0,10);if(day<L274.validFrom||day>L274.validUntil)return null;
 const raw=leg.gtfsRaw||{},pick=(v,p)=>typeof v==='string'&&v?v:(p&&(p.stopId||p.stop_id||p.id))||null;
 const code=id=>{const m=/^FR:(\d{4,5}):ZE:\d+:HAUTExSAVOIE$/.exec(String(id||''));return m?m[1]:null;};
 const a=code(pick(raw.from,leg.fromPoint)),b=code(pick(raw.to,leg.toPoint));if(!a||!b)return null;
 const ga=L274.geneva.includes(a),gb=L274.geneva.includes(b);if(ga===gb)return null;
 const z=L274.zone[ga?b:a],p=L274.price[z];if(!p)return null;
 return {amount:p[0],currency:'EUR',network:'Ligne 274 · zone '+z+' (billet unité Parcours)',validityMinutes:null,
  combined:{amount:p[1],covers:ZONE10.network,label:'billet unité Parcours + zone 10'},
  source:'Ligne 274 · zone '+z+' <> Genève · grille officielle valable à partir du 14/12/2025 · '+L274.source+' (vérifiée le '+L274.checkedAt+')'};
}
// tpg, lignes urbaines transfrontalières entre Saint-Julien-en-Genevois (zone 230) et le canton de Genève (zone 10) :
// billet Léman Pass multizones 10+230, 4,80 €, 90 min, tous modes dans les deux zones — même grille officielle 272
// (« Titre Multizones 10,230 ») et lemanpass.com/tarifs. Seule la localité « Saint-Julien » (nom officiel d'arrêt
// « Saint-Julien, … ») est prouvée en zone 230 ; Collonges, Archamps, etc. : aucun prix.
function lemanMultizone230Fare(leg){
 if(!leg||leg.kind==='walk'||leg.mode!=='Bus'||typeof leg.provider!=='string'||typeof leg.departure!=='string')return null;
 if(!/^tpg$/i.test(leg.provider.trim()))return null;
 if(/^\s*(?:27[124])\s*$/.test(String(leg.line||'').replace(/^[A-Za-z]+\s+/,'')))return null;
 const day=leg.departure.slice(0,10);if(day<L272.validFrom||day>L272.validUntil)return null;
 const head=n=>{const raw=String(typeof n==='string'?n:(n&&typeof n==='object'?(n.name||n.stopName||n.label||''):''));
  return raw.includes(',')?raw.split(',')[0].normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim():'';};
 // Zone 230 officielle = « St-Julien y compris Collonges et Valleiry » (lemanpass.com/tarifs) ; billet 10+230 : 4,80 €
 // (lemanpass.com/points-de-vente, code 10230). Archamps et autres communes : non prouvé, aucun prix.
 const sj=n=>['saint-julien','collonges','valleiry'].includes(head(n))&&!/douane/i.test(String(n));
 if(!((sj(leg.from)&&zone10Locality(leg.to))||(sj(leg.to)&&zone10Locality(leg.from))))return null;
 return {amount:4.80,currency:'EUR',network:'Léman Pass multizones 10+230',validityMinutes:90,
  combined:{amount:4.80,covers:ZONE10.network,label:'Léman Pass multizones 10+230'},
  source:'Léman Pass · billet multizones 10+230, 90 min · https://www.lemanpass.com/points-de-vente/ et '+L272.source+' (vérifié le 2026-11-15)'};
}
// STAR'T (Thonon Agglomération) : tarif par zone de l'arrêt. Zone A / zone B = listes officielles de communes
// (star-t.fr, « Titres & abonnements ») ; chaque arrêt ci-dessous a sa commune (Base Adresse Nationale) ET le
// zone_id du flux officiel concordants (517 arrêts, relevé du 15/11/2026, docs/sources-tarifs/start-arrets.txt).
// Ticket 1 heure tout public : 1,20 € dans une zone, 2,20 € entre A et B. Arrêt absent ou discordant, ligne 271,
// lignes scolaires : aucun prix.
const START_ZONE={A:new Set('AL_BOTA1 AL_BOTA2 AL_BOUG1 AL_BOUG2 AL_CENT1 AL_CENT2 AL_CERB1 AL_CERB2 AL_CHA1 AL_CHA2 AL_CHVI1 AL_CHVI2 AL_COML1 AL_COML2 AL_CRES1 AL_CRES2 AL_CTON1 AL_CTON2 AL_EGL1 AL_EGL2 AL_GOUI1 AL_GOUI2 AL_GRAA1 AL_HUTI2 AL_LASS1 AL_LASS2 AL_LAUR1 AL_LAUR2 AL_LEYR1 AL_LEYR2 AL_MACH1 AL_MACH2 AL_MESD1 AL_MESD2 AL_MESI1 AL_MESI2 AL_MONT1 AL_MONT2 AL_NOYE1 AL_NOYE2 AL_NOYE5 AL_ORAT1 AL_ORAT2 AL_SOUR1 AL_SOUR2 AL_VALE1 AL_VALE2 AL_VSF1 AL_VSF2 AR_CHL1 AR_CHL2 AR_DEUD1 AR_DEUD2 AR_ERMI1 AR_ERMI2 AR_LONN1 AR_LONN2 AR_PRCA1 AR_PRCA2 At_Boug1 At_Boug2 AT_CEAU1 AT_CEAU2 At_Char1 At_Char2 AT_CHEn1 AT_CHEn2 AT_CIM1 AT_CIM2 AT_CON1 AT_CON2 At_Ecol1 At_Ecol2 AT_FOIs1 AT_FOIs2 AT_FOSx1 AT_FOSx2 At_Lavo1 At_Lavo2 At_Long1 At_Long2 AT_PEYL1 AT_PEYL2 AT_PICA1 AT_PICA2 AT_PSEC1 AT_PSEC2 At_Saug1 At_Saug2 AT_SAVo1 AT_SAVo2 AT_SECH1 AT_SECH2 At_Vign1 At_Vign2 CE_EC1 CE_PESS1 CE_PESS2 CE_REYR1 CE_REYR2 DR_CHEV1 DR_CHEV2 DR_CHL1 DR_CHL2 DR_MAUG1 DR_MAUG2 DR_XLIE1 DR_XLIE2 LY_CAPI1 LY_CAPI2 LY_CIM1 LY_CIM2 LY_CRUT1 LY_CRUT2 Ly_Ctre1 LY_HERM1 LY_HERM2 LY_MOUA1 LY_MOUA2 LY_TROS1 LY_TROS2 MA_5CHE1 MA_5CHE2 MA_AGRS1 MA_AGRS2 MA_BRI1 MA_BRI2 MA_CCOM1 MA_CMON1 MA_CMON2 MA_COLL1 MA_COLL2 MA_DRTY1 MA_DRTY2 MA_DURS1 MA_DURS2 MA_ECOL1 MA_ECOL2 MA_JOUV1 MA_JOUV2 MA_LACR1 MA_LACR2 MA_MCDO1 MA_MCDO2 MA_RFOR1 MA_RFOR2 MA_RONS1 MA_RONS2 MA_SALL1 MA_SALL2 MA_SPO1 MA_SPO2 MA_VIL1 MA_VIL2 MA_ZUSI1 MA_ZUSI2 O_CHAR1 O_CHAR2 O_Char4 O_CHL1 O_CHL2 O_COLO1 O_COLO2 O_FAVR1 O_FAVR2 O_FILL1 O_FILL2 O_GDCH1 O_GDCH2 O_Han1 O_Han2 O_JOUV1 O_JOUV2 O_PAMP1 O_PAMP2 O_PROP1 O_PROP2 O_SORC1 O_SORC2 O_STD1 O_STD2 O_STD3 PE_BREC1 PE_BREC2 PE_DAUD1 PE_DAUD2 PE_EPRI1 PE_GAR1 S_BONN1 S_BONN2 S_BONPO1 S_BONPO2 S_CHAV1 S_CHAV2 S_CHL1 S_CHL2 S_CHV1 S_CHV2 S_CONT1 S_CONT2 S_ECBU1 S_ECBU2 S_EG1 S_EG2 S_FILEC1 S_FILEC2 S_FILFR1 S_FILFR2 S_FILL1 S_FILL2 S_JUSS1 S_JUSS2 S_VOIE1 S_VOIE2 T_ADEP1 T_ADEP2 T_AUMO1 T_AUMO2 T_BDC1 T_BDC2 T_BDC3 T_BDC4 T_BDC5 T_BDC5B T_BDC6 T_BLC1 T_BLC2 T_CAEP1 T_CAEP2 T_ChamB1 T_ChamB2 T_CHAR1 T_CHAR2 T_CHATH1 T_CHATH2 T_Chatl1 T_Chatl2 T_CIM1 T_CIM2 T_CINL1 T_CINL2 T_CITA1 T_CITA2 T_CLAR1 T_CLAR2 T_CLCHA1 T_CLCHA2 T_CLRIA1 T_CLRIA2 T_CMED1 T_CMed2 T_COCHA1 T_COCHA2 T_COLL1 T_COLL2 T_ComRg1 T_ComRg2 T_CoPar1 T_CoPar2 T_CoPlg1 T_CoPlg2 T_CRANT1 T_CRANT2 T_CRET1 T_CRET2 T_DOIE1 T_DOIE2 T_DOUA1 T_DOUA2 T_DucSa1 T_DucSa2 T_ECLET1 T_ECLET2 T_ECMOR1 T_ECMOR2 T_EGVAL1 T_EGVAL2 T_EPIN1 T_EPIN2 T_ETUL1 T_ETUL2 T_EUR1 T_FLEY1 T_FLEY2 T_FON1 T_FON2 T_ForRi1 T_ForRi2 T_FoyCl1 T_FoyCl2 T_FUNAM1 T_FUNAV2 T_gAndr1 T_gAndr2 T_GEN1 T_GEN2 T_GNV1 T_GNV2 T_GRAEG1 T_GRAEG2 T_GREC1 T_GREC2 T_HARP1 T_HARP2 T_HOPI1 T_HOPI2 T_JARC1 T_JARC2 T_JFer1 T_JFer2 T_JJROU1 T_JJROU2 T_LETR1 T_LETR2 T_LIBE1 T_LIBE2 T_LIBE3 T_LYVER3 T_MAR1 T_MAR2 T_MARA1 T_MARA2 T_MARC1 T_MARC2 T_MARCD1 T_MASC1 T_MASC2 T_MES1 T_MES2 T_MORC2 T_MOU1 T_MOU2 T_NAR1 T_NAR2 T_PAT1 T_PAT2 T_PELE1 T_PELE2 T_Perro1 T_Perro2 T_PILL1 T_PILL2 T_Pinso1 T_Pinso2 T_Piott1 T_Piott2 T_Plant1 T_Plant2 T_PORI1 T_PORI2 T_PR1 T_PREC1 T_PREC2 T_PVER1 T_PVER2 T_RiCom1 T_RiCom2 T_ROSE1 T_ROSE2 T_SCOE1 T_SCOE2 T_sDcam1 T_sDSta1 T_sDSta2 T_SEN1 T_SEN2 T_SerrM1 T_SerrM2 T_SHOL1 T_SHOL2 T_STJOS1 T_STJOS2 T_STMA1 T_STMA2 T_TASS1 T_TASS2 T_THAL1 T_THAL2 T_Thys1 T_Thys2 T_TOL1 T_TOL2 T_TROL2 T_TUL1 T_TUL2 T_VAL1 T_VAL2 T_VerGR1 T_VerGR2 T_VERN1 T_VERN2 T_VGEG1 T_VGEG2 T_VGVIL1 T_VGVIL2 T_VIO1 T_VIO2 T_VXCAM1 T_VXCAM2 T_ZIVG1'.split(' ')),
 B:new Set('AN_LGLI1 AN_LGLI2 AN_LJMO1 BA_ABOI1 BA_ABOI2 BA_CEPI1 BA_CEPI2 BA_CHEC1 BA_CHEC2 Ba_ChL1 BA_CHL2 BA_CRAM1 BA_CRAM2 BA_CRAS1 BA_CRAS2 BA_CTIR1 BA_CTIR2 BA_GDP1 BA_GDP2 BA_PEUP1 BA_PEUP2 BA_TUIL1 BA_TUIL2 BC_CFMU2 BC_Foug1 BC_Foug2 BC_GARE1 BC_GARE2 BC_LANG1 BC_LANG2 BC_MAI1 BC_MAI2 BC_MTB1 BC_MTB2 BC_PRES1 BC_PRES2 BC_Tann1 BC_ZBrac BR_CHL1 BR_CHL2 BR_MORZ1 BR_MORZ2 CL_CHL1 CL_CHL2 CL_FICH1 CL_FICH2 CL_VERE1 CL_VERE2 D_AUBO2 D_AvLac1 D_AvLac2 D_Cas2 D_Casi1 D_coBCh0 D_COBCH1 D_COBCH2 D_COSTF1 D_CPLA1 D_CPLA2 D_EG1 D_EG2 D_MAI1 D_MAI2 D_PTCO1 D_PTCO2 D_VOIR1 EX_CHEV1 EX_CHEV2 EX_CHL1 EX_CHL2 EX_FATT1 EX_FATT2 EX_PINE1 EX_PINE2 F_PICU1 F_PICU2 F_REZI1 F_REZI2 F_SSEC1 F_SSEC2 LO_BIOL1 LO_BIOL2 LO_CHL1 LO_CHL2 LO_NVEC1 LO_NVEC2 LO_THCO2 LO_THG1 LO_THG2 LO_THOL1 LO_THOL2 LU_CHL1 LU_CHL2 MAS_CHL1 MAS_CHL2 MC_GAR1 MC_GAR2 ME_BROL1 ME_BROL2 ME_CHL1 ME_CHL2 ME_ESRT1 ME_ESRT2 ME_FRIZ1 ME_FRIZ2 ME_REPI1 ME_REPI2 ME_VERE1 ME_VERE2 VF_EC2 VF_LPSU2 VF_STHU VG_2M1 Y_MOTT1 Y_MOTT2 Y_PREP1 Y_PREP2'.split(' '))};
function startZoneFare(leg){
 if(!leg||leg.kind==='walk'||leg.mode!=='Bus'||typeof leg.provider!=='string'||typeof leg.departure!=='string')return null;
 if(!/^(?:star['’]?t(?:\s+thonon)?|thonon-les-bains\s*-\s*star['’]?t)$/i.test(leg.provider.trim()))return null;
 const line=String(leg.line||'').trim();if(!line||/^271$/.test(line)||/^(?:sTh|S[A-Z]{2,})/.test(line))return null;
 const day=leg.departure.slice(0,10);if(day<'2022-12-19'||day>'2026-12-31')return null;
 const raw=leg.gtfsRaw||{},pick=(v,p)=>typeof v==='string'&&v?v:(p&&(p.stopId||p.stop_id||p.id))||null;
 const zone=id=>START_ZONE.A.has(id)?'A':START_ZONE.B.has(id)?'B':null;
 const a=zone(pick(raw.from,leg.fromPoint)),b=zone(pick(raw.to,leg.toPoint));if(!a||!b)return null;
 const inter=a!==b;
 return {amount:inter?2.20:1.20,currency:'EUR',network:inter?"STAR'T zones A+B":"STAR'T zone "+a,validityMinutes:60,
  source:"STAR'T · ticket 1 heure tout public "+(inter?'A+B':'zone '+a)+" · https://www.star-t.fr/titres-abonnements/titres-abonnements (vérifié le 15/11/2026)"};
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
 const norm=s=>String(typeof s==='string'?s:(s&&typeof s==='object'?(s.name||s.stopName||s.label||''):'')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
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
 const startZ=startZoneFare(leg);if(startZ)return startZ;
 const startAB=startInterzoneFare(leg);if(startAB)return startAB;
 const l272=line272Fare(leg);if(l272)return l272;
 const l274=line274Fare(leg);if(l274)return l274;
 const lm230=lemanMultizone230Fare(leg);if(lm230)return lm230;
 const z10=zone10Fare(leg);if(z10)return z10;
 if(!leg||leg.kind==='walk'||typeof leg.provider!=='string'||!leg.provider.trim())return null;
 const day=typeof leg.departure==='string'?leg.departure.slice(0,10):null;if(!day)return null;
 // Certaines liaisons Cars Région Ain ont des tarifs locaux dérogatoires.
 if(/^cars\s*r[ée]gion\s*ain$/i.test(leg.provider.trim())){
  const line=String(leg.line||'').trim();
  const stops=[leg.from,leg.to,leg.fromPoint,leg.toPoint].map(s=>String(typeof s==='string'?s:(s&&typeof s==='object'?(s.name||s.stopName||s.label||s.address||''):'')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());
  if(/^A32$/i.test(line)||stops.some(s=>/\b(neyron|beligneux|crepieux|beynost|dompierre|lyon)\b/.test(s)))return null;
 }
 const matches=grids.filter(e=>valid(e)&&e.modes.includes(leg.mode)&&new RegExp(e.operatorPattern,'i').test(leg.provider.trim())&&
  day>=e.validFrom&&day<=e.validUntil&&
  !(typeof e.excludeLines==='string'&&new RegExp(e.excludeLines,'i').test(String(leg.line||'').trim()))&&
  !(typeof e.includeLines==='string'&&!new RegExp(e.includeLines,'i').test(String(leg.line||'').trim())));
 if(matches.length!==1)return null; // ambiguïté = pas de prix
 const e=matches[0];
 return {amount:e.amount,currency:e.currency,network:e.network,validityMinutes:Number.isFinite(e.validityMinutes)?e.validityMinutes:null,
  source:e.network+' · '+e.product+' · '+e.source+' (vérifié le '+e.checkedAt+')'};
}
const api={GRIDS,fareFor,valid,officialZoneFare,lemanPassFare,startInterzoneFare,startZoneFare,zone10Fare,line272Fare,line272Locality,line274Fare,lemanMultizone230Fare,stationKey};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPTransportFareGrids=api;
})(typeof window!=='undefined'?window:globalThis);
