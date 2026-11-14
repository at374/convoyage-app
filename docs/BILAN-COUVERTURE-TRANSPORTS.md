# Bilan chiffré de couverture — transports AURA–Suisse

Généré le 2026-11-14 par `scripts/bilan-couverture-transports.cjs` à partir de `transport-coverage.js`.
Diagnostic réel serveur du 2026-11-14T15:33:13.498Z (départs 2026-11-16T08:00:00+01:00, TripGo : non) intégré : « Validé en réel » = trajets réels obtenus par le serveur ; la validation sur téléphone reste à faire.

## Synthèse par zone (dénominateur = réseaux identifiés dans la zone)

| Zone | Périmètre de l’inventaire | Identifiés | Raccordés | Validés en réel | Prix vérifiés | Prix partiels | Restant à terminer |
|---|---|---|---|---|---|---|---|
| AURA | réseaux des zones de mission (Savoies, Isère, Ain, Lyon) | 17 | 17 (100 %) | 17 (100 %) | 5 (29 %) | 3 | 12 |
| Suisse | Genève et frontière seulement | 2 | 2 (100 %) | 2 (100 %) | 0 (0 %) | 1 | 2 |
| Transfrontalier | Grand Genève | 3 | 2 (67 %) | 2 (67 %) | 0 (0 %) | 0 | 3 |
| TAD | services repérés seulement | 3 | 0 (0 %) | 0 (0 %) | 0 (0 %) | 2 | 3 |
| **Total** | — | 25 | 21 (84 %) | 21 (84 %) | 5 (20 %) | — | **20** |

« Raccordé » = une source officielle est branchée (pas une validation). La présence possible d’un opérateur dans TripGo n’est **jamais** comptée comme raccordement.

## États

- Validé en réel : 21 réseau(x)
- Non raccordé : 4 réseau(x)

## Détail réseau par réseau

