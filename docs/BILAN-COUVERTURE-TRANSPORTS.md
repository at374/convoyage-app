# Bilan chiffré de couverture — transports AURA–Suisse

Généré le 2026-11-24 par `scripts/bilan-couverture-transports.cjs` à partir de `transport-coverage.js`.
Diagnostic réel serveur du 2026-11-24T15:14:12.261Z (départs 2026-11-30T08:00:00+01:00, TripGo : non) intégré : « Validé en réel » = trajets réels obtenus par le serveur ; la validation sur téléphone reste à faire.

## Synthèse par zone (dénominateur = réseaux identifiés dans la zone)

| Zone | Périmètre de l’inventaire | Identifiés | Raccordés | Validés en réel | Prix vérifiés | Prix partiels | Restant à terminer |
|---|---|---|---|---|---|---|---|
| AURA | réseaux des zones de mission (Savoies, Isère, Ain, Lyon) | 20 | 20 (100 %) | 17 (85 %) | 8 (40 %) | 4 | 12 |
| Suisse | Genève et frontière seulement | 2 | 2 (100 %) | 2 (100 %) | 0 (0 %) | 1 | 2 |
| Transfrontalier | Grand Genève | 3 | 2 (67 %) | 2 (67 %) | 0 (0 %) | 2 | 3 |
| TAD | services repérés seulement | 3 | 0 (0 %) | 0 (0 %) | 0 (0 %) | 2 | 3 |
| **Total** | — | 28 | 24 (86 %) | 21 (75 %) | 8 (29 %) | — | **20** |

« Raccordé » = une source officielle est branchée (pas une validation). La présence possible d’un opérateur dans TripGo n’est **jamais** comptée comme raccordement.

## États

- Validé en réel : 21 réseau(x)
- Testé sur données enregistrées : 3 réseau(x)
- Non raccordé : 4 réseau(x)

## Détail réseau par réseau

