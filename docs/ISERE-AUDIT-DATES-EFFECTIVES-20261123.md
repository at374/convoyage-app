# Audit des jours effectifs de circulation — GTFS Isère

Source vérifiée : [GitHub Actions 45252044265](https://github.com/at374/convoyage-app/actions/runs/45252044265), artefact `isere-gtfs-official-comparison` contenant `isere-service-dates-comparison.json` et `isere-gtfs-comparison.json`.

## Résultats

- **293 dates** comparées sur l'union des jours avec circulations.
- **158 dates identiques**, **135 dates différentes**.
- **5 414 occurrences course-jour ajoutées ou modifiées** dans le flux officiel courant.
- **815 occurrences course-jour supprimées ou modifiées**.
- Premières différences : 2026-11-11 (+121, -0), 2026-11-12 (+2134, -0), 2026-11-13 (+2107, -0), 2026-11-14 (+239, -0), 2026-11-16 (+6, -7).
- 3 857 courses structurellement identiques sans tenir compte de l'identifiant de service, mais **les dates de circulation ne sont pas équivalentes**.

## Portée et limites

L'audit applique les jours de semaine de `calendar.txt` et les ajouts/suppressions de `calendar_dates.txt` puis compare, par date, les signatures ligne/sens/arrêts/heures, sans utiliser les identifiants de course ou de service. Les résultats ne démontrent pas à eux seuls si les écarts proviennent de corrections, d'un périmètre historique différent ou de changements de service. Les données de prix et de zones ne sont pas couvertes.

**Décision : pas de remplacement automatique du GTFS utilisé par Convoyage Ultra.** Examiner les 135 dates et effectuer une validation fonctionnelle avant migration contrôlée. Le rapport détaillé JSON contient toutes les dates divergentes.
