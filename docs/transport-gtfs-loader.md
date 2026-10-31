# Chargement des réseaux GTFS

`transport-gtfs-loader.js` relie le téléchargement existant du catalogue PAN à l’indexeur statique, sans clé Oùra ni domaine à enregistrer. Il ne modifie pas les missions, Supabase ou l’authentification.

## API

Dans Node, importer `require('./transport-gtfs-loader.js')`. Dans le navigateur, charger dans cet ordre `transport-catalogue.js`, `transport-gtfs-index.js`, puis `transport-gtfs-loader.js` ; l’API devient `CPGTFSLoader`.

```js
const loader = CPGTFSLoader.createLoader({fetcher: fetch});
const {feed, cached} = await loader.load(resource);
const trips = CPGTFSIndex.directTrips(
  feed.files, feed.index, '2026-11-02', originStopId, destinationStopId
);
```

`resource` provient de `CPTransportCatalogue.gtfsResources`. Un nouvel `updatedAt` ou identifiant de ressource invalide la clé de cache. `load(resource, {refresh:true})` demande un nouveau téléchargement et peut rejoindre un téléchargement déjà en cours pour la même version. `clear()` vide le cache ; les chargements antérieurs ne peuvent plus le repeupler.

Le cache garde au plus deux réseaux pendant cinq minutes et 128 Mio de textes sources décompressés. Il mutualise les chargements simultanés. Ce budget porte sur les sources, **pas sur la mémoire totale des index JavaScript**. Les objets retournés doivent être traités en lecture seule. Un échec d’actualisation ne renvoie pas silencieusement un ancien résultat présenté comme neuf.

`loadResource(resource, {fetcher, signal, timeoutMs})` permet un chargement indépendant annulable. Le délai réseau/décompression est de 30 secondes par défaut. Pour le navigateur, utiliser le client worker décrit ci-dessous afin de déplacer aussi l’indexation synchrone hors de l’interface.

## Archives et limites

- ZIP standard, fichiers stockés ou DEFLATE, descripteurs de données, fichiers UTF-8 ; tables à la racine ou dans un unique répertoire commun.
- Contrôles de la structure ZIP, des en-têtes locaux, des CRC et des tailles réellement décompressées. Les chemins ambigus, liens symboliques, doublons, volumes multiples et archives chiffrées sont rejetés. ZIP64 n’est pas pris en charge.
- 20 Mio téléchargés, 64 Mio par table, 128 Mio décompressés pour les tables sélectionnées et 128 entrées par défaut. Ces limites sont configurables explicitement ; le gros agrégat Oùra nécessite un choix de budget distinct, pas une augmentation silencieuse sur Android.
- Extraction des tables utiles à l’indexation, aux calendriers, aux transferts et aux futures preuves tarifaires. `shapes.txt` et les autres fichiers non utilisés ne sont pas décompressés. Leur présence ne constitue pas une vérification d’itinéraire piéton.
- Les tables principales, un calendrier de service, leurs colonnes nécessaires et les fuseaux des agences sont vérifiés avant l’indexation. Les références de passages rejetées par l’indexeur sont comptées dans `rejectedStopTimes`.
- Les navigateurs doivent fournir `DecompressionStream('deflate-raw')`. Le repli Node utilise `node:zlib`, notamment pour Node 22. Aucun paquet supplémentaire n’est requis.

## Validation réelle du 30 octobre 2026

Les mesures sont conservées dans `validation-gtfs-loader-2026-10-30.json`.

| Source publique | Archive | Arrêts | Lignes | Courses | Passages indexés |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sibra, archive officielle déjà référencée dans le dépôt | 5 631 686 octets | 1 861 | 28 | 18 597 | 550 167 |
| Cars Région Haute-Savoie, téléchargement GTFS open data Oùra | 10 260 404 octets | 1 641 | 24 | 1 156 | 26 972 |

L’archive Sibra correspond au SHA-256 déjà référencé dans le dépôt. Pour le 2 novembre 2026, l’index trouve 1 833 courses Sibra prévues et 344 courses Haute-Savoie prévues, dont 55 Y51. Les recherches directes d’essai renvoient des candidats, sans annoncer leur circulation comme confirmée.

