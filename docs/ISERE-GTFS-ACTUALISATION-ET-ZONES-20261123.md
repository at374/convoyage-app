# Cars Région Isère — GTFS actualisé et conditions de certification tarifaire

Vérification publique du 23 novembre 2026.

## Source officielle du réseau

- Catalogue : https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-isere-38-1
- Ressource GTFS : https://transport.data.gouv.fr/resources/40287
- Producteur : Région Auvergne-Rhône-Alpes.
- Version du catalogue : dernière modification du contenu **18 novembre 2026**, couverture de service **11 novembre 2026 → 31 août 2027**, **6 463 arrêts** et 502 lignes selon le catalogue. Le GTFS officiel ne publie **aucun** fichier `fare_attributes.txt`, `fare_rules.txt`, `fare_products.txt` ni `fare_media.txt`.
- Notre artefact d'inventaire du 23 novembre contient **6 459** identifiants ; les deux chiffres diffèrent. Cette comparaison ne démontre pas à elle seule quels identifiants ont changé : effectuer un diff exact après téléchargement et inspection du ZIP officiel.

## Tarification officielle

- https://www.laregionvoustransporte.fr/cars-region/cars-region-de-lisere/infos-et-services-cars-region-de-lisere/titres-et-tarifs-de-lisere/
- Conditions 2026–2027 : https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/07/cars_region_isere_reglement_exploitation_CGVU_2026_2027.pdf
- Les **9 zones** sont A, B, C, D, E, HT1, HT2, RH et S. Pour les billets unitaires, le prix dépend du nombre de zones traversées ; pour les abonnements, le type de zone intervient également.
- Le règlement précise qu'on ne peut pas calculer le nombre de zones par la seule distance à vol d'oiseau ou les zones de départ et d'arrivée.
- La page officielle indique les tarifs à compter du **1er mars 2026** ; le PDF des communes comporte le titre « Liste des communes par zone au 1er mars 2026 ». Un nom de fichier interne historique 2025 ne suffit pas à invalider ce titre.

## Actions bloquantes

1. Rafraîchir le ZIP Isère depuis la ressource officielle et inspecter réellement `agency.txt`, `stops.txt`, `calendar.txt` et `calendar_dates.txt` ; recalculer SHA-256 et manifeste.
2. Regénérer l'inventaire `stop_id` sur **cette** version, puis comparer les identifiants ajoutés/supprimés à l'inventaire précédent.
3. Obtenir la preuve officielle d'affectation de chaque arrêt à sa zone ; la liste des communes n'est pas une jointure certifiée `stop_id → zone`.
4. Contrôler les zones intermédiaires de chaque course et les règles particulières des zones RH/A avant de produire un billet chiffré.
5. Rejouer le diagnostic à scénario identique (référence : 379/965 tarifs complets). Ne pas annoncer d'amélioration avant la mesure.

**Statut : sources identifiées, nouveau GTFS à importer et à inspecter ; aucune nouvelle zone GTFS ni aucun prix ajouté.**
