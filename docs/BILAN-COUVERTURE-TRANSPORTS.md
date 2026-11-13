# Bilan chiffré de couverture — transports AURA–Suisse

Généré le 2026-11-13 par `scripts/bilan-couverture-transports.cjs` à partir de `transport-coverage.js`.
**Aucun diagnostic réel n’a encore été lancé** : aucun réseau n’est donc « Validé en réel ».

## Synthèse par zone (dénominateur = réseaux identifiés dans la zone)

| Zone | Périmètre de l’inventaire | Identifiés | Raccordés | Validés en réel | Prix vérifiés | Prix partiels | Restant à terminer |
|---|---|---|---|---|---|---|---|
| AURA | réseaux des zones de mission (Savoies, Isère, Ain, Lyon) | 17 | 16 (94 %) | 0 (0 %) | 3 (18 %) | 3 | 17 |
| Suisse | Genève et frontière seulement | 2 | 2 (100 %) | 0 (0 %) | 0 (0 %) | 0 | 2 |
| Transfrontalier | Grand Genève | 3 | 2 (67 %) | 0 (0 %) | 0 (0 %) | 0 | 3 |
| TAD | services repérés seulement | 3 | 0 (0 %) | 0 (0 %) | 0 (0 %) | 2 | 3 |
| **Total** | — | 25 | 20 (80 %) | 0 (0 %) | 3 (12 %) | — | **25** |

« Raccordé » = une source officielle est branchée (pas une validation). La présence possible d’un opérateur dans TripGo n’est **jamais** comptée comme raccordement.

## États

- Testé sur données enregistrées : 14 réseau(x)
- Partiellement raccordé : 6 réseau(x)
- Non raccordé : 5 réseau(x)

## Détail réseau par réseau