| Réseau | Zone | Couverture | Horaires | Tarifs | Marche | Dernier contrôle | Blocage | Prochaine action |
|---|---|---|---|---|---|---|---|---|
| Sibra (Grand Annecy) | AURA | Validé en réel | réels | vérifiés | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | Aucun bloquant connu | Lancer le diagnostic téléphone (axe Rumilly → Annecy) |
| TAC / Genevois français Mobilités (Annemasse, Saint-Julien, Archamps) | AURA | Validé en réel | réels | vérifiés | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | Tram 17 (exploité par tpg, données suisses) non chiffré par cette grille ; 2,00 € à bord de la T1 | Diagnostic téléphone (Annemasse → Saint-Julien) |
| Synchro Bus (Chambéry) | AURA | Validé en réel | réels | vérifiés | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | Montagne/combinés ski non chiffrés ; à revérifier si une grille « juillet 2026 » est publiée | Surveiller une nouvelle délibération tarifaire 2026 |
| Ondéa Grand Lac (Aix-les-Bains) | AURA | Validé en réel | réels | vérifiés | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | Était évincé par Cars Région Savoie sur Chambéry → Aix (un seul partenaire retenu) ; corrigé le 13/11/2026 (Synchro + Ondéa, convention d’extension de la ligne A du 7/07/2025) | Diagnostic téléphone (Chambéry → Aix) pour confirmer en réel |
| Star't (Thonon) | AURA | Validé en réel | réels | manquants | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | Zones connues (liste officielle des communes A/B, star-t.fr) mais prix 2026 non confirmé (1,20 € / 2,20 € sur des pages de 2022–2025) ; arrêts GTFS sans commune ; était évincé sur Thonon → Genève par Cars Région Ain puis par TAC Annemasse (enveloppes larges) — corrigé le 13/11/2026 (le moteur préfère désormais le réseau qui couvre le départ) | Confirmer la grille 2026 ; associer chaque arrêt à sa commune ; diagnostic Thonon → Genève |
| M réso — Métropole grenobloise | AURA | Validé en réel | réels | vérifiés | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | Aucun bloquant connu | Diagnostic téléphone (Grenoble → Crolles) |
| M réso — Grésivaudan | AURA | Validé en réel | réels | partiels | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | Tarif intra-Grésivaudan 1,00 € non appliqué (périmètre des arrêts inconnu) : 2,00 € affiché | Ajouter la liste des communes du Grésivaudan |
| M réso — Voironnais | AURA | Validé en réel | réels | partiels | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | Tarif intra-Voironnais 1,30 € non appliqué : 2,00 € affiché ; attente Voiron → Grenoble retirée le 13/11/2026 (ligne réellement exploitée par Cars Région Isère T40/T41, pas le réseau urbain Voironnais) | Liste des communes du Voironnais pour le tarif intra |
| TCL (Lyon) | AURA | Validé en réel | réels | partiels | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | Zone couverte volontairement réduite (Part-Dieu/Bellecour/Perrache) ; F1/F2/7601 ambigus sans prix (comportement voulu) | Diagnostic téléphone (Ambérieu → Lyon Part-Dieu) pour confirmer que la bbox est exercée par une mission réelle |
| J'y bus (Rumilly) | AURA | Validé en réel | réels | vérifiés | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | Aucun pour le ticket unité | Lancer la tâche « Build regional GTFS », puis diagnostic Rumilly |
| TAM (Ambérieu-en-Bugey) | AURA | Validé en réel | réels | vérifiés | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | Aucun pour le titre 1 voyage | Lancer la tâche « Build regional GTFS », puis diagnostic Ambérieu → Lyon |
| Cars Région Haute-Savoie (dont Y51) | AURA | Validé en réel | réels | partiels | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | Seule la Y51 a une grille par zones ; autres lignes sans prix | Grilles zonales des autres lignes Cars Région 74 |
| Cars Région Ain | AURA | Validé en réel | réels | vérifiés | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | Exceptions locales non tarifées automatiquement ; contrôle de couverture GPS et horaires requis | Tester les trajets Ain hors exceptions et vérifier les dérogations locales |
| Cars Région Isère | AURA | Validé en réel | réels | manquants | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | Aucun tarif publié dans l’agrégat ; tarif par zones (4,10 € à 12,10 €) sans zones des arrêts | Lancer la tâche serveur ; zones par arrêt si fare_rules absent |
| Cars Région Savoie | AURA | Validé en réel | réels | manquants | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | Seulement 8 lignes dans l’agrégat ; aucun tarif publié | Vérifier si d’autres lignes Savoie sont publiées sous un autre nom d’agence (oura-agencies.json) |
| TER Auvergne-Rhône-Alpes / SNCF | AURA | Validé en réel | réels | manquants | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | SNCF ne publie plus de grille TER en open data : jeu « Tarifs TER AURA » archivé (prix au 01/03/2025), absent du catalogue actuel (seuls Intercités 2026 et TGV/OUIGO en fourchettes) | Décision : afficher le prix 2025 comme simple indication, ou clé TripGo, ou garder « Prix à confirmer » |
| FlixBus / BlaBlaCar Bus | AURA | Validé en réel | réels | manquants | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | Prix dynamiques ; TripGo n’a transmis aucun billet dans les réponses enregistrées | Clé TripGo puis diagnostic (Annecy → Genève) |
| Citéa (Valence Romans Mobilités) | AURA | Testé sur données enregistrées | enregistrés (confirmé en réel) | manquants | calculée (données enregistrées) | 2026-11-15 · archive officielle réelle (build-regional-gtfs.yml, 286 lignes, 17 672 courses, 2 208 arrêts) | fare_attributes absent du flux | Diagnostic téléphone (Valence ↔ Romans-sur-Isère) pour confirmer en réel |
| STAS (Saint-Étienne Métropole) | AURA | Testé sur données enregistrées | enregistrés (confirmé en réel) | manquants | calculée (données enregistrées) | 2026-11-15 · archive officielle réelle (build-regional-gtfs.yml, 53 lignes, 23 461 courses, 1 067 arrêts) ; bbox provisoire confirmée bonne | fare_attributes absent du flux | Diagnostic téléphone (intra-Saint-Étienne) pour confirmer en réel |
| T2C (Clermont Auvergne Métropole) | AURA | Testé sur données enregistrées | enregistrés (confirmé en réel) | manquants | calculée (données enregistrées) | 2026-11-15 · archive officielle réelle (build-regional-gtfs.yml, 46 lignes, 5 589 courses, 1 694 arrêts) ; bbox provisoire confirmée bonne | fare_attributes absent du flux | Diagnostic téléphone (intra-Clermont-Ferrand) pour confirmer en réel |
| CFF / trains suisses | Suisse | Validé en réel | réels | manquants | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | API sans prix (transport.opendata.ch ne publie aucun tarif) ; aucun autre blocage identifié | Aucune action moteur : chercher si une grille tarifaire SBB/CFF officielle existe ailleurs (hors API) |
| TPG (Genève, zone 10) | Suisse | Validé en réel | réels | partiels | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | Billet Tout Genève zone 10 (3,00 CHF, 60 min) appliqué quand les deux arrêts sont dans le canton ; trajets transfrontaliers (Léman Pass) toujours sans prix | Grille Léman Pass par zones pour les arrêts français |
| Léman Express | Transfrontalier | Validé en réel | réels | partiels | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | 4,90 € 10+210 appliqué uniquement aux trains Annemasse ↔ gares genevoises reconnues ; autres parcours sans grille par gare | Compléter les autres zones Léman Pass par gare |
| TPG lignes transfrontalières | Transfrontalier | Validé en réel | réels | manquants | calculée (réel) | 2026-11-24T15:14:12.261Z · diagnostic téléphone | Le billet 10+210 à 4,90 € est intégré pour certains trains Annemasse–Genève, mais pas pour les bus TPG transfrontaliers : aucun prix fiable sans zones des arrêts | Associer les arrêts TPG transfrontaliers aux zones Léman Pass officielles |
| Léman Pass (tarif) | Transfrontalier | Non raccordé | indisponibles | partiels | non vérifiée | 2026-11-16 · grille TAC 10+210 et matrice officielle ligne 272 intégrées au moteur | 10+210 à 4,90 € uniquement pour les gares prouvées ; ligne 272 tarifée par identifiants GTFS recoupés ; autres zones et arrêts sans prix certain | Compléter les autres zones et arrêts Léman Pass avec sources officielles |
| Flexi (Synchro, Chambéry) | TAD | Non raccordé | indisponibles | partiels | non vérifiée | 2026-11-13 · communiqué Grand Chambéry 15/05/2025 | Transport à la demande : réservation obligatoire, pas d’horaires publiés | Information + lien de réservation affichés dans la fiche (13/11) ; rien d’autre possible sans réservation |
| Mobéa (Ondéa, Grand Lac) | TAD | Non raccordé | indisponibles | partiels | non vérifiée | 2026-11-13 | Transport à la demande : réservation obligatoire | Information + lien affichés dans la fiche (13/11) |
| TPG Flex | TAD | Non raccordé | indisponibles | manquants | non vérifiée | 2026-11-13 | Transport à la demande : réservation obligatoire | Afficher le lien de réservation |

