# Transmission à ChatGPT — module Transports AURA + Suisse de Convoyage Ultra

**Date du relevé : 13 novembre 2026 (mise à jour en soirée).** Dépôt : `at374/convoyage-app`, branche `feature/transports-aura-suisse`. Ce document décrit l'état après la session Claude du 13/11/2026, pour éviter de refaire le même travail.

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

Historique complet : commits `2ba2ce6`, `6e6f369`, `54d73ae`, `11775f6`, `8573921`, `201d58e`, `4ad6c97`, `aa5d5c1`, `fc7bd65` sur cette branche.