| Réseau | Zone | Couverture | Horaires | Tarifs | Marche | Dernier contrôle | Blocage | Prochaine action |
|---|---|---|---|---|---|---|---|---|
| Sibra (Grand Annecy) | AURA | Testé sur données enregistrées | enregistrés | vérifiés | calculée (données enregistrées) | 2026-11-13 · CGV Sibra 01/07/2026 | Aucun bloquant connu | Lancer le diagnostic téléphone (axe Rumilly → Annecy) |
| TAC / Genevois français Mobilités (Annemasse, Saint-Julien, Archamps) | AURA | Testé sur données enregistrées | enregistrés | manquants | calculée (données enregistrées) | 2026-11-13 · GTFS TAC (transport.data.gouv) | Aucune grille tarifaire officielle 2026 trouvée en ligne ; copie servie par le site prévue (tâche serveur), source d’origine en secours | Diagnostic téléphone (Annemasse → Saint-Julien) ; photo de la grille TAC 2026 |
| Synchro Bus (Chambéry) | AURA | Testé sur données enregistrées | enregistrés | manquants | calculée (données enregistrées) | 2026-11-13 · page tickets + CGV 02/07/2026 | Grille 2026 ambiguë (1,40 € sur la page tickets, 1,70 € dans les CGV) | Photo de la grille Synchro en vigueur ; diagnostic Chambéry → Aix |
| Ondéa Grand Lac (Aix-les-Bains) | AURA | Testé sur données enregistrées | enregistrés | vérifiés | calculée (données enregistrées) | 2026-11-13 · ondeagrandlac.fr (01/07/2026) | GTFS jamais chargé en réel | Diagnostic téléphone (Chambéry → Aix) |
| Star't (Thonon) | AURA | Testé sur données enregistrées | enregistrés | manquants | calculée (données enregistrées) | 2026-11-13 · star-t.fr (2025) | Zones connues (liste officielle des communes A/B, star-t.fr) mais prix 2026 non confirmé (1,20 € / 2,20 € sur des pages de 2022–2025) ; arrêts GTFS sans commune | Confirmer la grille 2026 ; associer chaque arrêt à sa commune ; diagnostic Thonon → Genève |
| M réso — Métropole grenobloise | AURA | Testé sur données enregistrées | enregistrés | vérifiés | calculée (données enregistrées) | 2026-11-13 · reso-m.fr (01/09/2026) | Aucun bloquant connu | Diagnostic téléphone (Grenoble → Crolles) |
| M réso — Grésivaudan | AURA | Testé sur données enregistrées | enregistrés | partiels | calculée (données enregistrées) | 2026-11-13 · reso-m.fr (01/09/2026) | Tarif intra-Grésivaudan 1,00 € non appliqué (périmètre des arrêts inconnu) : 2,00 € affiché | Ajouter la liste des communes du Grésivaudan |
| M réso — Voironnais | AURA | Partiellement raccordé | source branchée | partiels | non vérifiée | 2026-11-13 · reso-m.fr (01/10/2026) | Tarif intra-Voironnais 1,30 € non appliqué : 2,00 € affiché | Diagnostic Voiron → Grenoble ; liste des communes du Voironnais |
| TCL (Lyon) | AURA | Non raccordé | indisponibles | manquants | non vérifiée | 2026-11-13 · MobilityDatabase / guide TCL mai 2026 | GTFS TCL (654 lignes) trop lourd pour le téléphone ; tarifs par zones | Relais serveur GTFS TCL ou clé TripGo ; carte des zones TCL par arrêt |
| J'y bus (Rumilly) | AURA | Testé sur données enregistrées | enregistrés | manquants | calculée (données enregistrées) | 2026-11-13 · extraction agrégat Oùra (script testé hors ligne) | Aucun tarif publié dans l’agrégat Oùra ; pas de grille officielle trouvée | Lancer la tâche « Build regional GTFS », puis diagnostic Rumilly |
| TAM (Ambérieu-en-Bugey) | AURA | Testé sur données enregistrées | enregistrés | manquants | calculée (données enregistrées) | 2026-11-13 · extraction agrégat Oùra (script testé hors ligne) | Aucun tarif publié dans l’agrégat Oùra ; pas de grille officielle trouvée | Lancer la tâche « Build regional GTFS », puis diagnostic Ambérieu → Lyon |
| Cars Région Haute-Savoie (dont Y51) | AURA | Testé sur données enregistrées | enregistrés | partiels | calculée (données enregistrées) | 2026-10-31 · fiche tarifaire Y51 AURA 2026 | Seule la Y51 a une grille par zones ; autres lignes sans prix | Grilles zonales des autres lignes Cars Région 74 |
| Cars Région Ain | AURA | Partiellement raccordé | source branchée | manquants | non vérifiée | 2026-11-13 · GTFS Oùra Ain | Tarif par zones non intégré | Grille zonale Cars Région Ain |
| Cars Région Isère | AURA | Testé sur données enregistrées | enregistrés | manquants | calculée (données enregistrées) | 2026-11-13 · extraction agrégat Oùra (script testé hors ligne) | Aucun tarif publié dans l’agrégat ; tarif par zones (4,10 € à 12,10 €) sans zones des arrêts | Lancer la tâche serveur ; zones par arrêt si fare_rules absent |
| Cars Région Savoie | AURA | Testé sur données enregistrées | enregistrés | manquants | calculée (données enregistrées) | 2026-11-13 · extraction agrégat Oùra (script testé hors ligne) | Seulement 8 lignes dans l’agrégat ; aucun tarif publié | Vérifier si d’autres lignes Savoie sont publiées sous un autre nom d’agence (oura-agencies.json) |
| TER Auvergne-Rhône-Alpes / SNCF | AURA | Testé sur données enregistrées | enregistrés | manquants | calculée (données enregistrées) | 2026-11-13 · fichiers SNCF quotidiens du dépôt | Prix TER dynamiques : aucune source gratuite autorisée | Aucune solution gratuite identifiée ; garder « Prix à confirmer » |
| FlixBus / BlaBlaCar Bus | AURA | Testé sur données enregistrées | enregistrés | manquants | calculée (données enregistrées) | 2026-10-31 · réponse TripGo enregistrée | Prix dynamiques ; TripGo n’a transmis aucun billet dans les réponses enregistrées | Clé TripGo puis diagnostic (Annecy → Genève) |
| CFF / trains suisses | Suisse | Partiellement raccordé | source branchée | manquants | non vérifiée | 2026-11-13 · documentation transport.opendata.ch | API sans prix ; jamais appelée en réel depuis l’environnement de développement | Diagnostic téléphone (Annecy → Genève) |
| TPG (Genève, zone 10) | Suisse | Partiellement raccordé | source branchée | manquants | non vérifiée | 2026-11-13 · dépliants unireso 2019–2024 | CHF 3.– non confirmé pour 2026 | Grille unireso 2026 |
| Léman Express | Transfrontalier | Partiellement raccordé | source branchée | manquants | non vérifiée | 2026-11-13 | Tarif Léman Pass non intégré | Grille Léman Pass 2026 (zones 10/210/230/300…) |
| TPG lignes transfrontalières | Transfrontalier | Partiellement raccordé | source branchée | manquants | non vérifiée | 2026-11-13 | Tarif Léman Pass non intégré | Grille Léman Pass 2026 |
| Léman Pass (tarif) | Transfrontalier | Non raccordé | indisponibles | manquants | non vérifiée | 2026-11-13 · TAC guide des tarifs, lemanpass.com (pages 2025) | Prix trouvés seulement sur des pages 2025 (ex. billet 210+10 à 4,90 €, 90 min) ; tarif calculé par origine-destination ; aucune grille 2026 | Grille Léman Pass 2026 (PDF officiel lemanpass.com) |
| Flexi (Synchro, Chambéry) | TAD | Non raccordé | indisponibles | partiels | non vérifiée | 2026-11-13 · communiqué Grand Chambéry 15/05/2025 | Transport à la demande : réservation obligatoire, pas d’horaires publiés | Information + lien de réservation affichés dans la fiche (13/11) ; rien d’autre possible sans réservation |
| Mobéa (Ondéa, Grand Lac) | TAD | Non raccordé | indisponibles | partiels | non vérifiée | 2026-11-13 | Transport à la demande : réservation obligatoire | Information + lien affichés dans la fiche (13/11) |
| TPG Flex | TAD | Non raccordé | indisponibles | manquants | non vérifiée | 2026-11-13 | Transport à la demande : réservation obligatoire | Afficher le lien de réservation |