## Tarifs manquants ou partiels, réseau par réseau

- **Star't (Thonon)** (manquants) : Prix à confirmer (tarif par zones A/B) ; GTFS Fares si publiés — Zones connues (liste officielle des communes A/B, star-t.fr) mais prix 2026 non confirmé (1,20 € / 2,20 € sur des pages de 2022–2025) ; arrêts GTFS sans commune ; était évincé sur Thonon → Genève par Cars Région Ain puis par TAC Annemasse (enveloppes larges) — corrigé le 13/11/2026 (le moteur préfère désormais le réseau qui couvre le départ)
- **M réso — Grésivaudan** (partiels) : Grille officielle 2,00 € (1,00 € intra-Grésivaudan non appliqué) — Tarif intra-Grésivaudan 1,00 € non appliqué (périmètre des arrêts inconnu) : 2,00 € affiché
- **M réso — Voironnais** (partiels) : Grille officielle 2,00 € (1,30 € intra-Voironnais non appliqué) — Tarif intra-Voironnais 1,30 € non appliqué : 2,00 € affiché ; attente Voiron → Grenoble retirée le 13/11/2026 (ligne réellement exploitée par Cars Région Isère T40/T41, pas le réseau urbain Voironnais)
- **TCL (Lyon)** (partiels) : Grille officielle 2,10 € confirmée (73/76 lignes ; 3 lignes ambiguës — F1/F2/7601 — sans prix par prudence) — Zone couverte volontairement réduite (Part-Dieu/Bellecour/Perrache) ; F1/F2/7601 ambigus sans prix (comportement voulu)
- **Cars Région Haute-Savoie (dont Y51)** (partiels) : Y51 : grille officielle par zones ; autres lignes à confirmer — Seule la Y51 a une grille par zones ; autres lignes sans prix
- **Cars Région Isère** (manquants) : Zonal confirmé (4,10 € à 12,10 €, zones par arrêt toujours indisponibles) — Aucun tarif publié dans l’agrégat ; tarif par zones (4,10 € à 12,10 €) sans zones des arrêts
- **Cars Région Savoie** (manquants) : Par ligne (3 € à 12,50 €), pas de tarif réseau unique — Seulement 8 lignes dans l’agrégat ; aucun tarif publié
- **TER Auvergne-Rhône-Alpes / SNCF** (manquants) : Prix dynamique : pas de source autorisée gratuite — SNCF ne publie plus de grille TER en open data : jeu « Tarifs TER AURA » archivé (prix au 01/03/2025), absent du catalogue actuel (seuls Intercités 2026 et TGV/OUIGO en fourchettes)
- **FlixBus / BlaBlaCar Bus** (manquants) : Prix dynamique : à confirmer (billet TripGo repris s’il est transmis) — Prix dynamiques ; TripGo n’a transmis aucun billet dans les réponses enregistrées
- **Citéa (Valence Romans Mobilités)** (manquants) : Prix à confirmer (fare_attributes absent du flux) — fare_attributes absent du flux
- **STAS (Saint-Étienne Métropole)** (manquants) : Prix à confirmer — fare_attributes absent du flux
- **T2C (Clermont Auvergne Métropole)** (manquants) : Prix à confirmer — fare_attributes absent du flux
- **CFF / trains suisses** (manquants) : Prix à confirmer (pas de prix dans l’API) — API sans prix (transport.opendata.ch ne publie aucun tarif) ; aucun autre blocage identifié
- **TPG (Genève, zone 10)** (partiels) : 3,00 CHF zone 10, appliqué uniquement aux couples d’arrêts reconnus — Billet Tout Genève zone 10 (3,00 CHF, 60 min) appliqué quand les deux arrêts sont dans le canton ; trajets transfrontaliers (Léman Pass) toujours sans prix
- **Léman Express** (partiels) : 4,90 € Léman Pass 10+210 sur trains Annemasse ↔ gares genevoises reconnues ; autres parcours à confirmer — 4,90 € 10+210 appliqué uniquement aux trains Annemasse ↔ gares genevoises reconnues ; autres parcours sans grille par gare
- **TPG lignes transfrontalières** (manquants) : Léman Pass : prix à confirmer — Le billet 10+210 à 4,90 € est intégré pour certains trains Annemasse–Genève, mais pas pour les bus TPG transfrontaliers : aucun prix fiable sans zones des arrêts
- **Léman Pass (tarif)** (partiels) : Grilles partielles intégrées : 10+210 à 4,90 € et ligne 272 par arrêts reconnus ; autres zones à confirmer — 10+210 à 4,90 € uniquement pour les gares prouvées ; ligne 272 tarifée par identifiants GTFS recoupés ; autres zones et arrêts sans prix certain
- **Flexi (Synchro, Chambéry)** (partiels) : Même tarif que le bus Synchro — Transport à la demande : réservation obligatoire, pas d’horaires publiés
- **Mobéa (Ondéa, Grand Lac)** (partiels) : Tarif Ondéa — Transport à la demande : réservation obligatoire
- **TPG Flex** (manquants) : Prix à confirmer — Transport à la demande : réservation obligatoire

