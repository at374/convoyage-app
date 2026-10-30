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

Le module n’est pas encore ajouté à l’interface Agenda. La fédération des réseaux, les transferts entre leurs identifiants d’arrêts, les chemins piétons réels, les tarifs officiels et leur fraîcheur, les preuves de circulation et les trois choix classés restent à relier. Les dates de recherche viennent du calendrier du flux ; aucune borne au 15 novembre n’est ajoutée.

Tous les résultats de ce chargeur portent `serviceConfirmed:false`, `faresVerified:false` et `accessVerified:false`. Un chargement réussi n’autorise donc pas l’affichage « Réalisable ».

## Worker navigateur

`transport-gtfs-worker-client.js` expose `CPGTFSWorker.createClient()`. Il crée un worker classique `transport-gtfs-worker.js`, qui charge lui-même les trois dépendances locales. Aucun index ni texte CSV n’est recopié vers l’interface : le worker conserve un seul réseau, renvoie son bilan de chargement et répond aux recherches d’arrêts proches ou de trajets directs datés.

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

Validation : cinq tests supplémentaires, dont exécution du véritable script worker et de ses dépendances dans un thread Node séparé avec archive synthétique, calendrier daté, réponses simultanées, remplacement, annulation, limite de file, erreurs et délai maximal. Ces tests ne constituent pas une validation Android ou CORS. L’intégration à l’Agenda et la persistance hors ligne restent à faire ; aucun script n’est encore ajouté à `index.html` ni au service worker.