Sur le même ZIP Sibra local, dans deux processus Node distincts : pic RSS de 828 Mio avant contre 340 Mio après ; indexation de 1 712 ms contre 1 397 ms. Une seule mesure par version, sur serveur : ces chiffres ne prédisent pas les performances Android. Le CSV est désormais parcouru ligne par ligne ; les identifiants et valeurs horaires répétées sont partagés dans l’index. Les colonnes GTFS existantes sont conservées.

## Éléments encore à raccorder

Le client worker est maintenant chargé dans l’interface Agenda sur cette branche pour les trajets directs et à une correspondance au même arrêt Cars Région Haute-Savoie (voir `transport-gtfs-agenda.md`). La version n’est pas déployée ni validée sur Android. La fédération des réseaux, les transferts entre leurs identifiants d’arrêts, les chemins piétons réels, les tarifs officiels et leur fraîcheur, les preuves de circulation et les trois choix classés restent à relier. Les dates de recherche viennent du calendrier du flux ; aucune borne au 15 novembre n’est ajoutée.

Tous les résultats de ce chargeur portent `serviceConfirmed:false`, `faresVerified:false` et `accessVerified:false`. Un chargement réussi n’autorise donc pas l’affichage « Réalisable ».

## Worker navigateur

`transport-gtfs-worker-client.js` expose `CPGTFSWorker.createClient()`. Il crée un worker classique `transport-gtfs-worker.js`, qui charge lui-même les trois dépendances locales. Aucun index ni texte CSV n’est recopié vers l’interface : le worker conserve un seul réseau, renvoie son bilan de chargement et répond aux recherches d’arrêts proches ou de trajets directs datés, entre identifiants d’arrêts ou entre coordonnées.

```js
const client = CPGTFSWorker.createClient();
const controller = new AbortController();
const summary = await client.load(resource, {signal: controller.signal});
const result = await client.query({
  method: 'directTrips', date: '2026-11-02', from: originStopId, to: destinationStopId,
  limit: 100
});
// Fermer la fiche ou abandonner la recherche :
client.dispose();
```

- `load(resource, {signal, ...limitesDuChargeur})` remplace le worker précédent. Le bilan contient les compteurs, les dates et identifiants de source, les tailles et les trois indicateurs de preuve à `false`.
- `query({method:'nearbyStops', lat, lon, radiusMeters, limit}, {signal})` recherche les arrêts par distance à vol d’oiseau, sans confirmer l’accès piéton.
- `query({method:'directTrips', date, from, to, limit}, {signal})` consulte le calendrier du réseau chargé. Les horaires restent théoriques et les prix inconnus.
- Les réponses de recherche contiennent `rows` et `truncated`. Limite de retour : 100 par défaut, 500 au maximum. Cette limite borne le transfert vers l’interface, pas le calcul interne du moteur existant.
- Au maximum 16 requêtes sont en attente. Le délai de chaque opération est de 45 secondes par défaut (`timeoutMs` au constructeur). Le délai réseau du chargeur reste de 30 secondes par défaut.
- Annulation, dépassement de délai, `clear()` ou remplacement du réseau terminent le worker entier : cela interrompt aussi une indexation synchrone et rejette toutes ses requêtes en attente. Un signal déjà annulé ne remplace pas le réseau actif. Les réponses d’un ancien worker sont ignorées.
- `clear()` permet un prochain chargement ; `dispose()` ferme définitivement le client. La fermeture libère les références du worker aux sources et index, sans promesse sur le délai de récupération mémoire du navigateur.
- Aucun repli sur le thread de l’interface si Worker est indisponible ou bloqué par la CSP. Servir les scripts depuis la même origine avec une politique autorisant les workers ; les téléchargements GTFS restent soumis au CORS de leur source.

Validation : cinq tests supplémentaires, dont exécution du véritable script worker et de ses dépendances dans un thread Node séparé avec archive synthétique, calendrier daté, réponses simultanées, remplacement, annulation, limite de file, erreurs et délai maximal. Ces tests ne constituent pas une validation Android ou CORS. Le raccordement Agenda des trajets directs et à une correspondance Haute-Savoie est présent sur la branche. Les scripts sont ajoutés à `index.html` et au cache de l’interface ; la persistance des données GTFS hors ligne reste à faire.

### Trajets directs entre coordonnées

