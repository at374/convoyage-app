# GTFS officiel Ain — source à exploiter (10 novembre 2026)

Source catalogue : https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-ain-01/

Fiche ressource : https://transport.data.gouv.fr/resources/83113?locale=fr

Au contrôle du 10/11/2026, le catalogue affiche pour « GTFS AIN » :
- période annoncée : 28/10/2026 au 31/08/2027 ;
- modification du contenu : 05/11/2026 ;
- 31 lignes, 957 arrêts et 417 zones d'arrêts ;
- `routes.txt`, `trips.txt`, `stop_times.txt`, `stops.txt` et `transfers.txt` disponibles ;
- **aucune donnée tarifaire GTFS** (`fare_attributes.txt`, `fare_rules.txt`, `fare_products.txt` absents).

Ces indicateurs décrivent le jeu de données entier, **pas la couverture X36**. Il faut télécharger le ZIP officiel et vérifier dans `routes.txt` si `route_short_name=X36` existe, puis extraire ses courses et arrêts. Ne pas annoncer des identifiants ou coordonnées X36 avant cette vérification.

Exécution locale, après téléchargement du ZIP et confirmation de l'URL directe :

```sh
python scripts/extract_x36_gtfs_stops.py ain-officiel.zip --source-url 'URL_HTTPS_REELLE_DU_ZIP' --checked-on 2026-11-10 > x36-candidates.json
```

Le résultat est une **liste de candidats** : il ne faut pas convertir les noms des arrêts en correspondances tarifaires sans audit individuel. La matrice X36 reste `data/transport/x36-illico-autocars-reference-2026-11-08.json` et ne confirme pas les prix d'une course.

Autre source officielle, à traiter indépendamment : https://transport.data.gouv.fr/datasets/agregat-oura ; son périmètre inclut notamment Cars Région Ain, Proxim iTi, J'ybus et TAC. Un agrégat ne prouve ni la présence de chaque ligne à une date donnée, ni les réservations ou prix.

## Correction de source (10/11/2026)

La X36 est une **ligne Cars Région Express**, pas une ligne du seul GTFS départemental Ain. La source prioritaire à analyser est https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-express?locale=fr (GTFS du 09/11/2026 au 07/02/2027). Correspondance officielle de la ligne 36 → X36 : https://www.montpezat-sous-bauzon.fr/IMG/pdf/Correspondances_re_seau_Cars_Re_gion_Express.pdf . Le GTFS Ain reste pertinent pour les autres lignes et les correspondances. Aucun arrêt X36 réel n'a encore été extrait.
