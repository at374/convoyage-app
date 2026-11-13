# Module Transports — hub unifié AURA–Suisse (13/11/2026)

Branche locale : `feature/transports-aura-suisse`, partie de `main` du 12/11/2026 (`64d624f`).
**Pas de push GitHub** avant la fin du chantier AURA–Suisse, selon la consigne de Laurent.

## 1. Ce qui change dans la fiche mission

Quand on appuie sur « 🚌 Visualisation des transports », chaque direction (01 Aller, 02 Mission suivante, 03 Retour) affiche maintenant **en premier** un bloc unique de propositions classées :

- **Moins cher** : seulement parmi les trajets dont le prix est prouvé, ou à pied (gratuit) ;
- **Meilleur compromis** : prix, durée, correspondances, marche et avance ;
- **Plus rapide** : durée porte à porte ;
- « Autres propositions (n) », repliées.

Chaque carte indique les horaires porte à porte, la durée, le prix (ou « Prix à confirmer » avec la source manquante) et les étapes. Elle affiche aussi le statut : ✅ Réalisable, ou ⚠️ Transport non confirmé avec la raison. La carte dépliée montre chaque étape, les marches en mètres et en minutes, un tracé sur carte, les sources et les éventuels retards ou alertes.

Aucune recherche manuelle n'est nécessaire. Les anciens blocs, moteur par moteur, restent visibles plus bas comme justificatifs.

## 2. Fichiers

