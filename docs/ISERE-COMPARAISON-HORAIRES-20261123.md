# Comparaison des horaires GTFS Isère — 23 novembre 2026

Source : [GitHub Actions 45251601551](https://github.com/at374/convoyage-app/actions/runs/45251601551), artefact `isere-gtfs-official-comparison`.

## Résultats contrôlés

- Ancien GTFS : 3 869 courses, 55 470 passages, 6 459 arrêts desservis.
- Nouveau GTFS : 3 868 courses, 55 471 passages, 6 458 arrêts desservis.
- **3 857 courses identiques en structure horaire** (ligne, sens, suite des identifiants d'arrêts, heures d'arrivée et de départ), sans tenir compte des identifiants de service.
- **11 courses nouvelles ou modifiées** ; **12 courses supprimées ou modifiées** selon cette même comparaison.
- Comparaison avec identifiant de service : 0 course identique, ce qui démontre que cette clé n'est pas stable entre les exports.
- Les calendriers `calendar.txt` et `calendar_dates.txt` ont des empreintes différentes ; l'équivalence des dates de circulation **n'est pas démontrée**.
- Dernière date de service trouvée dans les deux flux : 2027-08-31.
- Ajout d'arrêt desservi : `FR:38186:ZE:103201:ISERE` ; retraits : `FR:38186:ZE:78497:ISERE`, `FR:38186:ZE:78498:ISERE`.
- 2 960 arrêts listés non desservis dans le nouveau flux.
- Aucune table de tarifs dans les deux flux ; aucune zone d'arrêt certifiée.

## Décision de déploiement

**Ne pas remplacer automatiquement le flux en production** : vérifier les dates actives réelles, les 11/12 différences d'horaires et la non-régression du moteur. La similarité structurelle des horaires ne prouve pas que les mêmes courses circulent aux mêmes dates.
