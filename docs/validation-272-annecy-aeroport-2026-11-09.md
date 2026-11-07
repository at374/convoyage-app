# Contrôle réel GTFS — 272 Annecy → Genève-Aéroport

Contrôle effectué le 7 novembre 2026 à partir du flux officiel [Cars Région Haute-Savoie](https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=HAUTE_SAVOIE&dataFormat=GTFS&dataProfil=OPENDATA), téléchargé localement et lu par `transport-gtfs-loader.js` et `transport-gtfs-index.js` de la branche [PR #207](https://github.com/at374/convoyage-app/pull/207).

Archive : SHA-256 `9d3c594378d1618793aa8b8878d3023c1eb7de7e21ddaa9dc2d2e46dc36677cb`, version de flux `20261028`, période globale 28 octobre 2026–31 août 2027. Cette période ne prouve pas que toutes les lignes circulent chaque jour.

## Requête précise

- Jour de service : lundi 9 novembre 2026.
- Ligne : 272.
- Arrêt départ : Annecy Gare Routière, `FR:74010:ZE:57539:HAUTExSAVOIE`.
- Arrêt arrivée : Genève-Aéroport, `FR:6623:ZE:57862:HAUTExSAVOIE`.
- Résultat : 18 courses directes théoriques pour ces deux arrêts ; première 04:30–05:40, dernière 20:15–21:39, heures locales de service GTFS.
- Le lecteur tarifaire donne une référence adulte parcours 11,30 €, selon la [grille TPG](https://www.tpg.ch/sites/default/files/2026-09/LIT272_grille_tarifaire_20251214_20261212_vDEF.pdf) valable jusqu'au 12 décembre 2026.

La recherche a utilisé des arrêts exacts, pas une mission complète d'adresse à adresse. Elle ne valide ni marche, ni correspondance, ni circulation en temps réel, ni disponibilité à l'achat. Aucun horaire de cette journée ne doit être reproduit comme actuel pour une autre date. La [page Alpbus de la ligne](https://www.alpbus-mobilites.fr/transport-regulier/lignes-regulieres/ligne-bus-272) affiche les arrêts et les informations de circulation à vérifier avant le départ.

## Statut

Le raccordement du barème comme référence non confirmée est préparé dans la PR #207. Ce contrôle n'établit pas une validation sur téléphone physique et ne garantit pas l'exhaustivité des lignes ou des tarifs. Aucune fusion, réservation, publication ni activation payante.

## Contrôle du sens inverse

Même archive et jour de service : le moteur retourne 19 courses théoriques directes de Genève-Aéroport vers Annecy Gare Routière, première 09:10–10:32 et dernière 22:00–23:12. Il retrouve également 19 courses vers Pringy Gare (identifiant `FR:74010:ZE:57875:HAUTExSAVOIE`) ; les arrivées correspondantes sont 10:20 et 23:00. Le lecteur applique la référence adulte de 11,30 € dans ce sens pour les arrêts vérifiés. Ces exemples n'établissent pas la circulation réelle, l'accès piéton, la vente ou la validité pour un autre jour.