| Fichier | Rôle |
|---|---|
| `transport-mission-hub.js` (nouveau) | Normalisation des moteurs, marches réelles, faisabilité, prix, classement, cartes Android |
| `transport-fare-grids.js` (nouveau) | Registre de tarifs prouvés ; branche la grille officielle Y51 déjà présente |
| `app.js` | Lancement automatique du hub par direction ; ingestion des horaires GTFS locaux ; réglages « marche max (km) » et « marge 5 min si GPS exact » (stockés sur le téléphone, **pas** dans Supabase) |
| `index.html`, `sw.js` | Chargement des 2 nouveaux scripts ; cache hors ligne Android mis à jour (v34) |
| `swiss-transport-api.js` | Ajoute les coordonnées des arrêts (x = latitude, y = longitude, d'après la documentation officielle), l'opérateur, la catégorie et le retard |
| `regional-routing.js` | Ajoute les coordonnées des arrêts et le nom du réseau (Mobilités M / OTP) |
| `sncf-fallback.js` | Ajoute les coordonnées des gares |
| `transport-tripgo.js` | Ajoute le type de véhicule (`modeInfo`) |
| `style.css` | Cartes du hub aux couleurs du thème (clair et sombre) |
| `tests/transport-mission-hub.test.cjs` (nouveau) | 15 tests, dont 4 sur des réponses réelles enregistrées |
| `tests/browser/transport-hub-mobile.cjs` (nouveau) | Vraie application dans Chromium, format Pixel 7 |
| `tests/browser/transport-mobile.cjs` | Règle « jamais Réalisable » limitée aux anciens blocs ; le hub peut afficher « Réalisable » si la marge est respectée |

Aucune modification de la synchronisation Hiflow, DriiveMe, Pop Valet ou Otoqi, de l'authentification ou de Supabase.

## 3. Règles appliquées

- **Marche** : jamais de vol d'oiseau présenté comme une marche. Approche, correspondances et marche finale passent par Valhalla/OpenStreetMap ou par la marche calculée par le fournisseur (TripGo, Mobilités M). Les sections « walk » de transport.opendata.ch sont recalculées, car l'API ignore la marche initiale dans l'heure de départ.
- **Trajet tout à pied** : proposé si la marche réelle est ≤ 3 km (réglable de 0 à 10 km). Il n'est demandé que si la distance à vol d'oiseau est déjà ≤ seuil.
- **Marge** : 15 min par défaut ; 5 min seulement si le point GPS de la mission est exact **et** si l'option est cochée dans les Réglages.
- **Réalisable** : horaires cohérents, toutes les marches calculées, correspondances assez longues (marche + 2 min) et arrivée ≤ heure de mission − marge. Sinon « Transport non confirmé » avec la raison. Sans temps réel, la carte précise « horaires théoriques : retards et annulations à surveiller le jour J ».
- **Prix** : jamais inventés. EUR et CHF affichés séparément, sans conversion. « Prix à confirmer » nomme l'opérateur sans tarif.
- **Exclusions** : bateaux, courses annulées, et tout moteur qui dépasse 25 s (les autres résultats restent affichés).

## 4. Inventaire des moteurs raccordés au hub

| Moteur | Couverture | Lancement | État vérifié |
|---|---|---|---|
| TripGo | Multimodal : trains, bus, cars, dont FlixBus et BlaBlaCar Bus | Automatique si une clé TripGo est enregistrée | Réponse réelle du 31/10 intégrée et affichée (test navigateur) |
| transport.opendata.ch | Suisse, Grand Genève, Léman Express, TPG | Automatique si un point est en Suisse ou à ≤ 30 km de Genève | Format vérifié sur la documentation officielle ; **aucun appel réel possible d'ici** |
| Mobilités M (OTP) | M réso : Métropole grenobloise, Grésivaudan, Voironnais | Automatique dans le périmètre grenoblois | Réponse réelle du 30/10 intégrée (test) |
| SNCF GTFS (fichiers `data/sncf`) | TER, Intercités, TGV, cars SNCF, de gare à gare | Automatique | Données officielles du dépôt ; correspondance Annecy–Grenoble du 02/11 intégrée (test navigateur) |
| GTFS locaux (worker existant) | Sibra, Cars Région Haute-Savoie (Y51…), Cars Région Ain, M réso Grenoble et Grésivaudan, GTFS national suisse | Automatique, transmis au hub | Format testé ; pas de flux réel chargé dans ce test |
| Valhalla (marche) | OpenStreetMap | Automatique | Réponse réelle du 30/10 acceptée ; simulée dans le test navigateur |

**Ajouts du 13/11 (flux GTFS officiels, à valider sur téléphone)** : TAC Annemasse (offre du 31/08/2026 au 31/08/2027), Synchro Bus Chambéry (ODbL : citer Grand Chambéry), Ondéa Aix-les-Bains (jusqu'au 31/12/2026), Star't Thonon (jusqu'au 20/12/2026). TCL n'est pas ajouté : 654 lignes, trop lourd pour le moteur GTFS du téléphone ; TripGo reste sa source.

**Réseaux de la liste encore non raccordés au hub par une source propre :** TCL Lyon, J'y bus Rumilly, Ambérieu (Tam). Voiron (Pays Voironnais) fait partie de M réso et est couvert par Mobilités M. Saint-Julien et Archamps sont dans le périmètre du flux TAC (réseau Genevois français Mobilités depuis juillet 2025) : présence effective des lignes à vérifier sur téléphone. ainsi que les transports à la demande. Ils ne sont couverts que si TripGo, l'API suisse ou un GTFS configuré les fournit. **Ce point reste à vérifier, réseau par réseau, avec la clé TripGo.**

## 5. Tarifs

| Réseau | Tarif | État |
|---|---|---|
| Y51 Annecy–Albertville (zones par arrêt) | Grille officielle AURA en vigueur au 01/03/2026, vérifiée le 31/10/2026 | **Appliqué** (prix exact par zone) |
| Sibra (abonnement) | Couverture conditionnelle par l'abonnement déclaré | Existant, non modifié |
| Sibra 1 voyage | 2,00 € en achat digital ou rechargement (2,50 € à bord), valable 1 h correspondances comprises ; CGV 2026/2027, gamme applicable depuis le 01/07/2026 sur tout le réseau | **Appliqué** (13/11). Une correspondance Sibra dans l'heure n'est pas repayée ; le nom de réseau doit être exactement « Sibra » |
| TCL Lyon | Tarif selon les zones : 1,60 à 3,70 € depuis septembre 2025 ; hausse annoncée au 01/01/2026 | **Manquant** : il faut connaître la zone des arrêts |
| M réso (Métropole, Grésivaudan, Voironnais) | 1 voyage 2,00 €, 1 h sur tout M réso, correspondances et retours compris (2,60 € à bord) ; tarifs au 01/09/2026 (reso-m.fr) | **Appliqué** (13/11). 2,00 € reste valable partout ; un trajet entièrement intra-Grésivaudan peut coûter 1,00 € |
| Synchro Chambéry | 1,40 € (1,70 € à bord) sur la page tickets (antérieure à juillet 2026) ; les CGV au 02/07/2026 citent 1,70 € par voyage pour la formule sur compte | **Manquant** : grille 2026 ambiguë |
| Ondéa Grand Lac | 1 voyage M-Ticket 1,70 €, 1 h, correspondances autorisées ; tarifs applicables du 1er juillet 2026 (ondeagrandlac.fr) | **Appliqué** (13/11), sauf sur les lignes de car numérotées ≥ 100 (proximité/scolaire, titre non valable) |
| Star't Thonon | Tarif par zone : 1,20 € (1 zone) ou 2,20 € (zones A + B) ; page officielle datée de 2025 | **Manquant** : zone des arrêts et confirmation 2026 nécessaires |
| TAC Annemasse | 1,60 € ou 1,70 € selon les sources | **Manquant** |
| TPG / unireso, zone 10 | CHF 3.– sur les dépliants officiels unireso 2019 à 2024, aucune version 2026 trouvée | **Manquant** : les trajets France–Genève relèvent du Léman Pass (1 trajet = 1 titre), pas de la zone 10 |
| Cars Région Isère | Tarif par zones : 4,10 € à 12,10 € | **Manquant** : il faut connaître la zone des arrêts |
| SNCF / TER, FlixBus, BlaBlaCar Bus | Prix dynamiques | **Manquant** : aucune API de prix publique gratuite |

Le registre `transport-fare-grids.js` accepte une grille seulement avec : réseau identifié par le fournisseur, mode, dates de validité, source https et date de vérification. Une correspondance ambiguë ne donne aucun prix.

## 6. Blocages techniques réels

1. **Clé TripGo** : sans clé enregistrée dans l'application, TripGo n'est pas interrogé. Son offre gratuite est limitée en nombre de requêtes.
2. **Aucun accès réseau aux fournisseurs depuis l'environnement de Claude** : TripGo, transport.opendata.ch, SNCF et data.gouv sont refusés par le proxy. Les tests utilisent des réponses réelles déjà enregistrées dans le dépôt. Les appels en direct doivent être validés sur le téléphone.
3. **Valhalla public** (valhalla1.openstreetmap.de) : environ 1 requête par seconde, d'où au plus 60 marches par fiche. Optimisé le 13/11 :
   - les doublons entre moteurs ne recalculent pas leurs marches ;
   - un trajet déjà hors délai sur ses seuls horaires n'en consomme aucune ;
   - au plus 8 trajets par moteur et par direction sont complétés, les plus utiles d'abord ;
   - chaque carte s'affiche dès que ses marches sont prêtes.

   Sur téléphone, compter quelques secondes pour les premières cartes et jusqu'à environ 30 à 50 s pour une fiche complète à 3 directions. Les trajets au-delà du quota portent la mention « marches non calculées (quota de la fiche) ».
4. **Tarifs** : aucun fournisseur ne transmet de prix. Il faut des grilles officielles datées, réseau par réseau, et les zones des arrêts pour les réseaux à zones.
5. ~~Moteur suisse appelé hors zone par l'ancien code~~ : **corrigé le 13/11**. L'API suisse n'est plus interrogée que si un point est en Suisse ou à ≤ 30 km de Genève (test navigateur : 0 requête suisse pour Grenoble–Annecy).
7. **Flux GTFS ajoutés** : la taille des fichiers et l'autorisation de téléchargement depuis le navigateur (CORS) n'ont pas pu être vérifiées d'ici. En cas d'échec, le réseau apparaît « indisponible » sans bloquer les autres.
6. **Tests déjà en échec sur `main`, avant ces changements** : 7 tests péages, `transport-y51-fares` (tests 5 et 7) et `tests/browser/transport-mobile.cjs` (Y51 hérité : « 0 courses » avec les données du 12/11).

## 7. Tests exécutés (13/11/2026)

- `node --test tests/transport-mission-hub.test.cjs` : **20/20**, dont la chaîne suisse complète au format documenté et les tarifs Sibra, M réso et Ondéa (réponse Mobilités M réelle : C1 + 80 = 2,00 €, un seul titre).
- Tous les tests `tests/transport-*`, `swiss-transport-api` et `agenda-transports` : tous réussis sauf `transport-y51-fares`, en échec identique sur `main`.
- `tests/browser/transport-hub-mobile.cjs`, Chromium au format Pixel 7 : **OK**. TripGo appelé 6 fois, SNCF 5 fois, Valhalla 2 fois ; Retour Annecy → Grenoble avec BlaBlaCar Bus et FlixBus 1789 ; Aller à pied gratuit ; pas de débordement horizontal ; aucune écriture serveur ; aucune erreur JavaScript.
- `tests/browser/transport-mobile.cjs` : échoue à la même assertion Y51 que sur `main`, sans régression avant ce point.

**Données réelles :** réponses TripGo, Mobilités M, Valhalla et SNCF enregistrées dans le dépôt. **Simulé :** Valhalla dans le test navigateur, API suisse (réponse vide), géocodage. **Non testé :** appels en direct depuis un téléphone.

## 8. Procédure de validation Android

1. Installer la version de la branche (APK ou PWA de test), sans la publier.
2. Réglages → Transports : enregistrer la clé TripGo ; vérifier « marche max 3 km » ; laisser la marge courte décochée.
3. Ouvrir une mission acceptée réelle en Haute-Savoie, avec une adresse géolocalisée → 🚌 Visualisation des transports.
4. Vérifier, sans rien toucher, qu'en moins de 30 s chaque direction affiche des cartes « Moins cher / Meilleur compromis / Plus rapide » ou « Aucun trajet trouvé » avec « Moteurs consultés ».
5. Ouvrir une carte : étapes, minutes de marche, tracé, sources. Comparer un horaire avec l'application officielle de l'opérateur.
6. Refaire le test avec une mission frontalière (Annemasse ou Saint-Julien → Genève) : la carte doit citer « Suisse (transport.opendata.ch) ».
7. Refaire le test avec une mission à Grenoble : la carte doit citer « Mobilités M ».
8. Couper le réseau, puis rouvrir la fiche : l'application doit s'ouvrir (cache v34). Les moteurs passent en « ❌ », sans plantage.
9. Noter tout horaire, toute marche ou tout prix faux, avec une capture d'écran.
