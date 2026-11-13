/* Convoyage Ultra — inventaire de couverture transports AURA–Suisse et diagnostic sur téléphone.
 * Quatre états, du plus sûr au moins sûr :
 *  - « Validé en réel »                 : le diagnostic du téléphone a obtenu des trajets réels de ce réseau (≤ 30 jours) ;
 *  - « Testé sur données enregistrées » : réponses réelles enregistrées dans le dépôt et testées ;
 *  - « Partiellement raccordé »         : source officielle branchée, jamais vérifiée en réel ;
 *  - « Non raccordé »                   : aucune source propre (la simple présence possible dans TripGo ne compte pas).
 * Lecture seule : aucune écriture de mission, de réglage serveur, d'authentification ou de synchronisation.
 */
(function(root){
'use strict';
const STORE='cp_diag_transports_v1',VALID_DAYS=30;
// match : motif reconnu dans le nom d'opérateur/réseau des étapes renvoyées par les moteurs.
const NETWORKS=[
 // ---- AURA : réseaux urbains et interurbains
 {id:'sibra',name:'Sibra (Grand Annecy)',zone:'AURA',match:/^sibra\b/i,sources:['GTFS officiel Sibra'],fare:'Grille officielle 2,00 € (CGV 01/07/2026)',fareOk:true,recorded:['GTFS SIBRA du dépôt (data/sibra)']},
 {id:'tac',name:'TAC / Genevois français Mobilités (Annemasse, Saint-Julien, Archamps)',zone:'AURA',match:/^tac\b|genevois fran/i,sources:['GTFS officiel TAC (ajouté 13/11)'],fare:'Grille officielle 1,70 € (guide TAC, tarifs au 14/12/2025)',fareOk:true,recorded:['Flux officiel réel du 13/11/2026 (tâche serveur) : 496 courses lun. 16/11 ; recherche Annemasse → Saint-Julien et → Archamps OK']},
 {id:'synchro',name:'Synchro Bus (Chambéry)',zone:'AURA',match:/synchro/i,sources:['GTFS officiel Synchro (ajouté 13/11)'],fare:'Prix à confirmer (grille 2026 ambiguë) ; GTFS Fares si publiés',fareOk:false,recorded:['Flux officiel réel du 13/11/2026 : 1 146 courses lun. 16/11 ; recherche Chambéry → Le Bourget-du-Lac OK']},
 {id:'ondea',name:'Ondéa Grand Lac (Aix-les-Bains)',zone:'AURA',match:/^ond[ée]a/i,sources:['GTFS officiel Ondéa (ajouté 13/11)'],fare:'Grille officielle 1,70 € (01/07/2026), lignes ≥ 100 exclues',fareOk:true,recorded:['Flux officiel réel du 13/11/2026 : 501 courses lun. 16/11 ; recherche Aix → Le Bourget-du-Lac OK']},
 {id:'start',name:"Star't (Thonon)",zone:'AURA',match:/star.?t/i,sources:["GTFS officiel Star't (ajouté 13/11)"],fare:'Prix à confirmer (tarif par zones A/B) ; GTFS Fares si publiés',fareOk:false,recorded:['Flux officiel réel du 13/11/2026 : 746 courses lun. 16/11 ; recherche Thonon → Douvaine OK']},
 {id:'mreso-metro',name:'M réso — Métropole grenobloise',zone:'AURA',match:/m\s?r[ée]so/i,area:[45.0,5.6,45.26,5.8],sources:['Mobilités M (OTP)','GTFS officiel'],fare:'Grille officielle 2,00 € (01/09/2026)',fareOk:true,recorded:['Réponse Mobilités M 30/10/2026 (Grenoble–Crolles)']},
 {id:'mreso-gresivaudan',name:'M réso — Grésivaudan',zone:'AURA',match:/m\s?r[ée]so/i,area:[45.2,5.8,45.5,6.15],sources:['Mobilités M (OTP)','GTFS officiel'],fare:'Grille officielle 2,00 € (1,00 € intra-Grésivaudan non appliqué)',fareOk:true,recorded:['Réponse Mobilités M 30/10/2026 (ligne 80)']},
 {id:'mreso-voironnais',name:'M réso — Voironnais',zone:'AURA',match:/m\s?r[ée]so|voironnais/i,area:[45.24,5.4,45.5,5.68],sources:['Mobilités M (OTP)'],fare:'Grille officielle 2,00 € (1,30 € intra-Voironnais non appliqué)',fareOk:true,recorded:[]},
 {id:'tcl',name:'TCL (Lyon)',zone:'AURA',match:/^tcl\b|sytral/i,sources:[],fare:'Prix à confirmer (zones TCL ; GTFS TCL trop lourd pour le téléphone)',fareOk:false,recorded:[],note:'Seulement via TripGo (non vérifié)'},
 {id:'jybus',name:"J'y bus (Rumilly)",zone:'AURA',match:/j.?y\s?bus/i,sources:['Extrait GTFS de l’agrégat Oùra (tâche serveur hebdomadaire)'],fare:'Prix à confirmer',fareOk:false,recorded:['Extrait officiel Oùra du 13/11/2026 : 5 lignes, 144 courses lun. 16/11 ; recherche intra-Rumilly OK'],note:'Données uniquement dans l’agrégat régional Oùra (trop lourd) ; via TripGo (non vérifié)'},
 {id:'tam',name:'TAM (Ambérieu-en-Bugey)',zone:'AURA',match:/\btam\b|amb[ée]rieu/i,sources:['Extrait GTFS de l’agrégat Oùra (tâche serveur hebdomadaire)'],fare:'Prix à confirmer',fareOk:false,recorded:['Extrait officiel Oùra du 13/11/2026 : 4 lignes, 91 courses lun. 16/11 ; recherche intra-Ambérieu OK'],note:'Données uniquement dans l’agrégat régional Oùra ; via TripGo (non vérifié)'},
 {id:'cars-74',name:'Cars Région Haute-Savoie (dont Y51)',zone:'AURA',match:/haute-savoie|^[^ ]*\s?y\d{2}\b/i,sources:['GTFS officiel Oùra Haute-Savoie'],fare:'Y51 : grille officielle par zones ; autres lignes à confirmer',fareOk:true,recorded:['Grille Y51 et périmètre du 31/10/2026']},
 {id:'cars-01',name:'Cars Région Ain',zone:'AURA',match:/r[ée]gion ain\b|\bain\b/i,sources:['GTFS officiel Oùra Ain'],fare:'Prix à confirmer (zones)',fareOk:false,recorded:[]},
 {id:'cars-38',name:'Cars Région Isère',zone:'AURA',match:/is[èe]re/i,sources:['Extrait GTFS de l’agrégat Oùra (tâche serveur hebdomadaire)'],fare:'Prix à confirmer (zones 4,10 € à 12,10 €, zones des arrêts inconnues)',fareOk:false,recorded:['Extrait officiel Oùra du 13/11/2026 : 502 lignes, 2 163 courses lun. 16/11 ; recherche Grenoble → Voiron OK (17 trajets)'],note:'Via TripGo (non vérifié)'},
 {id:'cars-73',name:'Cars Région Savoie',zone:'AURA',match:/^(?!.*haute).*savoie/i,sources:['Extrait GTFS de l’agrégat Oùra (tâche serveur hebdomadaire)'],fare:'Prix à confirmer',fareOk:false,recorded:['Extrait officiel Oùra du 13/11/2026 : 8 lignes, 63 courses lun. 16/11 ; aucun trajet Chambéry → Albertville (corridor non desservi par ces lignes)'],note:'Via TripGo (non vérifié)'},
 {id:'ter',name:'TER Auvergne-Rhône-Alpes / SNCF',zone:'AURA',match:/^sncf(?!\s+l[1-6]\b)|\bter\b/i,sources:['SNCF GTFS (fichiers quotidiens du dépôt)'],fare:'Prix dynamique : pas de source autorisée gratuite',fareOk:false,recorded:['Annecy–Grenoble 02/11/2026']},
 {id:'longue',name:'FlixBus / BlaBlaCar Bus',zone:'AURA',match:/flixbus|blablacar/i,sources:['TripGo (si clé)','BlaBlaCar temps réel (relais)'],fare:'Prix dynamique : à confirmer (billet TripGo repris s’il est transmis)',fareOk:false,recorded:['TripGo Annecy–Grenoble 31/10/2026']},
 // ---- Suisse
 {id:'cff',name:'CFF / trains suisses',zone:'Suisse',match:/sbb|cff|^ir\b|^re\b|^s\d/i,sources:['transport.opendata.ch'],fare:'Prix à confirmer (pas de prix dans l’API)',fareOk:false,recorded:[],note:'Format vérifié sur la documentation officielle uniquement'},
 {id:'tpg',name:'TPG (Genève, zone 10)',zone:'Suisse',match:/tpg|transports publics genevois/i,sources:['transport.opendata.ch'],fare:'Prix à confirmer (CHF 3.– non confirmé pour 2026)',fareOk:false,recorded:[]},
 // ---- Transfrontalier
 {id:'lex',name:'Léman Express',zone:'Transfrontalier',match:/^sl\s?\d|l[ée]man express|^sncf\s+l[1-6]\b/i,sources:['transport.opendata.ch','SNCF GTFS'],fare:'Léman Pass : prix à confirmer',fareOk:false,recorded:[]},
 {id:'tpg-fr',name:'TPG lignes transfrontalières',zone:'Transfrontalier',match:/tpg/i,sources:['transport.opendata.ch'],fare:'Léman Pass : prix à confirmer',fareOk:false,recorded:[]},
 {id:'lemanpass',name:'Léman Pass (tarif)',zone:'Transfrontalier',match:/$^/,sources:[],fare:'Aucune grille officielle 2026 intégrée',fareOk:false,recorded:[],tariffOnly:true},
 // ---- Transports à la demande (réservation)
 {id:'flexi',name:'Flexi (Synchro, Chambéry)',zone:'TAD',match:/flexi/i,sources:[],fare:'Même tarif que le bus Synchro',fareOk:false,recorded:[],reservation:'Réservation obligatoire (téléphone, appli, site)'},
 {id:'mobea',name:'Mobéa (Ondéa, Grand Lac)',zone:'TAD',match:/mob[ée]a/i,sources:[],fare:'Tarif Ondéa',fareOk:false,recorded:[],reservation:'Réservation obligatoire'},
 {id:'tpgflex',name:'TPG Flex',zone:'TAD',match:/tpg flex/i,sources:[],fare:'Prix à confirmer',fareOk:false,recorded:[],reservation:'Réservation obligatoire'}
];
// Axes de test (points de gare ou de centre-ville, pas des adresses de mission).
const AXES=[
 {id:'annecy-geneve',name:'Annecy → Genève',from:{lat:45.9017,lon:6.1219,name:'Annecy gare'},to:{lat:46.2102,lon:6.1424,name:'Genève Cornavin'},expect:['ter','lex','cff','longue']},
 {id:'annemasse-stjulien',name:'Annemasse → Saint-Julien-en-Genevois',from:{lat:46.1993,lon:6.2366,name:'Annemasse gare'},to:{lat:46.1446,lon:6.0812,name:'Saint-Julien gare'},expect:['tac','lex','tpg-fr']},
 // Vérifié le 13/11/2026 (horaires officiels « ligne 103 », fichiers OùRA/Transports de l'Ain, et page
 // intermodalité SNCF de la gare d'Ambérieu) : la seule desserte directe Ambérieu → Lyon est le TER
 // (Lyon–Genève). La « ligne 103 » affichée en gare comme « Cars interurbains » n'est PAS un car direct
 // jusqu'à Lyon : c'est la navette OùRA Lagnieu ↔ Ambérieu-en-Bugey, combinée commercialement avec le TER
 // pour le trajet restant (« Lagnieu → Ambérieu → Lyon : car + train ») — les lignes Cars Région Ain (A0x)
 // desservent toutes le seul département de l'Ain et s'arrêtent à Ambérieu/Lagnieu/Bourg-en-Bresse, sans
 // continuer jusqu'à Lyon. TCL (réseau urbain lyonnais) ne dessert pas non plus Ambérieu : sa propre ligne
 // 103 est une ligne de banlieue ouest de Lyon (Gorge de Loup ↔ Dardilly ↔ Limonest), sans lien avec l'Ain.
 // Confirmé par le diagnostic réel serveur (appGtfsChoice « Cars Région Ain » mais 0 course réelle trouvée).
 {id:'amberieu-lyon',name:'Ambérieu-en-Bugey → Lyon Part-Dieu',from:{lat:45.9583,lon:5.3577,name:'Ambérieu gare'},to:{lat:45.7606,lon:4.8593,name:'Lyon Part-Dieu'},expect:['ter']},
 {id:'chambery-aix',name:'Chambéry → Aix-les-Bains',from:{lat:45.5711,lon:5.9196,name:'Chambéry gare'},to:{lat:45.6880,lon:5.9093,name:'Aix-les-Bains gare'},expect:['ter','synchro','ondea']},
 {id:'grenoble-crolles',name:'Grenoble → Crolles',from:{lat:45.1914,lon:5.7143,name:'Grenoble gare'},to:{lat:45.28364,lon:5.88224,name:'Crolles'},expect:['mreso-metro','mreso-gresivaudan']},
 // Vérifié sur le GTFS réel (data/gtfs/jybus-rumilly.zip) le 13/11/2026 : les deux lignes interurbaines J'y bus
 // (J4 Gare Rumilly ↔ Chavanod Stade, J5 Gare Rumilly ↔ Lycée de Poisy) s'arrêtent à 6,095° de longitude au
 // plus loin, avant Annecy (6,122°) — J'y bus n'exploite pas cette liaison. Cars Région Haute-Savoie est bien
 // interrogé (appGtfsChoice réel) mais n'y a aucune course réelle ; Sibra dessert déjà cet axe en direct
 // (ligne 42, tarif officiel 2,00 €) et apparaît dans les résultats réels.
 {id:'rumilly-annecy',name:'Rumilly → Annecy',from:{lat:45.8650,lon:5.9437,name:'Rumilly gare'},to:{lat:45.9017,lon:6.1219,name:'Annecy gare'},expect:['ter','sibra']},
 {id:'thonon-geneve',name:'Thonon-les-Bains → Genève',from:{lat:46.3704,lon:6.4818,name:'Thonon gare'},to:{lat:46.2102,lon:6.1424,name:'Genève Cornavin'},expect:['lex','tpg-fr']},
 // Vérifié en réel le 13/11/2026 (trace des legs bruts) : les trajets trouvés sur ce corridor utilisent les
 // lignes T40/T41/T50/T51/T55 (Cars Région Isère) avec correspondance à St-Laurent-du-Pont ou Moirans — ce
 // sont des lignes « Cars Région », confirmées par les avis de perturbation officiels itinisere.fr (« Coach
 // T41 VOIRON-CHAMBERY Cars Région », « Coach T40 ST PIERRE DE CHARTREUSE-GRENOBLE Cars Région »), pas le
 // réseau urbain M réso Voironnais. Ce dernier dessert réellement le Voironnais local (cf. l'axe
 // voiron-voreppe, où il est bien détecté) mais n'exploite pas de ligne directe Voiron → Grenoble.
 {id:'voiron-grenoble',name:'Voiron → Grenoble',from:{lat:45.3643,lon:5.5916,name:'Voiron gare'},to:{lat:45.1914,lon:5.7143,name:'Grenoble gare'},expect:['cars-38','ter']}
];
// Indicateurs par réseau (livraison 9) : horaires, niveau de tarif, dernier contrôle documentaire, blocage et prochaine action.
// horaires : 'enregistrés' (réponse réelle testée) | 'source branchée' | 'indisponibles' ; tarif : 'vérifiés' | 'partiels' | 'manquants'.
const DETAILS={
 'sibra':{horaires:'enregistrés',tarif:'vérifiés',checked:'2026-11-13 · CGV Sibra 01/07/2026',blocage:'Aucun bloquant connu',action:'Lancer le diagnostic téléphone (axe Rumilly → Annecy)'},
 'tac':{horaires:'enregistrés',tarif:'vérifiés',checked:'2026-11-13 · guide des tarifs TAC (tarifs au 14/12/2025)',blocage:'Tram 17 (exploité par tpg, données suisses) non chiffré par cette grille ; 2,00 € à bord de la T1',action:'Diagnostic téléphone (Annemasse → Saint-Julien)'},
 'synchro':{horaires:'enregistrés',tarif:'vérifiés',checked:'2026-11-13 · délibération Grand Chambéry n° 080-25 C (10/04/2025, en vigueur depuis le 7/07/2025) ; aucune révision 2026 trouvée',blocage:'Montagne/combinés ski non chiffrés ; à revérifier si une grille « juillet 2026 » est publiée',action:'Surveiller une nouvelle délibération tarifaire 2026'},
 'ondea':{horaires:'enregistrés',tarif:'vérifiés',checked:'2026-11-13 · ondeagrandlac.fr (01/07/2026)',blocage:'Était évincé par Cars Région Savoie sur Chambéry → Aix (un seul partenaire retenu) ; corrigé le 13/11/2026 (Synchro + Ondéa, convention d’extension de la ligne A du 7/07/2025)',action:'Diagnostic téléphone (Chambéry → Aix) pour confirmer en réel'},
 'start':{horaires:'enregistrés',tarif:'manquants',checked:'2026-11-13 · star-t.fr (2025)',blocage:'Zones connues (liste officielle des communes A/B, star-t.fr) mais prix 2026 non confirmé (1,20 € / 2,20 € sur des pages de 2022–2025) ; arrêts GTFS sans commune ; était évincé sur Thonon → Genève par Cars Région Ain puis par TAC Annemasse (enveloppes larges) — corrigé le 13/11/2026 (le moteur préfère désormais le réseau qui couvre le départ)',action:'Confirmer la grille 2026 ; associer chaque arrêt à sa commune ; diagnostic Thonon → Genève'},
 'mreso-metro':{horaires:'enregistrés',tarif:'vérifiés',checked:'2026-11-13 · reso-m.fr (01/09/2026)',blocage:'Aucun bloquant connu',action:'Diagnostic téléphone (Grenoble → Crolles)'},
 'mreso-gresivaudan':{horaires:'enregistrés',tarif:'partiels',checked:'2026-11-13 · reso-m.fr (01/09/2026)',blocage:'Tarif intra-Grésivaudan 1,00 € non appliqué (périmètre des arrêts inconnu) : 2,00 € affiché',action:'Ajouter la liste des communes du Grésivaudan'},
 'mreso-voironnais':{horaires:'source branchée',tarif:'partiels',checked:'2026-11-13 · reso-m.fr (01/10/2026)',blocage:'Tarif intra-Voironnais 1,30 € non appliqué : 2,00 € affiché ; attente Voiron → Grenoble retirée le 13/11/2026 (ligne réellement exploitée par Cars Région Isère T40/T41, pas le réseau urbain Voironnais)',action:'Liste des communes du Voironnais pour le tarif intra'},
 'tcl':{horaires:'indisponibles',tarif:'manquants',checked:'2026-11-13 · MobilityDatabase / guide TCL mai 2026',blocage:'GTFS TCL (654 lignes) trop lourd pour le téléphone ; tarifs par zones',action:'Relais serveur GTFS TCL ou clé TripGo ; carte des zones TCL par arrêt'},
 'jybus':{horaires:'enregistrés',tarif:'manquants',checked:'2026-11-13 · extraction agrégat Oùra (script testé hors ligne)',blocage:'Aucun tarif publié dans l’agrégat Oùra ; pas de grille officielle trouvée',action:'Lancer la tâche « Build regional GTFS », puis diagnostic Rumilly'},
 'tam':{horaires:'enregistrés',tarif:'manquants',checked:'2026-11-13 · extraction agrégat Oùra (script testé hors ligne)',blocage:'Aucun tarif publié dans l’agrégat Oùra ; pas de grille officielle trouvée',action:'Lancer la tâche « Build regional GTFS », puis diagnostic Ambérieu → Lyon'},
 'cars-74':{horaires:'enregistrés',tarif:'partiels',checked:'2026-10-31 · fiche tarifaire Y51 AURA 2026',blocage:'Seule la Y51 a une grille par zones ; autres lignes sans prix',action:'Grilles zonales des autres lignes Cars Région 74'},
 'cars-01':{horaires:'source branchée',tarif:'manquants',checked:'2026-11-13 · GTFS Oùra Ain',blocage:'Tarif par zones non intégré',action:'Grille zonale Cars Région Ain'},
 'cars-38':{horaires:'enregistrés',tarif:'manquants',checked:'2026-11-13 · extraction agrégat Oùra (script testé hors ligne)',blocage:'Aucun tarif publié dans l’agrégat ; tarif par zones (4,10 € à 12,10 €) sans zones des arrêts',action:'Lancer la tâche serveur ; zones par arrêt si fare_rules absent'},
 'cars-73':{horaires:'enregistrés',tarif:'manquants',checked:'2026-11-13 · extraction agrégat Oùra (script testé hors ligne)',blocage:'Seulement 8 lignes dans l’agrégat ; aucun tarif publié',action:'Vérifier si d’autres lignes Savoie sont publiées sous un autre nom d’agence (oura-agencies.json)'},
 'ter':{horaires:'enregistrés',tarif:'manquants',checked:'2026-11-13 · catalogue ressources.data.sncf.com (serveur)',blocage:'SNCF ne publie plus de grille TER en open data : jeu « Tarifs TER AURA » archivé (prix au 01/03/2025), absent du catalogue actuel (seuls Intercités 2026 et TGV/OUIGO en fourchettes)',action:'Décision : afficher le prix 2025 comme simple indication, ou clé TripGo, ou garder « Prix à confirmer »'},
 'longue':{horaires:'enregistrés',tarif:'manquants',checked:'2026-10-31 · réponse TripGo enregistrée',blocage:'Prix dynamiques ; TripGo n’a transmis aucun billet dans les réponses enregistrées',action:'Clé TripGo puis diagnostic (Annecy → Genève)'},
 'cff':{horaires:'source branchée',tarif:'manquants',checked:'2026-11-13 · documentation transport.opendata.ch',blocage:'API sans prix ; jamais appelée en réel depuis l’environnement de développement',action:'Diagnostic téléphone (Annecy → Genève)'},
 'tpg':{horaires:'source branchée',tarif:'manquants',checked:'2026-11-13 · page tpg « Occasional travelers »',blocage:'Billet Tout Genève 60 min : prix non affiché sur la page lue (seul le complément zone 10 CHF 3.00 l’est) ; unireso.com illisible au serveur',action:'Grille unireso 2026 (PDF)'},
 'lex':{horaires:'source branchée',tarif:'manquants',checked:'2026-11-13 · guide TAC + grille Jacquet',blocage:'Ticket Léman Pass 210+10 : 4,80 € ou 4,90 € selon la source officielle → non appliqué ; trajets plus longs : tarif « Parcours + zone 10 » non publié par gare',action:'Grille Léman Pass par gare (lemanpass.com)'},
 'tpg-fr':{horaires:'source branchée',tarif:'manquants',checked:'2026-11-13',blocage:'Tarif Léman Pass non intégré',action:'Grille Léman Pass 2026'},
 'lemanpass':{horaires:'indisponibles',tarif:'manquants',checked:'2026-11-13 · guide TAC (14/12/2025), Jacquet (14/12/2025), tpg/Alpbus (→ 12/12/2026), page tpg',blocage:'Sources officielles contradictoires pour le ticket 210+10 : 4,90 € (TAC) contre 4,80 € (Jacquet) → aucun prix ; 10+230 : 4,80 € (tpg/Alpbus) ; compléments zone 10 3,20 € / zone 210 1,70 € (non applicables sans connaître l’abonnement)',action:'Grille lemanpass.com en vigueur (bloquée au serveur) pour trancher 4,80 / 4,90 €'},
 'flexi':{horaires:'indisponibles',tarif:'partiels',checked:'2026-11-13 · communiqué Grand Chambéry 15/05/2025',blocage:'Transport à la demande : réservation obligatoire, pas d’horaires publiés',action:'Information + lien de réservation affichés dans la fiche (13/11) ; rien d’autre possible sans réservation'},
 'mobea':{horaires:'indisponibles',tarif:'partiels',checked:'2026-11-13',blocage:'Transport à la demande : réservation obligatoire',action:'Information + lien affichés dans la fiche (13/11)'},
 'tpgflex':{horaires:'indisponibles',tarif:'manquants',checked:'2026-11-13',blocage:'Transport à la demande : réservation obligatoire',action:'Afficher le lien de réservation'}
};
// Axes de couverture (diagnostic serveur) : tracés sur de vraies lignes des réseaux non vus par les 8 axes principaux.
const AXES_COUVERTURE=[
 {id:'aix-technolac',name:'Aix-les-Bains gare → Technolac (Ondéa 01)',from:{lat:45.6884,lon:5.9094,name:'Aix-les-Bains gare'},to:{lat:45.6437,lon:5.8700,name:'Technolac'},expect:['ondea']},
 {id:'thonon-bons',name:'Thonon → Bons-en-Chablais (Star’t 142)',from:{lat:46.3696,lon:6.4804,name:'Thonon Les Arts'},to:{lat:46.2651,lon:6.3713,name:'Bons-en-Chablais'},expect:['start','ter']},
 {id:'rumilly-intra',name:'Rumilly Hôpital → Base de loisirs (J’y bus 1)',from:{lat:45.8652,lon:5.9361,name:'Rumilly Hôpital'},to:{lat:45.8472,lon:5.9665,name:'Rumilly Base de loisirs'},expect:['jybus']},
 {id:'amberieu-intra',name:'Ambérieu gare → Cabrol (TAM 2)',from:{lat:45.9542,lon:5.3419,name:'Ambérieu gare'},to:{lat:45.9813,lon:5.3527,name:'Ambérieu Cabrol'},expect:['tam']},
 {id:'chambery-chamoux',name:'Chambéry → Chamoux-sur-Gelon (Cars Savoie S05)',from:{lat:45.5699,lon:5.9169,name:'Chambéry gare routière'},to:{lat:45.5362,lon:6.2153,name:'Chamoux-sur-Gelon'},expect:['cars-73']},
 {id:'bourg-amberieu',name:'Bourg-en-Bresse → Ambérieu (Cars Ain / TER)',from:{lat:46.1993,lon:5.2148,name:'Bourg-en-Bresse gare'},to:{lat:45.9542,lon:5.3419,name:'Ambérieu gare'},expect:['cars-01','ter']},
 {id:'voiron-voreppe',name:'Voiron → Voreppe (M réso Voironnais)',from:{lat:45.3643,lon:5.5916,name:'Voiron gare'},to:{lat:45.2950,lon:5.6380,name:'Voreppe'},expect:['mreso-voironnais']}
];
function load(storage){try{return JSON.parse(storage?.getItem(STORE)||'{}')||{};}catch(_){return {};}}
function save(storage,data){try{storage?.setItem(STORE,JSON.stringify(data));}catch(_){}}
function stateOf(n,diag,now=Date.now()){
 const seen=diag?.networks?.[n.id];
 if(seen&&seen.trips>0&&now-Date.parse(seen.at)<=VALID_DAYS*86400000)return 'Validé en réel';
 if(n.recorded.length)return 'Testé sur données enregistrées';
 if(n.sources.length)return 'Partiellement raccordé';
 return 'Non raccordé';
}
function inventory(storage,now=Date.now()){
 const diag=load(storage);
 const rows=NETWORKS.map(n=>{const d=DETAILS[n.id]||{};const real=diag?.networks?.[n.id]||null;const state=stateOf(n,diag,now);
  return {...n,match:undefined,...d,state,real,
   horaires:state==='Validé en réel'?'réels':d.horaires||'indisponibles',
   marche:real?(real.walked>0?'calculée (réel)':'non calculée (réel)'):(n.recorded.length?'calculée (données enregistrées)':'non vérifiée'),
   couverture:state==='Validé en réel'?'validée':state==='Non raccordé'?'absente':'partielle',
   dernierControle:real?real.at+' · diagnostic téléphone':(d.checked||'—')};});
 const zones={};
 for(const r of rows){
  const z=zones[r.zone]||(zones[r.zone]={zone:r.zone,total:0,connected:0,real:0,priced:0,remaining:0});
  z.total++;if(r.state!=='Non raccordé')z.connected++;if(r.state==='Validé en réel')z.real++;if(r.tarif==='vérifiés')z.priced++;
  if(r.tarif==='partiels')z.partialFare=(z.partialFare||0)+1;
  if(r.state!=='Validé en réel'||r.tarif!=='vérifiés')z.remaining++;
 }
 // Inventaire volontairement limité : la Suisse n'est recensée qu'autour de Genève et de la frontière.
 const SCOPE={Suisse:'Genève et frontière seulement',AURA:'réseaux des zones de mission (Savoies, Isère, Ain, Lyon)',Transfrontalier:'Grand Genève',TAD:'services repérés seulement'};
 for(const z of Object.values(zones)){z.connectedPct=Math.round(z.connected/z.total*100);z.realPct=Math.round(z.real/z.total*100);z.scope=SCOPE[z.zone]||'';}
 return {rows,zones:Object.values(zones),lastRun:diag.at||null};
}
// Attribue les trajets trouvés aux réseaux (par le nom d'opérateur/ligne réellement renvoyé par le moteur).
function attribute(journeys){
 const out={};
 for(const j of journeys){
  const seen=new Set();
  for(const l of j.legs||[]){
   if(l.kind==='walk')continue;
   const label=[l.provider,l.line].filter(Boolean).join(' ');
   // Un secteur géographique (ex. M réso Grésivaudan) n'est compté que si l'étape dessert réellement sa zone.
   const inArea=n=>!n.area||[l.fromPoint,l.toPoint].some(p=>p&&p.lat>=n.area[0]&&p.lat<=n.area[2]&&p.lon>=n.area[1]&&p.lon<=n.area[3]);
   for(const n of NETWORKS)if(!n.tariffOnly&&n.match.test(label)&&inArea(n)&&!seen.has(n.id)){
    seen.add(n.id);const o=out[n.id]||(out[n.id]={trips:0,priced:0,walked:0});
    o.trips++;if(j.price?.status==='verified')o.priced++;
    if(!(j.reasons||[]).some(r=>/marche|non calculée|quota|en cours/.test(r)))o.walked++;
   }
  }
 }
 return out;
}
function nextMonday8(now=new Date()){
 const d=new Date(now);d.setDate(d.getDate()+((8-d.getDay())%7||7));
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(x=>[x.type,x.value]));
 const day=p.year+'-'+p.month+'-'+p.day;
 const off=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Paris',timeZoneName:'shortOffset'}).formatToParts(new Date(day+'T12:00:00Z')).find(x=>x.type==='timeZoneName').value.match(/([+-]\d+)/);
 const h=off?Number(off[1]):1;return day+'T08:00:00'+(h>=0?'+':'-')+String(Math.abs(h)).padStart(2,'0')+':00';
}
// Diagnostic réel : un axe = une session du hub avec les VRAIS moteurs (+ GTFS locaux via le worker existant).
async function runDiagnostic({hub,providers,router,fareFor,gtfsAgenda=null,host=null,storage=null,axes=AXES,when=nextMonday8(),onProgress=()=>{},timeoutMs=60000}={}){
 const report={at:new Date().toISOString(),when,axes:[],networks:{}};
 for(const axis of axes){
  const task={label:'Diag',from:axis.from,to:axis.to,fromName:axis.from.name,toName:axis.to.name,fromCity:axis.from.name.split(' ')[0],toCity:axis.to.name.split(' ')[0],earliestDeparture:when};
  const started=Date.now();let firstAt=null,gtfsSession=null;
  const done=new Promise(resolve=>{
   const session=hub.createSession({tasks:[task],providers,router,fareFor,onUpdate:(label,v)=>{
    if(v.total&&firstAt===null)firstAt=Date.now()-started;
    onProgress(axis,v);if(v.done)resolve({session,v});
   }});
   if(gtfsAgenda&&host){
    try{const box=host.ownerDocument.createElement('div');box.hidden=true;host.appendChild(box);
     gtfsSession=gtfsAgenda.mount(box,{tasks:[{label:'Diag',from:axis.from,to:axis.to,earliestDeparture:when}],
      onResults:({itineraries})=>session.ingest('Diag','GTFS local',hub.fromGTFS(itineraries))});}catch(_){}
   }
   setTimeout(()=>resolve({session,v:session.view('Diag'),timedOut:true}),timeoutMs);
  });
  const {session,v,timedOut}=await done;
  // laisser le GTFS local finir (il n'entre pas dans « done » du hub)
  if(gtfsSession)await new Promise(r=>setTimeout(r,Math.min(20000,timeoutMs/3)));
  const view=session.view('Diag');session.dispose();try{gtfsSession?.dispose?.();}catch(_){}
  const all=[...view.picks.map(p=>p.journey),...view.others];
  const nets=attribute(all);
  for(const [id,o] of Object.entries(nets)){const r=report.networks[id]||(report.networks[id]={trips:0,priced:0,walked:0,at:report.at,axes:[]});
   r.trips+=o.trips;r.priced+=o.priced;r.walked+=o.walked;r.axes.push(axis.id);}
  report.axes.push({id:axis.id,name:axis.name,trips:all.length,priced:all.filter(j=>j.price?.status==='verified').length,
   walked:all.filter(j=>!(j.reasons||[]).some(r=>/marche|non calculée|quota|en cours/.test(r))).length,
   feasible:all.filter(j=>j.feasible).length,firstResultMs:firstAt,totalMs:Date.now()-started,timedOut:!!timedOut,
   engines:{errors:view.errors,skipped:view.skipped},networksSeen:Object.keys(nets),expected:axis.expect,
   missingExpected:axis.expect.filter(id=>!nets[id])});
 }
 // fusion avec l'historique : un réseau reste « validé » 30 jours
 const prev=load(storage);const merged={...(prev.networks||{})};
 for(const [id,r] of Object.entries(report.networks))merged[id]=r;
 save(storage,{at:report.at,networks:merged,lastReport:report});
 return report;
}
function reportText(report,inv){
 const L=['Diagnostic transports Convoyage Ultra — '+report.at+' (départs à partir de '+report.when+')',''];
 for(const a of report.axes){
  L.push('• '+a.name+' : '+a.trips+' trajet(s), '+a.priced+' avec prix vérifié, '+a.walked+' avec marches calculées, '+a.feasible+' réalisable(s) ; 1er résultat '+(a.firstResultMs==null?'—':Math.round(a.firstResultMs/100)/10+' s')+', total '+Math.round(a.totalMs/100)/10+' s'+(a.timedOut?' (délai dépassé)':''));
  const errs=Object.entries(a.engines.errors||{}).map(([n,e])=>n+' : '+e);if(errs.length)L.push('   erreurs : '+errs.join(' ; '));
  if(a.networksSeen.length)L.push('   réseaux vus : '+a.networksSeen.join(', '));
  if(a.missingExpected.length)L.push('   attendus non vus : '+a.missingExpected.join(', '));
 }
 if(inv){L.push('','Couverture (dénominateur = réseaux identifiés par zone) :');
  for(const z of inv.zones)L.push('• '+z.zone+(z.scope?' ['+z.scope+']':'')+' : '+z.connected+'/'+z.total+' raccordés ('+z.connectedPct+' %), '+z.real+'/'+z.total+' validés en réel ('+z.realPct+' %), '+z.priced+'/'+z.total+' avec prix vérifié, '+z.remaining+' à terminer');}
 return L.join('\n');
}
function renderInventory(host,inv){
 const doc=host.ownerDocument;host.textContent='';
 const t=doc.createElement('table');t.className='cp-cov';
 t.innerHTML='<thead><tr><th>Zone</th><th>Identifiés</th><th>Raccordés</th><th>Validés réel</th><th>Prix vérifiés</th><th>À finir</th></tr></thead>';
 const b=doc.createElement('tbody');
 for(const z of inv.zones){const tr=doc.createElement('tr');for(const v of [z.zone+(z.scope?' ('+z.scope+')':''),z.total,z.connected+' ('+z.connectedPct+' %)',z.real+' ('+z.realPct+' %)',z.priced,z.remaining]){const td=doc.createElement('td');td.textContent=String(v);tr.appendChild(td);}b.appendChild(tr);}
 t.appendChild(b);host.appendChild(t);
 const ul=doc.createElement('ul');ul.className='cp-cov-list';
 for(const r of inv.rows){const li=doc.createElement('li');
  li.textContent=r.name+' — '+r.state+' · horaires '+r.horaires+' · tarifs '+r.tarif+' · marche '+r.marche+' · contrôle '+r.dernierControle+
   (r.real?' ('+r.real.trips+' trajets réels, '+r.real.priced+' avec prix)':'')+(r.reservation?' · '+r.reservation:'')+
   (r.state!=='Validé en réel'||r.tarif!=='vérifiés'?' · Blocage : '+r.blocage+' → '+r.action:'');
  ul.appendChild(li);}
 host.appendChild(ul);
}
const api={NETWORKS,DETAILS,AXES,AXES_COUVERTURE,STORE,stateOf,inventory,attribute,runDiagnostic,reportText,renderInventory,nextMonday8};
if(typeof module==='object'&&module.exports)module.exports=api;
root.CPTransportCoverage=api;
})(typeof window!=='undefined'?window:globalThis);
