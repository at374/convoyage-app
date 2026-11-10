# X36 — audit des arrêts du GTFS Cars Région Express (10/11/2026)

## Réseau et validité

- Producteur : Région Auvergne-Rhône-Alpes ; réseau **Cars Région Express**, distinct du GTFS départemental Cars Région Ain.
- Catalogue national : https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-express?locale=fr
- GTFS publié le 09/11/2026, période annoncée du 09/11/2026 au 07/02/2027.
- Page officielle de la ligne : https://www.laregionvoustransporte.fr/cars-region/cars-region-de-lain/ligne/x36-bellegarde-bourg-en-bresse/
- La page de ligne annonce une fiche horaire valable du 12/07/2026 au 12/12/2026 : **ne pas confondre validité de la fiche horaire et couverture GTFS**.

## Premier arrêt candidat documenté

| Champ | Valeur |
|---|---|
| Nom publié | Bellegarde Gare Routière |
| Identifiant GTFS observé | `FR:01033:ZE:29769:CARSxREGIONxEXPRESS` |
| Réseau observé | Cars Région Express |
| Lignes observées | X33, X36 |
| Source d'observation | https://www.transit.land/stops/s-u0hnkd1tup-bellegardegarerouti%C3%A8re?feedOnestopId=f-reseau~interurbain~cars~region~express&feedVersionSha1=458bf69e014b66123632c505109fcef7dbe61c7b |
| Coordonnées officielles extraites du GTFS du 09/11/2026 | **NON VÉRIFIÉES** |
| Correspondance à « BELLEGARDE Gare » de la matrice X36 | **NON VÉRIFIÉE** |
| Tarif de trajet confirmé | **NON** |

La source Transitland identifie l'arrêt et la ligne sur une version de flux donnée ; elle **ne prouve pas** que les coordonnées et identifiants sont inchangés dans le GTFS actuel. Aucun enregistrement n'est injecté dans `auditedPins` tant que l'extraction officielle et le rapprochement manuel n'ont pas été réalisés.

## Suite opérationnelle

1. Télécharger le GTFS Cars Région Express du 09/11/2026 depuis le catalogue national.
2. Exécuter `scripts/extract_x36_gtfs_stops.py` sur le ZIP officiel avec son URL HTTPS et la date de contrôle.
3. Comparer tous les arrêts candidats à la grille `data/transport/x36-illico-autocars-reference-2026-11-08.json`, sans rapprochement automatique sur simple nom.
4. Ne déclarer `stopMappingVerified:true` qu'après audit documenté des identifiants, GPS et sens. `fareVerified` reste faux sans preuve du trajet daté.

**Aucun pourcentage de couverture X36 ne peut être déclaré à ce stade.**
