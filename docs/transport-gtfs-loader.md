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

`loadResource(resource, {fetcher, signal, timeoutMs})` permet un chargement indépendant annulable. Le délai réseau/décompression est de 30 secondes par défaut. L’indexation synchrone reste à déplacer dans un worker avant son raccordement au téléphone.

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