| Réseau | Zone | Couverture | Horaires | Tarifs | Marche | Dernier contrôle | Blocage | Prochaine action |
|---|---|---|---|---|---|---|---|---|
| Sibra (Grand Annecy) | AURA | Validé en réel | réels | vérifiés | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | Aucun bloquant connu | Lancer le diagnostic téléphone (axe Rumilly → Annecy) |
| TAC / Genevois français Mobilités (Annemasse, Saint-Julien, Archamps) | AURA | Validé en réel | réels | vérifiés | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | Tram 17 (exploité par tpg, données suisses) non chiffré par cette grille ; 2,00 € à bord de la T1 | Diagnostic téléphone (Annemasse → Saint-Julien) |
| Synchro Bus (Chambéry) | AURA | Validé en réel | réels | vérifiés | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | Montagne/combinés ski non chiffrés ; à revérifier si une grille « juillet 2026 » est publiée | Surveiller une nouvelle délibération tarifaire 2026 |
| Ondéa Grand Lac (Aix-les-Bains) | AURA | Validé en réel | réels | vérifiés | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | Était évincé par Cars Région Savoie sur Chambéry → Aix (un seul partenaire retenu) ; corrigé le 13/11/2026 (Synchro + Ondéa, convention d’extension de la ligne A du 7/07/2025) | Diagnostic téléphone (Chambéry → Aix) pour confirmer en réel |
| Star't (Thonon) | AURA | Validé en réel | réels | manquants | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | Zones connues (liste officielle des communes A/B, star-t.fr) mais prix 2026 non confirmé (1,20 € / 2,20 € sur des pages de 2022–2025) ; arrêts GTFS sans commune ; était évincé sur Thonon → Genève par Cars Région Ain puis par TAC Annemasse (enveloppes larges) — corrigé le 13/11/2026 (le moteur préfère désormais le réseau qui couvre le départ) | Confirmer la grille 2026 ; associer chaque arrêt à sa commune ; diagnostic Thonon → Genève |
| M réso — Métropole grenobloise | AURA | Validé en réel | réels | vérifiés | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | Aucun bloquant connu | Diagnostic téléphone (Grenoble → Crolles) |
| M réso — Grésivaudan | AURA | Validé en réel | réels | partiels | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | Tarif intra-Grésivaudan 1,00 € non appliqué (périmètre des arrêts inconnu) : 2,00 € affiché | Ajouter la liste des communes du Grésivaudan |
| M réso — Voironnais | AURA | Validé en réel | réels | partiels | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | Tarif intra-Voironnais 1,30 € non appliqué : 2,00 € affiché ; attente Voiron → Grenoble retirée le 13/11/2026 (ligne réellement exploitée par Cars Région Isère T40/T41, pas le réseau urbain Voironnais) | Liste des communes du Voironnais pour le tarif intra |
| TCL (Lyon) | AURA | Validé en réel | réels | confirmés (GTFS Fares V1 officiel, 2,10 € zones 1+2) | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | Zone couverte volontairement réduite (Part-Dieu/Bellecour/Perrache) ; F1/F2/7601 ambigus sans prix (comportement voulu) | Diagnostic téléphone (Ambérieu → Lyon Part-Dieu) pour confirmer que la bbox est exercée par une mission réelle |
| J'y bus (Rumilly) | AURA | Validé en réel | réels | confirmés (1,00 €, règlement officiel jybus.fr) | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | Aucun pour le ticket unité | Lancer la tâche « Build regional GTFS », puis diagnostic Rumilly |
| TAM (Ambérieu-en-Bugey) | AURA | Validé en réel | réels | confirmés (1,10 €, fiche tarifaire TAM 2026) | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | Aucun pour le titre 1 voyage | Lancer la tâche « Build regional GTFS », puis diagnostic Ambérieu → Lyon |
| Cars Région Haute-Savoie (dont Y51) | AURA | Validé en réel | réels | partiels | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | Seule la Y51 a une grille par zones ; autres lignes sans prix | Grilles zonales des autres lignes Cars Région 74 |
| Cars Région Ain | AURA | Validé en réel | réels | manquants | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | Tarif par zones non intégré | Grille zonale Cars Région Ain |
| Cars Région Isère | AURA | Validé en réel | réels | manquants | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | Aucun tarif publié dans l’agrégat ; tarif par zones (4,10 € à 12,10 €) sans zones des arrêts | Lancer la tâche serveur ; zones par arrêt si fare_rules absent |
| Cars Région Savoie | AURA | Validé en réel | réels | manquants | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | Seulement 8 lignes dans l’agrégat ; aucun tarif publié | Vérifier si d’autres lignes Savoie sont publiées sous un autre nom d’agence (oura-agencies.json) |
| TER Auvergne-Rhône-Alpes / SNCF | AURA | Validé en réel | réels | manquants | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | SNCF ne publie plus de grille TER en open data : jeu « Tarifs TER AURA » archivé (prix au 01/03/2025), absent du catalogue actuel (seuls Intercités 2026 et TGV/OUIGO en fourchettes) | Décision : afficher le prix 2025 comme simple indication, ou clé TripGo, ou garder « Prix à confirmer » |
| FlixBus / BlaBlaCar Bus | AURA | Validé en réel | réels | manquants | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | Prix dynamiques ; TripGo n’a transmis aucun billet dans les réponses enregistrées | Clé TripGo puis diagnostic (Annecy → Genève) |
| CFF / trains suisses | Suisse | Validé en réel | réels | manquants | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | API sans prix (transport.opendata.ch ne publie aucun tarif) ; aucun autre blocage identifié | Aucune action moteur : chercher si une grille tarifaire SBB/CFF officielle existe ailleurs (hors API) |
| TPG (Genève, zone 10) | Suisse | Validé en réel | réels | partiels | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | Billet Tout Genève zone 10 (3,00 CHF, 60 min) appliqué quand les deux arrêts sont dans le canton ; trajets transfrontaliers (Léman Pass) toujours sans prix | Grille Léman Pass par zones pour les arrêts français |
| Léman Express | Transfrontalier | Validé en réel | réels | manquants | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | Ticket Léman Pass 210+10 : 4,80 € ou 4,90 € selon la source officielle → non appliqué ; trajets plus longs : tarif « Parcours + zone 10 » non publié par gare | Grille Léman Pass par gare (lemanpass.com) |
| TPG lignes transfrontalières | Transfrontalier | Validé en réel | réels | manquants | calculée (réel) | 2026-11-14T15:33:13.498Z · diagnostic téléphone | Tarif Léman Pass non intégré | Grille Léman Pass 2026 |
| Léman Pass (tarif) | Transfrontalier | Non raccordé | indisponibles | manquants | non vérifiée | 2026-11-13 · guide TAC (14/12/2025), Jacquet (14/12/2025), tpg/Alpbus (→ 12/12/2026), page tpg | Sources officielles contradictoires pour le ticket 210+10 : 4,90 € (TAC) contre 4,80 € (Jacquet) → aucun prix ; 10+230 : 4,80 € (tpg/Alpbus) ; compléments zone 10 3,20 € / zone 210 1,70 € (non applicables sans connaître l’abonnement) | Grille lemanpass.com en vigueur (bloquée au serveur) pour trancher 4,80 / 4,90 € |
| Flexi (Synchro, Chambéry) | TAD | Non raccordé | indisponibles | partiels | non vérifiée | 2026-11-13 · communiqué Grand Chambéry 15/05/2025 | Transport à la demande : réservation obligatoire, pas d’horaires publiés | Information + lien de réservation affichés dans la fiche (13/11) ; rien d’autre possible sans réservation |
| Mobéa (Ondéa, Grand Lac) | TAD | Non raccordé | indisponibles | partiels | non vérifiée | 2026-11-13 | Transport à la demande : réservation obligatoire | Information + lien affichés dans la fiche (13/11) |
| TPG Flex | TAD | Non raccordé | indisponibles | manquants | non vérifiée | 2026-11-13 | Transport à la demande : réservation obligatoire | Afficher le lien de réservation |

