# Comparaison effective du GTFS Cars Région Isère — 23 novembre 2026

Preuve : [workflow GitHub Actions 45250731773](https://github.com/at374/convoyage-app/actions/runs/45250731773), artefact `isere-gtfs-official-comparison` (rapport JSON). L'archive officielle a été téléchargée et son ZIP vérifié ; le script `scripts/compare_isere_gtfs.py` a inspecté les tables GTFS.

| Mesure | Version actuelle du dépôt | Version officielle téléchargée |
|---|---:|---:|
| SHA-256 | `ebf42131c42353bf618f5488b22ce924e215171206918c10d82e01d0344d3306` | `1e17a7944a7a22854e08970bb332684fd4db1a1b3e9df9f89e96525a178af41a` |
| Arrêts `stops.txt` | 6459 | 9418 |
| Arrêts utilisés par `stop_times.txt` | 6459 | 6458 |
| Dernière date du calendrier | 20270831 | 20270831 |
| Tables tarifaires GTFS | aucune | aucune |

- Intersection des identifiants : **6457**.
- **2961** nouveaux identifiants dans `stops.txt`, mais beaucoup ne sont pas desservis par `stop_times.txt` ; ne pas assimiler « nouveaux arrêts » à « nouvelles dessertes ».
- **2** identifiants supprimés : `FR:38186:ZE:78497:ISERE` et `FR:38186:ZE:78498:ISERE`.
- **0** zone tarifaire et **0** tarif certifiés par ce rapport ; `safe_to_auto_replace:false`.

**Attention à l'écart avec le catalogue** : un nombre d'arrêts annoncé par une page de catalogue ne se substitue pas à la lecture réelle de `stops.txt` et `stop_times.txt`. Le ZIP téléchargé contient 9418 lignes d'arrêts et 6458 identifiants desservis, ce qui exige une vérification de périmètre avant déploiement.

## Prochaines vérifications

1. Comparer les **arrêts réellement desservis** dans les deux ZIP (et non seulement `stops.txt`) pour distinguer ajouts non desservis, changements de service et arrêts supprimés.
2. Comparer les calendriers et les horaires par `trip_id` et `route_id`, sans supposer que les identifiants restent stables entre publications.
3. Vérifier la provenance des 2961 nouveaux `stop_id` et leur éventuel rôle d'arrêts parents / non desservis.
4. Ne mettre à jour l'application qu'après validation du périmètre et des tests de non-régression. Ne pas créer de zones tarifaires par déduction.
