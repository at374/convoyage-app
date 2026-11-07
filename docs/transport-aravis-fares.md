# Y62/Y63 : références tarifaires par secteurs

## Extraction contrôlée

Les fiches officielles Y62 et Y63 de septembre 2026 ont été téléchargées, extraites en texte et rendues visuellement. Chaque fiche porte un barème au 1er mars 2026. Les deux matrices de quinze secteurs ont été numérisées, avec leurs liens et empreintes SHA-256 conservés dans `data/transport/aravis-fare-pdf-pins.json`.

`extract_aravis_fare_matrix.py` nécessite PyMuPDF. Il refuse tout PDF dont l’empreinte a changé, les couleurs inconnues et les matrices asymétriques. Il échantillonne les fonds des cellules hors des cercles blancs superposés et utilise les couleurs de légende contrôlées visuellement. Les matrices proviennent des fiches réelles, pas de trajets de démonstration.

```sh
python scripts/extract_aravis_fare_matrix.py /chemin/vers/les/pdf data/transport/aravis-fare-reference-2026.json
node --test tests/transport-aravis-fares.test.cjs
```

## Lecteur de références

`transport-aravis-fares.js` reçoit les données via `createCalculator(data)` et renvoie une référence pour une ligne, deux libellés exacts de secteurs et un profil. Les libellés ne sont pas rapprochés approximativement d’une adresse ou d’un arrêt.

- Y62/Y63 uniquement : pas d’extension automatique à une autre ligne.
- Montants adulte et Déclic conservés tels qu’ils figurent dans les fiches, avec les arrondis publiés.
- Profil Déclic : âge éligible explicite, justificatif toujours nécessaire ; aucune réduction automatique déduite d’un abonnement Sibra.
- Cellules Sibra exclues : leur barème doit être rapproché séparément des tarifs Sibra actuels.
- Cellules blanches notées `UNSPECIFIED` : aucun prix attribué. Une cellule blanche ne prouve pas l’absence de circulation.
- Date antérieure au barème ou invalide refusée ; aucune date de fin inventée.
- La référence ne devient jamais `fareVerified`, `stopMappingVerified`, `travelDateValidityKnown` ou `serviceConfirmed`.

Deux secteurs tarifaires ne sont pas deux arrêts GPS validés. Les matrices peuvent décrire plusieurs arrêts d’une même commune ou des sous-secteurs. Il reste à établir les correspondances explicites entre les identifiants GTFS et ces secteurs, puis à vérifier les portions et leurs correspondances.

Contrôle ciblé du 7 novembre 2026 : l'archive GTFS Haute-Savoie d'empreinte `9d3c594378d1618793aa8b8878d3023c1eb7de7e21ddaa9dc2d2e46dc36677cb` associe la Y62 aux gares routières d'Annecy (`FR:74010:ZE:57539:HAUTExSAVOIE`) et de La Clusaz (`FR:74080:ZE:57774:HAUTExSAVOIE`). Le lecteur accepte seulement ces deux identifiants avec leurs coordonnées à 50 m près, pour la Y62 et ce réseau, à partir de la date de contrôle. La matrice donne une référence adulte zone 4 de 8,90 €. Le 9 novembre, le moteur trouve dans ce fichier 12 courses directes théoriques vers La Clusaz et 13 dans l'autre sens. Ces chiffres ne valent pas preuve de circulation, prix d'achat ou validité pour un autre jour ; la grille ne précise pas de date de fin. Aucun autre arrêt n'est automatiquement rapproché.

## Anomalies documentaires repérées

Les fiches Y02, Y21, Y22, Y62, Y63, 272 et X33 ont été récupérées et inspectées dans cette passe. La numérisation des matrices de ce module couvre seulement Y62/Y63. La fiche Y22 affiche encore dans son encart Grand Annecy un tarif unitaire à 1,50 €, tandis que les fiches Y21/Y62/Y63 affichent 2 € et 2,50 € à bord. Cet encart n’est pas importé comme tarif actuel ; le rapprochement doit se faire avec la publication Sibra en vigueur. Les couches texte contiennent aussi des fragments d’anciens en-têtes, ce qui impose une lecture visuelle.

La fiche 272 contient des produits distincts France/France et transfrontaliers, et une période datée. La grille X33 est une matrice d’arrêts Illico Autocars. Ces documents ne sont pas remplacés par la grille générale de l’Ain ou par la matrice Aravis.

## Validation et livraison

Cinq nouveaux tests passent : cellules repères vérifiées visuellement, symétrie des deux matrices, exclusion des secteurs Sibra/cellules inconnues, âge et arrondi Déclic, dates. Au total, 56 tests JavaScript chargeur/worker/tarifs/Léman Pass/Aravis passent localement ; cinq tests Python de l’outil d’audit passent également.

Le lecteur n’est pas encore relié à index.html ni au classement des résultats Android. Il prépare des références exploitables, sans prétendre que tous les trajets AURA sont déjà tarifés. Les autres lignes et produits restent à numériser et raccorder.