## Tarifs manquants ou partiels, réseau par réseau

- **Star't (Thonon)** (manquants) : Prix à confirmer (tarif par zones A/B) ; GTFS Fares si publiés — Zones connues (liste officielle des communes A/B, star-t.fr) mais prix 2026 non confirmé (1,20 € / 2,20 € sur des pages de 2022–2025) ; arrêts GTFS sans commune ; était évincé sur Thonon → Genève par Cars Région Ain puis par TAC Annemasse (enveloppes larges) — corrigé le 13/11/2026 (le moteur préfère désormais le réseau qui couvre le départ)
- **M réso — Grésivaudan** (partiels) : Grille officielle 2,00 € (1,00 € intra-Grésivaudan non appliqué) — Tarif intra-Grésivaudan 1,00 € non appliqué (périmètre des arrêts inconnu) : 2,00 € affiché
- **M réso — Voironnais** (partiels) : Grille officielle 2,00 € (1,30 € intra-Voironnais non appliqué) — Tarif intra-Voironnais 1,30 € non appliqué : 2,00 € affiché ; attente Voiron → Grenoble retirée le 13/11/2026 (ligne réellement exploitée par Cars Région Isère T40/T41, pas le réseau urbain Voironnais)
- **TCL (Lyon)** (confirmés (GTFS Fares V1 officiel, 2,10 € zones 1+2)) : Grille officielle 2,10 € confirmée (73/76 lignes ; 3 lignes ambiguës — F1/F2/7601 — sans prix par prudence) — Zone couverte volontairement réduite (Part-Dieu/Bellecour/Perrache) ; F1/F2/7601 ambigus sans prix (comportement voulu)
- **J'y bus (Rumilly)** (confirmés (1,00 €, règlement officiel jybus.fr)) : Grille officielle 1,00 € (règlement jybus.fr, ticket unité 1 h) — Aucun pour le ticket unité
- **TAM (Ambérieu-en-Bugey)** (confirmés (1,10 €, fiche tarifaire TAM 2026)) : Grille officielle 1,10 € (fiche TAM 2026, philibert-transport.fr) — Aucun pour le titre 1 voyage
- **Cars Région Haute-Savoie (dont Y51)** (partiels) : Y51 : grille officielle par zones ; autres lignes à confirmer — Seule la Y51 a une grille par zones ; autres lignes sans prix
- **Cars Région Ain** (manquants) : Prix à confirmer (zones) — Tarif par zones non intégré
- **Cars Région Isère** (manquants) : Zonal confirmé (4,10 € à 12,10 €, zones par arrêt toujours indisponibles) — Aucun tarif publié dans l’agrégat ; tarif par zones (4,10 € à 12,10 €) sans zones des arrêts
- **Cars Région Savoie** (manquants) : Par ligne (3 € à 12,50 €), pas de tarif réseau unique — Seulement 8 lignes dans l’agrégat ; aucun tarif publié
- **TER Auvergne-Rhône-Alpes / SNCF** (manquants) : Prix dynamique : pas de source autorisée gratuite — SNCF ne publie plus de grille TER en open data : jeu « Tarifs TER AURA » archivé (prix au 01/03/2025), absent du catalogue actuel (seuls Intercités 2026 et TGV/OUIGO en fourchettes)
- **FlixBus / BlaBlaCar Bus** (manquants) : Prix dynamique : à confirmer (billet TripGo repris s’il est transmis) — Prix dynamiques ; TripGo n’a transmis aucun billet dans les réponses enregistrées
- **CFF / trains suisses** (manquants) : Prix à confirmer (pas de prix dans l’API) — API sans prix (transport.opendata.ch ne publie aucun tarif) ; aucun autre blocage identifié
- **TPG (Genève, zone 10)** (partiels) : 3,00 CHF confirmé (zone 10 uniquement) ; non appliqué, zone par arrêt indisponible — Billet Tout Genève zone 10 (3,00 CHF, 60 min) appliqué quand les deux arrêts sont dans le canton ; trajets transfrontaliers (Léman Pass) toujours sans prix
- **Léman Express** (manquants) : Léman Pass : prix à confirmer — Ticket Léman Pass 210+10 : 4,80 € ou 4,90 € selon la source officielle → non appliqué ; trajets plus longs : tarif « Parcours + zone 10 » non publié par gare
- **TPG lignes transfrontalières** (manquants) : Léman Pass : prix à confirmer — Tarif Léman Pass non intégré
- **Léman Pass (tarif)** (manquants) : Aucune grille officielle 2026 intégrée — Sources officielles contradictoires pour le ticket 210+10 : 4,90 € (TAC) contre 4,80 € (Jacquet) → aucun prix ; 10+230 : 4,80 € (tpg/Alpbus) ; compléments zone 10 3,20 € / zone 210 1,70 € (non applicables sans connaître l’abonnement)
- **Flexi (Synchro, Chambéry)** (partiels) : Même tarif que le bus Synchro — Transport à la demande : réservation obligatoire, pas d’horaires publiés
- **Mobéa (Ondéa, Grand Lac)** (partiels) : Tarif Ondéa — Transport à la demande : réservation obligatoire
- **TPG Flex** (manquants) : Prix à confirmer — Transport à la demande : réservation obligatoire

