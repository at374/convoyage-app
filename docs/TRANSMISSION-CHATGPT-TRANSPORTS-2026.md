# Transmission à ChatGPT — module Transports AURA + Suisse de Convoyage Ultra

**Date du relevé : 14 novembre 2026, 12 h (section du 14/11 en tête) ; sections suivantes : 13 novembre 2026.** Dépôt : `at374/convoyage-app`, branche `feature/transports-aura-suisse`. Ce document décrit l'état après la session Claude du 13/11/2026, pour éviter de refaire le même travail.

## SESSION CLAUDE DU 14/11/2026 (après-midi) — fiches mission et diagnostic réel

Répartition demandée par Laurent : ChatGPT = sources tarifaires, limites d'accès aux prix, contrôles de couverture ; Claude = intégration dans l'application, fiches mission, tests serveur/mobile, performance. **Merci de me signaler avant de modifier `createSession`, `assess`, `rank`, `render` ou `completeWalks` dans `transport-mission-hub.js`.**

### Avant / après (diagnostic serveur réel, 23 axes)

| | 14/11 11:01 UTC | 14/11 14:56 UTC |
|---|---|---|
| Trajets retenus | 1 079 | 956 (détours inutiles écartés) |
| Avec marches calculées | 579 (53,7 %) | 953 (99,7 %) |
| Réalisables | 160 | 166 |
| Horaire programmé (nouveau statut) | — | 542 |
| Prix vérifié | 307 (28,5 %) | 316 (33,1 %) |
| Axes avec réseau absent ou moteur en erreur | 2 | 0 |
| Requêtes piétonnes / échecs | 155 / 0 | 166 / 0 |
| Temps total par axe (moyen / pire) | 7,8 s / 20,2 s | 8,4 s / 18,9 s |
| Premier résultat (moyen) | — | 0,2 s |

### Ce qui a changé (commits `1aa65d3`, `cbe41f4`, `0af0269`)

1. **Quota de marches par couples d'arrêts** (`createSession → add`) : 8 couples de points nouveaux par moteur (+8 si rien de réalisable), au lieu de 8 à 16 trajets. Les départs d'une même ligne partagent leurs marches.
2. **`excessiveDetour(j,task)`** : chemin en véhicule ≥ 3 × la distance directe et ≥ 30 km de plus → écarté, compté dans `discarded`.
3. **Statut à trois niveaux** (`assess`) : `feasible` (« Réalisable ») inchangé ; nouveau `scheduled` (« Horaire programmé — à confirmer le jour J ») quand les seules réserves sont celles de la liste `ADVISORY` (horaire GTFS non confirmé en temps réel, prix commercial et disponibilité non vérifiés, recherche des correspondances incomplète, correspondance programmée non confirmée en temps réel) ; sinon « Transport non confirmé ». Un horaire GTFS n'est toujours **jamais** « Réalisable ». `rank` classe réalisable > programmé > non confirmé.
4. **Correspondances GTFS** (`fromNationalGTFS`) : battement programmé ≥ 10 min (`SAFE_TRANSFER_MIN`) → réserve « correspondance programmée non confirmée en temps réel » ; plus court → « correspondance GTFS non confirmée », bloquant.
5. **Repli national à 6 km réparé** : `transport-national-gtfs-journeys.js` refusait tout rayon > 5 000 m (« Invalid walking search radius ») → FlixBus et BlaBlaCar Bus tombaient en erreur dans le navigateur dès que le repli se déclenchait. Plafond 6 000 m, et un échec du repli ne fait plus perdre les résultats à 3 km.
6. **CI débloquée** : depuis `65b617c`, l'assertion `overnightCalls.length===2` échouait (3 appels avec le repli) et **aucun diagnostic réel ne tournait plus**. Assertions mises à jour (3 appels ; statut programmé ; libellé de correspondance).
7. Budget piéton d'une fiche 60 → 150 requêtes ; axe Bourg-en-Bresse déplacé sur la gare routière officielle.

### Suite (16 h, commits `931e6fd` et suivant) — chemin « horaires aux arrêts » testé en navigateur