## Diagnostic réel serveur, par axe

| Axe | Trajets | Prix vérifié | Marches calculées | Réalisables | Sources | Erreurs |
|---|---|---|---|---|---|---|
| Annecy → Genève | 49 | 0 | 49 | 8 | Suisse (transport.opendata.ch), FlixBus (GTFS), BlaBlaCar Bus (GTFS), SNCF (GTFS), Cars Région Haute-Savoie (GTFS) | — |
| Annemasse → Saint-Julien-en-Genevois | 52 | 38 | 52 | 8 | Suisse (transport.opendata.ch), SNCF (GTFS), TAC Annemasse (GTFS) | — |
| Ambérieu-en-Bugey → Lyon Part-Dieu | 18 | 0 | 18 | 0 | SNCF (GTFS) | — |
| Chambéry → Aix-les-Bains | 65 | 45 | 65 | 0 | Synchro Bus Chambéry (GTFS), Ondéa Aix-les-Bains (GTFS), SNCF (GTFS), Synchro Chambéry (GTFS) | — |
| Grenoble → Crolles | 8 | 5 | 8 | 5 | Mobilités M, BlaBlaCar Bus (GTFS) | — |
| Rumilly → Annecy | 21 | 1 | 21 | 0 | Sibra (GTFS), SNCF (GTFS) | — |
| Thonon-les-Bains → Genève | 16 | 0 | 15 | 7 | Suisse (transport.opendata.ch), SNCF (GTFS), FlixBus (GTFS) | — |
| Voiron → Grenoble | 39 | 0 | 39 | 5 | Mobilités M, SNCF (GTFS), BlaBlaCar Bus (GTFS), Cars Région Isère (GTFS) | — |
| Aix-les-Bains gare → Technolac (Ondéa 01) | 19 | 19 | 19 | 0 | Ondéa Aix-les-Bains (GTFS) | — |
| Thonon → Bons-en-Chablais (Star’t 142) | 50 | 31 | 50 | 2 | Star't Thonon (GTFS), Suisse (transport.opendata.ch), SNCF (GTFS) | — |
| Rumilly Hôpital → Base de loisirs (J’y bus 1) | 60 | 60 | 60 | 0 | J’y bus Rumilly (GTFS), J'y bus Rumilly (GTFS) | — |
| Ambérieu gare → Cabrol (TAM 2) | 83 | 83 | 83 | 0 | TAM Ambérieu (GTFS), TAM Ambérieu-en-Bugey (GTFS), Cars Région Ain (GTFS) | — |
| Chambéry → Chamoux-sur-Gelon (Cars Savoie S05) | 10 | 0 | 10 | 0 | Cars Région Savoie (GTFS), SNCF (GTFS) | — |
| Bourg-en-Bresse → Ambérieu (Cars Ain / TER) | 16 | 1 | 16 | 0 | Cars Région Ain (GTFS), SNCF (GTFS) | — |
| Bourg-en-Bresse gare routière → centre (Rubis) | 57 | 7 | 57 | 1 | Marche (Valhalla / OpenStreetMap), Rubis Bourg-en-Bresse (GTFS), Cars Région Ain (GTFS), SNCF (GTFS) | — |
| Bonneville → La Roche-sur-Foron (Proxim iTi / TER) | 23 | 0 | 23 | 7 | Suisse (transport.opendata.ch), SNCF (GTFS) | — |
| Évian → Thonon (ÉVA’D / TER) | 53 | 0 | 52 | 7 | Suisse (transport.opendata.ch), SNCF (GTFS), ÉVA'D Évian (GTFS) | — |
| Genève → Lausanne | 20 | 0 | 20 | 8 | Suisse (transport.opendata.ch), FlixBus (GTFS), BlaBlaCar Bus (GTFS) | — |
| Annemasse → Genève | 28 | 28 | 26 | 6 | Suisse (transport.opendata.ch), SNCF (GTFS) | — |
| Saint-Julien-en-Genevois → Genève | 45 | 8 | 45 | 8 | Suisse (transport.opendata.ch), SNCF (GTFS), Cars Région Haute-Savoie (GTFS) | — |
| Archamps → Genève | 8 | 8 | 8 | 8 | Suisse (transport.opendata.ch) | — |
| Chambéry → Saint-Julien-en-Genevois | 11 | 0 | 11 | 7 | Suisse (transport.opendata.ch), SNCF (GTFS) | — |
| Annecy → Chambéry | 35 | 0 | 35 | 0 | SNCF (GTFS), BlaBlaCar Bus (GTFS), FlixBus (GTFS) | — |
| Lyon → Grenoble | 20 | 0 | 20 | 0 | SNCF (GTFS) | — |
| Chambéry → Grenoble | 72 | 0 | 72 | 0 | SNCF (GTFS), FlixBus (GTFS), BlaBlaCar Bus (GTFS), Cars Région Isère (GTFS) | — |
| Lyon Part-Dieu → Bellecour (TCL) | 63 | 44 | 37 | 1 | Marche (Valhalla / OpenStreetMap), TCL Lyon (GTFS), SNCF (GTFS), Cars Région Express (GTFS), TCL (GTFS), Trenitalia (GTFS) | — |
| Voiron → Voreppe (M réso Voironnais) | 31 | 2 | 31 | 5 | Mobilités M, SNCF (GTFS), Cars Région Isère (GTFS) | — |

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