## Diagnostic réel serveur, par axe

| Axe | Trajets | Prix vérifié | Marches calculées | Réalisables | Sources | Erreurs |
|---|---|---|---|---|---|---|
| Annecy → Genève | 51 | 0 | 51 | 6 | SNCF (GTFS officiel), FlixBus (GTFS), SNCF (GTFS), BlaBlaCar Bus (GTFS), Cars Région Haute-Savoie (GTFS) | — |
| Annemasse → Saint-Julien-en-Genevois | 78 | 54 | 78 | 12 | Suisse (transport.opendata.ch), SNCF (GTFS officiel), TAC Annemasse (GTFS), SNCF (GTFS) | — |
| Ambérieu-en-Bugey → Lyon Part-Dieu | 24 | 0 | 24 | 5 | SNCF (GTFS officiel), SNCF (GTFS) | — |
| Chambéry → Aix-les-Bains | 63 | 4 | 63 | 5 | Synchro Bus Chambéry (GTFS), Synchro Chambéry (GTFS), SNCF (GTFS officiel), SNCF (GTFS), FlixBus (GTFS), Ondéa Aix-les-Bains (GTFS) | — |
| Grenoble → Crolles | 30 | 5 | 30 | 12 | Mobilités M, SNCF (GTFS officiel), SNCF (GTFS), BlaBlaCar Bus (GTFS) | — |
| Rumilly → Annecy | 25 | 1 | 25 | 6 | Sibra (GTFS), SNCF (GTFS officiel), SNCF (GTFS) | — |
| Thonon-les-Bains → Genève | 26 | 0 | 25 | 9 | SNCF (GTFS officiel), Suisse (transport.opendata.ch), SNCF (GTFS), FlixBus (GTFS) | — |
| Voiron → Grenoble | 39 | 0 | 39 | 4 | SNCF (GTFS officiel), SNCF (GTFS), Mobilités M, Cars Région Isère (GTFS), BlaBlaCar Bus (GTFS), FlixBus (GTFS) | — |
| Aix-les-Bains gare → Technolac (Ondéa 01) | 52 | 40 | 52 | 1 | Ondéa Aix-les-Bains (GTFS), SNCF (GTFS officiel), SNCF (GTFS) | — |
| Thonon → Bons-en-Chablais (Star’t 142) | 71 | 7 | 71 | 11 | Star't Thonon (GTFS), SNCF (GTFS officiel), SNCF (GTFS), Suisse (transport.opendata.ch) | — |
| Rumilly Hôpital → Base de loisirs (J’y bus 1) | 51 | 51 | 51 | 0 | J’y bus Rumilly (GTFS), J'y bus Rumilly (GTFS) | — |
| Ambérieu gare → Cabrol (TAM 2) | 76 | 76 | 76 | 0 | TAM Ambérieu (GTFS), TAM Ambérieu-en-Bugey (GTFS), Cars Région Ain (GTFS) | — |
| Chambéry → Chamoux-sur-Gelon (Cars Savoie S05) | 21 | 0 | 21 | 8 | SNCF (GTFS officiel), SNCF (GTFS), Cars Région Savoie (GTFS) | — |
| Bourg-en-Bresse → Ambérieu (Cars Ain / TER) | 18 | 1 | 18 | 3 | Cars Région Ain (GTFS), SNCF (GTFS officiel), SNCF (GTFS) | — |
| Genève → Lausanne | 26 | 0 | 26 | 8 | Suisse (transport.opendata.ch), BlaBlaCar Bus (GTFS), FlixBus (GTFS) | — |
| Annemasse → Genève | 33 | 0 | 31 | 11 | Suisse (transport.opendata.ch), SNCF (GTFS officiel), SNCF (GTFS) | — |
| Saint-Julien-en-Genevois → Genève | 55 | 10 | 55 | 8 | SNCF (GTFS officiel), Suisse (transport.opendata.ch), SNCF (GTFS), Cars Région Haute-Savoie (GTFS) | — |
| Archamps → Genève | 27 | 23 | 27 | 8 | Suisse (transport.opendata.ch), SNCF (GTFS), SNCF (GTFS officiel) | — |
| Chambéry → Saint-Julien-en-Genevois | 15 | 0 | 15 | 12 | Suisse (transport.opendata.ch), SNCF (GTFS officiel), SNCF (GTFS) | — |
| Annecy → Chambéry | 39 | 0 | 39 | 7 | SNCF (GTFS officiel), SNCF (GTFS), BlaBlaCar Bus (GTFS), FlixBus (GTFS) | — |
| Lyon → Grenoble | 58 | 0 | 58 | 7 | SNCF (GTFS officiel), SNCF (GTFS), FlixBus (GTFS), BlaBlaCar Bus (GTFS) | — |
| Lyon Part-Dieu → Bellecour (TCL) | 50 | 42 | 50 | 1 | Marche (Valhalla / OpenStreetMap), SNCF (GTFS), TCL Lyon (GTFS), TCL (GTFS) | — |
| Voiron → Voreppe (M réso Voironnais) | 35 | 2 | 35 | 12 | Mobilités M, SNCF (GTFS officiel), SNCF (GTFS), Cars Région Isère (GTFS) | — |

## Axes du diagnostic téléphone

Dans l’application : Réglages → « Couverture et diagnostic des transports » → « Lancer le diagnostic réel », puis « Copier le rapport ».

- Annecy → Genève — réseaux attendus : ter, lex, cff, longue
- Annemasse → Saint-Julien-en-Genevois — réseaux attendus : tac, lex, tpg-fr
- Ambérieu-en-Bugey → Lyon Part-Dieu — réseaux attendus : ter
- Chambéry → Aix-les-Bains — réseaux attendus : ter, synchro, ondea
- Grenoble → Crolles — réseaux attendus : mreso-metro, mreso-gresivaudan
- Rumilly → Annecy — réseaux attendus : ter, sibra
- Thonon-les-Bains → Genève — réseaux attendus : lex, tpg-fr
- Voiron → Grenoble — réseaux attendus : cars-38, ter