- **`transport-gtfs-agenda.js` → `onResults`** reçoit un champ supplémentaire `candidates` (jusqu'à 20 trajets : 10 premiers + 10 répartis) ; `itineraries` (5 affichés) est inchangé. `app.js → renderLocalCards` envoie `candidates` au hub. Raison : pour un « Aller », les 5 affichés sont les plus tardifs et échouaient sur la marge après ajout de la marche finale.
- **Secours d'adresses pour toutes les archives relayées** : `DEFAULT_RESOURCES` est maintenant dérivé de `BASE_RESOURCES` et ajoute à chaque ressource `data/gtfs/*.zip` les copies `raw.githubusercontent.com/…/main/…` puis `…/feature/transports-aura-suisse/…`. Dans `transport-mission-hub.js` (fournisseurs `local_*`) et `index.html` (`CP_NATIONAL_GTFS_RESOURCES`) : secours `main` puis site déployé. **À la publication sur `main`, penser à mettre `main` en premier dans `base` (hub) et dans `index.html`**, sinon l'application lira des archives qui ne seront plus rafraîchies.
- **M réso relayé** : `data/gtfs/mreso-grenoble.zip` (6,4 Mo, 20 373 courses) et `mreso-gresivaudan.zip` (0,35 Mo) publiés par `build-regional-gtfs.yml` ; le panneau lit la copie relayée d'abord, data.gouv.fr en secours (comme SIBRA).
- Constaté : `main` ne contient ni `data/gtfs/` ni `transport-mission-hub.js` — tout le module vit sur la branche ; aucun test sur le site déployé n'est possible avant publication.

### Suite (16 h 45) — un même train occupait les 20 résultats nationaux

**ChatGPT, j'ai modifié ton moteur `transport-national-gtfs-journeys.js` (fonction `search`) — dis-moi si cela gêne un de tes travaux en cours.** Constat sur la tranche SNCF réelle : Thonon → Genève à 8 h renvoyait 20 lignes pour le seul train de 8 h 00 (une par gare de descente : Eaux-Vives, Champel, Pont-Rouge, Cornavin, Sécheron, puis des correspondances inutiles) ; les trains suivants n'apparaissaient jamais, et la fiche n'avait que 4 trajets utilisables sur 29. Désormais, avant `slice(0,maxResults)` :
- par véhicule de départ (`legs[0].tripId || tripId`, heure, arrêt de montée) : un seul direct, celui dont `egressDistanceMeters` est le plus petit ; une correspondance n'est gardée que si elle rapproche d'au moins 1 km de plus, ou s'il n'y a aucun direct ;
- une correspondance est retirée si un direct part au même moment ou plus tard et arrive au plus tard en même temps.
Résultat hors ligne sur la tranche publiée : Thonon → Genève 6 heures de départ distinctes dans les 9 premiers résultats ; Lyon → Grenoble : directs 7 h 16, 7 h 45, 8 h 16, 8 h 45… Nouveau test `tests/national-journeys-real-slice.test.cjs` (ajouté à la CI). Le format des lignes renvoyées est inchangé.

### Suite (17 h) — fournisseurs `local_*` : tri avant la limite de 30

Deux retouches dans la boucle de sélection des fournisseurs `local_*` (`transport-mission-hub.js`, juste avant `slice(0,30)`) :
- un couple d'arrêts dont (accès + sortie à vol d'oiseau) ≥ distance directe est ignoré **avant** la limite (même règle que `walkDetour`) — sur TCL, les 30 premiers départs tenaient dans la même minute et 24 étaient hors sujet ;
- pour un « Aller » (`w.arriveBy`), on garde les 30 arrivées les plus proches de l'échéance au lieu des 30 premiers départs de la journée.

### Test navigateur (Chrome, émulation Pixel 7, vraies archives GTFS, marches simulées car Internet fermé dans le bac à sable)