```js
const result = await client.query({
  method: 'nearbyDirectTrips', date: '2026-11-02',
  origin: {lat: 45.9, lon: 6.1}, destination: {lat: 45.8, lon: 6.2},
  radiusMeters: 700, limit: 100
});
```

Les coordonnées sont des entrées, pas une certification de l’adresse. Chaque résultat contient `originStop`, `destinationStop`, `accessDistanceMeters` et `egressDistanceMeters`. Ces distances sont à vol d’oiseau ; aucun temps de marche n’est déduit. Le rayon worker est limité à 5 km, 700 m par défaut. Cette méthode conserve les heures GTFS brutes, qui peuvent dépasser 24 h. Pour une fenêtre horaire de mission, utiliser `missionDirectTrips` ci-dessous.

La recherche parcourt une fois les calendriers et les courses actives pour tous les couples d’arrêts proches. Elle évite les copies de tous les horaires pour chaque couple. Les retours sur le même arrêt, les séquences non croissantes et les arrivées antérieures au départ ne produisent pas de candidat ; les visites répétées d’un arrêt restent distinctes. Les tests comparent les résultats à une recherche par couples indépendante, couvrent les boucles, horaires après minuit, calendriers, incohérences horaires et l’appel depuis le véritable script worker. Le nombre de lectures du calendrier est vérifié, sans extrapolation de performance Android.

Prochaine étape de raccordement : choisir les ressources utiles, transmettre les fenêtres des missions depuis l’Agenda et vérifier les accès piétons. Le raccordement Agenda lance ces recherches via `missionDirectTrips` pour le réseau Haute-Savoie sélectionné.

### Fenêtres horaires des missions

