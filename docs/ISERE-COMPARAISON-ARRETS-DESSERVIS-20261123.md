# Diff des arrêts réellement desservis — Isère

Source : [GitHub Actions run 45250920230](https://github.com/at374/convoyage-app/actions/runs/45250920230), artefact `isere-gtfs-official-comparison`, comparaison entre le GTFS actuel et la ressource officielle.

| Mesure | Ancien | Nouveau |
|---|---:|---:|
| Arrêts listés | 6459 | 9418 |
| Arrêts desservis (`stop_times.txt`) | 6459 | 6458 |
| Arrêts listés mais non desservis | 0 | 2960 |
| Lignes | 502 | 502 |
| Courses | 3869 | 3868 |
| Passages (`stop_times.txt`) | 55470 | 55471 |
| Dernière date calendrier | 20270831 | 20270831 |
| Tables de prix GTFS | 0 | 0 |

Identifiants desservis conservés : **6457**.

- Ajout desservi : `FR:38186:ZE:103201:ISERE`.
- Retraits desservis : `FR:38186:ZE:78497:ISERE` et `FR:38186:ZE:78498:ISERE`.
- Les **2960 arrêts listés mais non desservis** du nouveau flux ne doivent pas être utilisés comme preuves de desserte.
- Le nombre de lignes reste identique mais le nombre de courses et de passages diffère ; les horaires eux-mêmes n'ont pas encore été comparés course par course.

## Décision

Ne pas remplacer automatiquement le GTFS utilisé par l'application sur la seule base de ces comptes. Effectuer une comparaison des courses, services et horaires puis tester le moteur de trajets. **Aucune zone ni aucun tarif nouveau certifié.**