Fiches rendues sans erreur JavaScript ; J+31 (15/12/2026) : SNCF 20, FlixBus 20, BlaBlaCar Bus 8 trajets sur Lyon → Grenoble ; SNCF 20, FlixBus 10, BlaBlaCar Bus 3 sur Annecy → Genève. Pas de test sur téléphone Android réel (impossible d'ici).

## SESSION CLAUDE DU 14/11/2026 (matin) — détail complet pour ChatGPT

Tout est sur `feature/transports-aura-suisse`, rien sur `main`. Chaque point ci-dessous a été vérifié par un passage réel de `diagnostic-transports.yml` (GitHub Actions, Internet réel), pas seulement hors ligne. Dernier diagnostic réel pris en compte : `docs/diagnostic-serveur.json` du 14/11/2026 10:57 UTC (run `43587627272`).

### Chiffres réels avant / après (diagnostic serveur)

| | 13/11 soir | 14/11 10:57 UTC |
|---|---|---|
| Axes mesurés | 15 | 23 |
| Trajets trouvés | 506 | 1 079 |
| Trajets avec marches calculées | 247 (48,8 %) | 579 (53,7 %) |
| Trajets « réalisables » | 103 | 160 |
| Échecs du routeur piéton | 2 (bloquants) | 0 |

Le pourcentage de trajets tarifés affiché baisse (50,2 % → 28,5 %) uniquement parce que les moteurs nationaux SNCF / FlixBus / BlaBlaCar Bus sont maintenant mesurés (ils ne l'étaient pas) et n'ont pas de prix accessible : 808 portions SNCF, 122 FlixBus, 121 BlaBlaCar Bus sans prix. Ce n'est pas une régression des tarifs locaux.

### 1. Corrections de code (à ne pas refaire)

1. **Tarif GTFS officiel dans les fiches mission** — `transport-mission-hub.js`, nouvelle fonction exportée `attachGTFSFares(feed,rows)`, appelée dans les fournisseurs `local_*` de `makeProviders` et dans `scripts/diagnostic-transports-reel.cjs`. Avant : seul `transport-gtfs-worker.js` attachait `gtfsFare` ; les fiches mission perdaient le prix publié dans le GTFS (TCL : 70 trajets, 0 tarifé). `transport-gtfs-fares.js` est maintenant chargé dans `index.html` (hors worker). Commit `71136c9`.
2. **Filtre des détours inutiles** — `walkDetour(j,task)` dans `transport-mission-hub.js`, appliqué dans `createSession → add()` : un trajet dont (marche d'accès + marche de sortie à vol d'oiseau) ≥ distance directe est écarté avant le quota de marches ; le nombre écarté par moteur est exposé dans `view().discarded`. Rien n'est écarté si les GPS d'arrêt manquent. Commit `70265b1`. **Ne touche pas** au rayon de 3 000 m de tes fournisseurs `local_*` ni à leur limite de 30.
3. **Routeur piéton** — `transport-walking.js`, deux défauts prouvés en réel : (a) le compteur d'échecs était cumulatif sur toute la vie du routeur (2 incidents = plus aucune marche) → désormais échecs consécutifs, remis à zéro à chaque succès ; (b) une réponse HTTP 200 refusée par nos contrôles (ex. point « Bourg-en-Bresse gare » non raccordable à moins de 50 m) comptait comme panne du service → désormais `pairUnavailable` (statut `route_unavailable` pour ce seul couple de points). Pannes réseau, délais et 5xx restent des pannes. Commits `da3a595`, `9c53289`. Effet : 0 marche sur 6 axes → marches calculées partout sauf Bourg-en-Bresse (point de départ à corriger, voir § 4).
4. **SIBRA était en panne depuis le 11/11** — l'archive épinglée `…/20261001-085638/gtfs-sibra.zip` renvoie 404 (SIBRA a publié une nouvelle version le 12/11, validité 12/11 → 27/12/2026). `build-sibra-data.yml` résout maintenant l'archive courante via l'API data.gouv.fr et lit la validité dans le flux ; `data/sibra/sibra-2026-11-14 … 11-20.json` régénérés sur la branche. SIBRA ajouté au relais serveur (`scripts/build_regional_gtfs.py`, entrée `sibra-annecy` avec clé `dataset`) → `data/gtfs/sibra-annecy.zip` ; `transport-gtfs-agenda.js` lit cette copie d'abord, data.gouv.fr en secours. Commits `9351106`, `9c53289`, `a41acc7`. **Non fait (interdit sans accord de Laurent)** : la tâche planifiée tourne sur `main`, où le workflow est toujours cassé ; `sibra-prepare-official.yml` (SHA256 épinglé de l'ancienne archive) et `data/sibra/gtfs-sibra-manifest.json` (validité « jusqu'au 20/12 ») ne sont pas mis à jour.

### 2. Tarifs ajoutés ou confirmés

- **TCL (Lyon)** : 2,10 € (zones 1+2, correspondance 60 min) via les Fares V1 du GTFS officiel relayé ; conforme au guide tarifaire tcl.fr de mai 2026. 73 lignes sur 76 ; F1, F2, 7601 ont deux tarifs officiels dans le flux → volontairement sans prix. Aucune entrée dans `transport-fare-grids.js` (le tarif GTFS passe avant les grilles dans `priceOf`). Réel : 42 trajets tarifés sur 55 sur l'axe `lyon-intra`.
- **unireso Tout Genève (zone 10)** : 3,00 CHF, 60 min, 2e classe prix entier — `zone10Fare(leg)` dans `transport-fare-grids.js` (commit `58624c7`). Sources : unireso.com/titres-de-transport et dépliant unireso « dès le 14 décembre 2025 ». Appliqué seulement si les deux arrêts sont prouvés dans le canton : trains dont les deux gares sont dans `ZONE10_STATIONS` (opérateur SBB/CFF/SNCF) ; bus/tram d'opérateur `TPG` dont les deux noms d'arrêt officiels commencent par une localité de `ZONE10_LOCALITIES`. Tout arrêt français ou inconnu → pas de prix. Validité bornée au 12/12/2026. Réel : Archamps → Genève 14 trajets tarifés sur 18, Saint-Julien → Genève 10 sur 70 (le reste est transfrontalier = Léman Pass, toujours désactivé).
- **J'y bus / TAM** : statuts de `transport-coverage.js` resynchronisés (ils disaient encore « manquants »).

### 3. Diagnostic réel étendu

- `scripts/diagnostic-transports-reel.cjs` injecte maintenant `nationalGTFSResources` (les trois tranches `data/gtfs/national-*-aura.zip`) : tes moteurs nationaux SNCF / BlaBlaCar Bus / FlixBus sont mesurés en réel et fonctionnent (ex. Annecy → Genève : 20 SNCF GTFS, 11 BlaBlaCar Bus, 20 FlixBus).
- 8 axes ajoutés dans `AXES_COUVERTURE` : `lyon-intra`, `geneve-lausanne`, `annemasse-geneve`, `stjulien-geneve`, `archamps-geneve`, `chambery-stjulien`, `annecy-chambery`, `lyon-grenoble`.
- Quota de marches du diagnostic porté à 800 ; `discarded` ajouté par axe.
- Nouveaux tests CI dans `diagnostic-transports.yml` : étape « Vérifier le tarif GTFS officiel embarqué TCL » (archive réelle → `local_tcl.run` → `priceOf`, plus `walkDetour`), et assertions zone 10 dans l'étape des tarifs locaux.

### 4. Constaté en réel, NON corrigé (à trancher / à prendre)

- **Bus locaux jamais « réalisables »** : `fromGTFS` ajoute toujours « horaire GTFS local non confirmé en temps réel » (ton assertion CI « Unconfirmed local GTFS cannot be labelled Réalisable »). Conséquence réelle : Rumilly intra 51 trajets tarifés, 28 marches, 0 réalisable ; Ambérieu intra 76 / 32 / 0. Ces petits réseaux n'ont pas de GTFS-RT : ils ne seront donc jamais réalisables. Décision produit à prendre avec Laurent — je n'y ai pas touché.
- **Bourg-en-Bresse → Ambérieu** : 0 marche, le point de départ `{46.1993, 5.2148}` est refusé par le routeur piéton (itinéraire à plus de 50 m). Coordonnée d'axe à corriger dans `transport-coverage.js`.
- **Lyon → Grenoble** : 0 FlixBus / BlaBlaCar Bus, leurs arrêts lyonnais (Gerland, Perrache) sont à plus de 3 km de Part-Dieu (rayon de `national_*`).
- **Détours longue distance** : BlaBlaCar Bus Annecy → Saint-Étienne → Genève, FlixBus Annecy → Lyon → Genève ressortent comme candidats ; non filtrés (`walkDetour` ne juge que les marches).

### 5. Blocages externes établis (ne pas chercher de nouveau)

- **TER Auvergne-Rhône-Alpes** : le jeu officiel SNCF « Tarifs TER Auvergne-Rhône-Alpes » (prix par origine-destination) a été retiré : `tarifs-ter-aura` et `tarifs-ter-par-od` renvoient 404 sur ressources.data.sncf.com, ainsi que les 4 ressources de la fiche data.gouv.fr `6778b24e2e9a63f76e133b55` (sonde réelle `docs/SONDE-TARIFS-TER.md`, script `scripts/sonde_tarifs_ter.py`). Restent seulement des fourchettes Intercités et TGV INOUI/OUIGO (min/max, jamais un prix exact). Prix exact SNCF = accès distribution commercial.
- **FlixBus** : horaires GTFS officiels en place ; aucun prix dans le flux, pas d'API tarifaire publique.
- **BlaBlaCar Bus** : l'API officielle `bus-api.blablacar.com` (v3) annonce un accès gratuit sur inscription (clé API) et un service de tarifs. **Accès à créer par Laurent** ; rien de codé tant que la clé n'existe pas.
- **Suisse (CFF hors zone 10)** : opentransportdata.swiss publie un service de prix « OJP Fare » (bêta) avec clé gratuite sur inscription. **Accès à créer par Laurent**.
- **TripGo** : inchangé (désactivé par défaut, billets = contrat entreprise).

## Conflit TAM — résolu dans les deux sens, plus de désaccord

Ce matin, un désaccord existait sur la source TAM (`storage.googleapis.com/is-wp-170-prod/.../Livret_TAM_2026.pdf`), jugée invérifiable à l'époque, ce qui m'avait conduit à retirer temporairement le prix TAM et à adapter le test CI pour vérifier son absence.

**Depuis, ChatGPT a réintroduit TAM = 1,10 € avec cette même source (commits `04fd0d0`, `170bf99`, `51515da`), et une recherche indépendante de mon côté a retrouvé le même montant sur une deuxième source, différente et clairement attribuable** : `https://philibert-transport.fr/wp-content/uploads/2017/08/TAM-TARIFS-2026.pdf`, hébergée sur le site de Cars Philibert — l'exploitant réel du réseau TAM, confirmé via `transbus.org/reseaux/01500.html`. J'ai mis à jour la source citée dans `transport-fare-grids.js` pour utiliser ce lien opérateur (plus solide qu'un bucket GCS sans attribution), en gardant le même montant déjà validé par ChatGPT. **TAM = 1,10 € est donc maintenant doublement confirmé. Rien à refaire sur ce point.**

## Corrections de couverture poussées aujourd'hui

Trois écarts du diagnostic réel ont été corrigés dans `transport-coverage.js` — dans les trois cas c'était l'attente du test qui était fausse, pas le moteur :
- **Rumilly → Annecy** : Sibra dessert la liaison (ligne 42), pas J'y bus (les lignes J4/J5 s'arrêtent avant Annecy, vérifié sur les arrêts GTFS réels et confirmé par recherche officielle des terminus).
- **Voiron → Grenoble** : Cars Région Isère (lignes T40/T41/T50/T51/T55 via Saint-Laurent-du-Pont/Moirans, confirmées sur itinisere.fr), pas M réso Voironnais (réseau local, pas de ligne directe vers Grenoble).
- **Ambérieu-en-Bugey → Lyon** : TER seul. La « ligne 103 » affichée en gare comme « Cars interurbains » n'est pas un car direct jusqu'à Lyon : c'est la navette OùRA Lagnieu ↔ Ambérieu, combinée commercialement avec le TER (« Lagnieu → Ambérieu → Lyon : car + train », confirmé par plusieurs fiches horaires officielles). TCL ne dessert pas Ambérieu (sa propre ligne 103 est une ligne de banlieue ouest de Lyon, sans rapport).

## Couverture tarifaire — recherche approfondie du 13/11 (soir)

- **Cars Région Ain** : tarif réseau **unique** confirmé à **2,20 €** le 1 voyage (comparaison de plusieurs fiches horaires officielles datées : 2 € en 2022, 2,20 € pour la période 25/08/2025-23/08/2026 — même montant sur des lignes différentes à la même date). Intégré dans `transport-fare-grids.js`. **Limite connue** : validité bornée au 23/08/2026, faute de fiche 2026/2027 trouvée — à revérifier si quelqu'un trouve la fiche de la période en cours.
- **Cars Région Isère** : grille zonale officielle confirmée avec URL (carsisere.auvergnerhonealpes.fr), 1 à 6 zones de 4,10 € à 12,10 €. **Non intégrée** : aucune donnée de zone par arrêt dans le pipeline pour savoir combien de zones un trajet traverse. Appliquer un chiffre au hasard de cette grille serait un prix inventé.
- **Cars Région Savoie** : confirmé qu'il n'y a **pas** de tarif réseau unique (contrairement à l'Ain) — plusieurs lignes touristiques/TAD ont des tarifs différents vérifiés sur fiches officielles (S80 3,00 €, S66/S32/S33/S40/S41 12,50 €/8,90 €, S70 8,50 €/6,10 €...). Pas de prix unique possible sans savoir quelle ligne est concernée.
- **TPG (Genève, zone 10)** : confirmé 3,00 CHF (billet 60 min plein tarif) via 3 sources officielles concordantes. **Non intégré** : `transport.opendata.ch` ne donne aucune zone par arrêt, donc impossible de distinguer un trajet intra-Genève d'un trajet transfrontalier (tarif Léman Pass, plus élevé) — risque de prix trop bas, pas juste une lacune.
- **Léman Pass** : toujours désactivé (`LEMAN_PASS_ACTIVE=false` dans `transport-fare-grids.js`) suite à un désaccord apparent entre sources (TAC 4,90 € vs Jacquet 4,80 €). Piste trouvée mais pas vérifiée : ce serait peut-être des zones de départ différentes plutôt qu'une vraie contradiction — à vérifier spécifiquement avant de réactiver, pas en passant.
- **J'y bus (Rumilly)** : **trouvé et intégré** (recherche approfondie du 13/11 soir, suite à l'insistance de l'utilisateur à chercher plus fort). Ticket unité = **1,00 €**, 1 h, tout le réseau, confirmé par trois sources concordantes : le règlement/CGV officiel hébergé sur `jybus.fr` lui-même, la page Wikipédia du réseau (qui précise que ce ticket a été « maintenu à 1 € sur l'ensemble du réseau » lors de la révision tarifaire de janvier 2023), et une délibération Rumilly Terre de Savoie du 03/11/2025 sur le contrat dépositaire de billetterie Oùra, qui atteste d'un dispositif encore actif à cette date. Intégré dans `transport-fare-grids.js`, test CI mis à jour en conséquence.
- **TCL (Lyon)** — confirmé le 14/11, **sans aucun code nouveau** : le flux officiel relayé (`data/gtfs/tcl-lyon.zip`, zone Part-Dieu/Bellecour/Perrache, cf. `filter_by_bounds`) publie lui-même `fare_attributes.txt`/`fare_rules.txt` (Fares V1 SYTRAL), que le mécanisme générique déjà existant `transport-gtfs-fares.js` lit automatiquement. Test direct sur l'archive réellement publiée : routes 31/125/108 → **2,10 €**, correspondance 60 min (fare_id `1_1895382540`) — conforme au guide tarifaire officiel `tcl.fr` « 1 voyage, zones 1+2 » (`TCL_Campagne_Unification_Guide_Tarifaire_Mai2026`). 73 lignes sur 76 du flux filtré renvoient ce prix sans ambiguïté. Les 3 restantes (**F1, F2, 7601**) ont chacune deux tarifs officiels distincts dans le flux (ex. F1/F2 : zones 1+2 à 2,10 € ou toutes zones à 3,60 €, selon le titre réellement utilisé, non déterminable depuis le GTFS seul) → `legFare` renvoie intentionnellement **aucun prix**, comme pour toute ambiguïté dans ce dépôt. **Rien à ajouter dans `transport-fare-grids.js`** : ce serait soit redondant (le tarif GTFS gagne déjà sur une grille statique, cf. `isVerifiedFare`/`priceOf` dans `transport-mission-hub.js`) soit faux pour F1/F2/7601. `transport-coverage.js` mis à jour (les deux structures, `NETWORKS` et le second dictionnaire) pour refléter `tarif` confirmé au lieu de « manquants ». Nouveau test CI ajouté dans `diagnostic-transports.yml` (« Vérifier le tarif GTFS officiel embarqué TCL ») qui rejoue ce test sur l'archive publiée à chaque run.
  - **Note pour l'historique** : `transport-coverage.js` indiquait encore `tarif:'manquants'` pour J'y bus et TAM malgré leur intégration dans `transport-fare-grids.js` la veille — documentation non resynchronisée après coup. Pas corrigé ici (hors périmètre de cette tâche), mais à garder en tête si quelqu'un se fie à ce fichier pour l'état des tarifs plutôt qu'à `transport-fare-grids.js` lui-même.

### Correctif TCL du 14/11 (11 h) — le tarif GTFS n'atteignait pas les fiches mission

L'affirmation ci-dessus « sans aucun code nouveau » était vraie pour le module `transport-gtfs-fares.js` mais **fausse pour le chemin réel des fiches mission**. Le nouvel axe de diagnostic `lyon-intra` (Lyon Part-Dieu → Bellecour, ajouté dans `AXES_COUVERTURE` car TCL, non fédéré, n'était exercé par aucun axe) a donné en réel 70 trajets TCL et **0 tarifé** : seul `transport-gtfs-worker.js` attachait `gtfsFare` aux portions ; les fournisseurs `local_*` de `makeProviders` et le diagnostic serveur ne le faisaient pas. Corrigé par `attachGTFSFares(feed,rows)` dans `transport-mission-hub.js` (commit `71136c9`), `transport-gtfs-fares.js` chargé dans `index.html`. Diagnostic réel suivant (run `43584680912`) : **65 trajets sur 70 tarifés à 2,10 €** sur cet axe ; les 5 restants sont des trains SNCF et la ligne « 1 » (deux tarifs officiels, sans prix voulu). Seul TCL publie des Fares V1 parmi les archives `data/gtfs/`, donc aucun autre réseau ne change de prix.

**Constaté, non corrigé (code des fournisseurs `local_*`, à trancher avec ChatGPT)** : sur cet axe, 0 trajet « réalisable » et 0 marche calculée ; le rayon de 3 000 m de `nearbyDirectTrips` remonte des lignes sans rapport avec le trajet (ex. C14 Pierre Scize → Homme de la Roche, départ = arrivée) avant C9 Part-Dieu → Bellecour, et le quota de marches est épuisé par ces candidats.

## Section 5 (routage piéton) — vérifiée ce soir, déjà faite par ChatGPT, rien à refaire

Suite à `docs/INSTRUCTIONS-CLAUDE-ROUTAGE-PIETON-2026.md`, j'ai relu l'intégralité des commits `059fcf8`, `5fe6e0b`, `d1b315e`, `869f974` plutôt que de réimplémenter. Vérification faite point par point par rapport aux 8 exigences de la section 5 :
- **GPS par arrêt avec identifiant GTFS** (point 1) : déjà en place côté `transport-gtfs-index.js` (`stopInfo`/`nearbyStops` portent `stopId`, `name`, `lat`, `lon` — pas une correspondance par nom seul).
- **Calcul Valhalla/OSM des marches** (point 2) : `transport-walking.js` (pré-existant) interroge le vrai service Valhalla OSM, valide strictement la réponse (mode piéton, pas de ferry, cohérence durée/distance/géométrie, écart aux extrémités ≤ 50 m) et borne à 50 km/24 h.
- **Validation des extrémités de marche fournies par un moteur, pas de correspondance « même nom »** (point 3) : traité par `059fcf8` — `completeWalks` exige maintenant des points GPS réels, un nom d'arrêt identique ne suffit plus.
- **Tampon de correspondance minimal 2 min, pas de « réalisable » sans marche calculée, propositions incomplètes conservées** (point 4) : confirmé dans `059fcf8` et `assess()` (statut « Transport non confirmé » sans filtrer le trajet).
- **Pas de ligne droite présentée comme marche, distinction bus/piéton sur la carte** (point 5) : corrigé dans le SVG par `059fcf8` (plus de fallback `[fromPoint,toPoint]` pour les legs de marche).
- **Cache Valhalla avec expiration/déduplication, limitation d'appels, service gratuit, arrondi des points** (point 6) : déjà en place (`cachedRouter` avec `ttlDays`/`maxEntries`/clé arrondie à 1e-4°, `createRouter` avec quota de requêtes) — le routage piéton OSM n'a pas de restriction de frontière, donc les trajets transfrontaliers Genève sont couverts sans traitement spécial.
- **Tests de régression** (point 7) : `scripts/test-pedestrian-hub.cjs` couvre bien les 8 cas demandés (marche initiale, correspondance, marche finale, GPS absent, segment incomplet, délai négatif implicite via durée nulle, marche seule ≤3 km, cache sans géométrie).
- **CI verte** (point 8) : confirmé directement sur GitHub Actions — runs `43466922758` et `43467297410` tous les deux `completed success` sur `feature/transports-aura-suisse`.

J'ai aussi fait tourner la suite complète (`node --test tests/*.test.cjs`, 743 tests) après rebase sur les tout derniers commits (Ain 2,30 €, zones Isère) : 729 passent, 14 échouent — tous dans le module péages (APRR/AREA/SANEF, hors périmètre Transports) et les 2 Y51 déjà connus comme préexistants. Rien côté piéton ni côté Transports en général.

**Conclusion : la section 5 est fonctionnellement complète et testée. Pas de code à écrire côté piéton — simplement vérifié et confirmé vert.**

## Ce qui reste ouvert

1. **Zones Isère** : ChatGPT a commencé l'intégration (`transport-isere-zonal-fares.js`, commit `25d8f01`, CI encore en cours au moment de ce relevé) — travail en cours côté ChatGPT, je n'y touche pas pour éviter un conflit.
2. **Savoie, Léman Pass, TPG** : toujours documentés mais non intégrés (limite de données réelle, pas un problème de recherche) — ne pas réinventer un chiffre pour forcer l'intégration.
3. Avant toute modification de `transport-fare-grids.js` ou `transport-coverage.js` : `git fetch` + lire les derniers commits, pour éviter un nouveau conflit simultané comme celui du matin.
4. **TCL** : tarifs confirmés (voir ci-dessus), mais reste à vérifier par un diagnostic téléphone réel (ex. Ambérieu → Lyon Part-Dieu) que la bbox Part-Dieu/Bellecour/Perrace est effectivement exercée par une mission utile — au moment du relevé du 13/11, cet axe ne sollicitait pas encore TCL.

Historique complet : commits `2ba2ce6`, `6e6f369`, `54d73ae`, `11775f6`, `8573921`, `201d58e`, `4ad6c97`, `aa5d5c1`, `fc7bd65` sur cette branche.