`transport-gtfs-time.js`, importé automatiquement par le worker, convertit les heures depuis le jour de service et le fuseau de l’agence GTFS. Il suit la [référence officielle GTFS](https://gtfs.org/documentation/schedule/reference/) : temps écoulé depuis midi local moins douze heures, y compris lors du changement d’heure. Il ne traite pas une heure de service comme une heure civile naïve. Le fuseau d’un arrêt ne remplace pas celui de l’agence. Les agences d’un même flux doivent partager leur fuseau ; une agence manquante, une route non résolue ou des fuseaux contradictoires provoquent une erreur.

```js
const result = await client.query({
  method: 'missionDirectTrips', date: '2026-11-02',
  origin: {lat: 45.9, lon: 6.1}, destination: {lat: 45.8, lon: 6.2},
  window: {
    earliestDeparture: deliveryDate, // Retour/Jonction : fin de la livraison
    latestArrival: nextPickupDate,  // Aller/Jonction : prochaine prise en charge
    marginMinutes: 30               // Réglable, 15 accepté
  }
});
```

Au moins une borne est obligatoire : `latestArrival` pour l’Aller, `earliestDeparture` pour le Retour, les deux pour la Jonction. Une borne est un timestamp ISO avec fuseau explicite ou un nombre de millisecondes Unix ; les dates sans fuseau sont rejetées. La marge est soustraite uniquement de la borne d’arrivée. Les bornes sont inclusives, les résultats sont filtrés avant leur limitation.

Les champs `departure` et `arrival` deviennent des ISO UTC. `serviceDate`, `timeZone`, `departureTime` et `arrivalTime` conservent l’interprétation des données source. Une course à `25:00` conserve son jour de service même si son départ civil est le lendemain. Le paramètre `date` reste explicitement le **jour de service GTFS** : la recherche ne consulte pas automatiquement les jours de service voisins. L’Agenda interroge ces jours séparément pour les départs ; la fédération peut assembler une seconde branche sur l’un des jours explicitement fournis via `connectionDates`.

Les résultats portent `timetableOnly:true`. Le filtrage ne comprend aucun temps d’accès ou de sortie à pied et ne prouve pas qu’un départ puisse être rejoint après livraison, ni que l’adresse de prise en charge soit atteinte à temps. `accessVerified`, `serviceConfirmed`, `exactOrigin`, `exactDestination`, `faresVerified` restent à `false` et `priceEUR` reste `null`. Aucun badge « Réalisable » n’est autorisé par cette seule fenêtre.

Validation : huit tests unitaires couvrent les fuseaux Paris/UTC/Katmandou, les deux changements d’heure, heures au-delà de 24 h, jour civil inexistant, dates impossibles, bornes et marges, métadonnées d’agence et préservation des indicateurs de preuve. Un test supplémentaire exécute les fenêtres dans le véritable worker avec requêtes simultanées. Aucun test Android ou contrôle d’accès piéton n’est revendiqué ; le module est branché à l’Agenda sur la branche, sans déploiement ni validation Android.

### Trajets avec une correspondance

`query({method:'missionJourneys', date, origin, destination, window, radiusMeters, limit, connectionDates})` réunit trajets directs et correspondances au même arrêt. Les bornes et formats sont ceux de `missionDirectTrips`. Le résultat inclut `searchTruncated` pour les budgets internes, en plus de `truncated` pour les résultats transférés. Les deux indicateurs sont propagés à l’affichage. Les correspondances portent deux `legs` datées, `transferStop`, `transferMinutes` et `transferVerified:false`. Règles, exclusions et budgets sont détaillés dans `transport-gtfs-agenda.md`. L’API `missionDirectTrips` reste disponible pour une recherche directe seule.

### Index par dates et chargement de deux réseaux

`loadResource(resource, {indexServiceDates, retainSourceTables})` accepte une liste explicite de 1 à 7 dates de service ; sans cette option l’API historique charge toujours l’index complet. `retainSourceTables:false` conserve uniquement les textes nécessaires aux agences, calendriers, transferts et métadonnées. Le worker utilise systématiquement ce mode. `skippedStopTimes` compte les passages volontairement omis, `rejectedStopTimes` conserve son sens de références rejetées. Le budget du cache `createLoader` reste comptabilisé sur la taille décompressée initiale, une borne conservatrice même lorsque des textes sont libérés.

`resource.resolveFromCatalogue:true` relit le catalogue PAN pour `resource.datasetId`, choisit la ressource GTFS la plus récemment datée, puis télécharge son URL HTTPS. La source retournée expose cette URL et la date producteur connue. Le délai et le signal d’annulation couvrent aussi cette résolution. Le champ de métadonnées PAN `updated` est reconnu.

`client.loadNetworks([resourceA,resourceB], {indexServiceDates})` remplace le worker et retourne `{networks,partial}` ; les dates sont obligatoires, deux réseaux au maximum. Un élément de `networks` contient le bilan existant ou `{error:{network,message}}`. Les requêtes `missionJourneys` réunissent résultats internes et liaisons interréseaux indicatives ; les autres méthodes continuent d’interroger le premier réseau disponible. Une requête datée hors du périmètre indexé est rejetée.

`connectionDates` contient de un à cinq jours explicites, incluant `date`, tous dans le périmètre indexé. Pour la fédération, la première branche conserve `date` et la seconde parcourt les calendriers demandés. Chaque branche expose son propre `serviceDate` ; le résultat expose aussi `serviceDates`. Les heures absolues, fenêtres de mission, marges et intervalles restent appliqués. Le budget de branches est partagé entre ces dates par réseau et par requête ; les recherches tronquées restent signalées. Sans ce paramètre, seul `date` est consulté. Les correspondances internes ne changent pas de jour de service.

La fédération ne fusionne pas les identifiants entre réseaux et ne confirme aucun chemin piéton. Les rapprochements entre arrêts et leurs limites sont décrits dans `transport-gtfs-agenda.md`.

### Enrichissement piéton de l’affichage

Le worker ne sollicite pas le service piéton : `transport-walking.js` enrichit les propositions déjà affichées par `transport-gtfs-agenda.js`, avec file et requêtes annulées à la fermeture. Les objets GTFS ne sont pas réécrits ; les preuves de marche restent séparées. Les identifiants, budgets et flags des sources gardent leur sens. Détails et limites dans la section « Parcours piétons calculés » de `transport-gtfs-agenda.md`.

`CPGTFSTime.serviceWindow(files, date, window)` expose `minDepartureSeconds` / `maxArrivalSeconds` depuis la même base de jour GTFS que `datedTrips`. Les recherches de correspondance de mission transmettent ces bornes à `boundaryLegs` avant le budget de branches ; le filtrage final des trajets datés reste conservé. L’API brute des correspondances garde ses bornes infinies par défaut. Les branches hors de la fenêtre ne saturent plus le budget à la place de branches utiles. Cela ne borne pas toutes les itérations du parcours des courses.