## Tarifs manquants ou partiels, réseau par réseau

- **TAC / Genevois français Mobilités (Annemasse, Saint-Julien, Archamps)** (manquants) : Prix à confirmer (aucune grille officielle trouvée) ; GTFS Fares si publiés — Aucune grille tarifaire officielle 2026 trouvée en ligne ; copie servie par le site prévue (tâche serveur), source d’origine en secours
- **Synchro Bus (Chambéry)** (manquants) : Prix à confirmer (grille 2026 ambiguë) ; GTFS Fares si publiés — Grille 2026 ambiguë (1,40 € sur la page tickets, 1,70 € dans les CGV)
- **Star't (Thonon)** (manquants) : Prix à confirmer (tarif par zones A/B) ; GTFS Fares si publiés — Zones connues (liste officielle des communes A/B, star-t.fr) mais prix 2026 non confirmé (1,20 € / 2,20 € sur des pages de 2022–2025) ; arrêts GTFS sans commune
- **M réso — Grésivaudan** (partiels) : Grille officielle 2,00 € (1,00 € intra-Grésivaudan non appliqué) — Tarif intra-Grésivaudan 1,00 € non appliqué (périmètre des arrêts inconnu) : 2,00 € affiché
- **M réso — Voironnais** (partiels) : Grille officielle 2,00 € (1,30 € intra-Voironnais non appliqué) — Tarif intra-Voironnais 1,30 € non appliqué : 2,00 € affiché
- **TCL (Lyon)** (manquants) : Prix à confirmer (zones TCL ; GTFS TCL trop lourd pour le téléphone) — GTFS TCL (654 lignes) trop lourd pour le téléphone ; tarifs par zones
- **J'y bus (Rumilly)** (manquants) : Prix à confirmer — Aucun tarif publié dans l’agrégat Oùra ; pas de grille officielle trouvée
- **TAM (Ambérieu-en-Bugey)** (manquants) : Prix à confirmer — Aucun tarif publié dans l’agrégat Oùra ; pas de grille officielle trouvée
- **Cars Région Haute-Savoie (dont Y51)** (partiels) : Y51 : grille officielle par zones ; autres lignes à confirmer — Seule la Y51 a une grille par zones ; autres lignes sans prix
- **Cars Région Ain** (manquants) : Prix à confirmer (zones) — Tarif par zones non intégré
- **Cars Région Isère** (manquants) : Prix à confirmer (zones 4,10 € à 12,10 €, zones des arrêts inconnues) — Aucun tarif publié dans l’agrégat ; tarif par zones (4,10 € à 12,10 €) sans zones des arrêts
- **Cars Région Savoie** (manquants) : Prix à confirmer — Seulement 8 lignes dans l’agrégat ; aucun tarif publié
- **TER Auvergne-Rhône-Alpes / SNCF** (manquants) : Prix dynamique : pas de source autorisée gratuite — Prix TER dynamiques : aucune source gratuite autorisée
- **FlixBus / BlaBlaCar Bus** (manquants) : Prix dynamique : à confirmer (billet TripGo repris s’il est transmis) — Prix dynamiques ; TripGo n’a transmis aucun billet dans les réponses enregistrées
- **CFF / trains suisses** (manquants) : Prix à confirmer (pas de prix dans l’API) — API sans prix ; jamais appelée en réel depuis l’environnement de développement
- **TPG (Genève, zone 10)** (manquants) : Prix à confirmer (CHF 3.– non confirmé pour 2026) — CHF 3.– non confirmé pour 2026
- **Léman Express** (manquants) : Léman Pass : prix à confirmer — Tarif Léman Pass non intégré
- **TPG lignes transfrontalières** (manquants) : Léman Pass : prix à confirmer — Tarif Léman Pass non intégré
- **Léman Pass (tarif)** (manquants) : Aucune grille officielle 2026 intégrée — Prix trouvés seulement sur des pages 2025 (ex. billet 210+10 à 4,90 €, 90 min) ; tarif calculé par origine-destination ; aucune grille 2026
- **Flexi (Synchro, Chambéry)** (partiels) : Même tarif que le bus Synchro — Transport à la demande : réservation obligatoire, pas d’horaires publiés
- **Mobéa (Ondéa, Grand Lac)** (partiels) : Tarif Ondéa — Transport à la demande : réservation obligatoire
- **TPG Flex** (manquants) : Prix à confirmer — Transport à la demande : réservation obligatoire

## Axes du diagnostic téléphone

Dans l’application : Réglages → « Couverture et diagnostic des transports » → « Lancer le diagnostic réel », puis « Copier le rapport ».

- Annecy → Genève — réseaux attendus : ter, lex, cff, longue
- Annemasse → Saint-Julien-en-Genevois — réseaux attendus : tac, lex, tpg-fr
- Ambérieu-en-Bugey → Lyon Part-Dieu — réseaux attendus : ter, cars-01, tcl
- Chambéry → Aix-les-Bains — réseaux attendus : ter, synchro, ondea
- Grenoble → Crolles — réseaux attendus : mreso-metro, mreso-gresivaudan
- Rumilly → Annecy — réseaux attendus : ter, jybus, cars-74
- Thonon-les-Bains → Genève — réseaux attendus : lex, start, tpg-fr
- Voiron → Grenoble — réseaux attendus : mreso-voironnais, ter
