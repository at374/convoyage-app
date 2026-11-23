# Isère — vérification de provenance et validité du référentiel communal

## Source inspectée le 23 novembre 2026

- [PDF des communes et zones](https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/03/cars_region_isere_liste_communes_zones_20260301.pdf), 10 pages, hébergé dans le dossier `2026/03`.
- Le titre interne extrait du PDF est **« Microsoft Word - Liste communes zone 20250101 »** : ce libellé fait référence à 2025, et ne prouve pas à lui seul la date de validité du document.
- Le tableau comporte les colonnes `COMMUNE`, `ZONE`, `TYPE DE ZONE`. Il ne comporte **pas** d'identifiant GTFS `stop_id`.
- Des communes telles que GRENOBLE (A), MOIRANS (B), CROLLES (B), BOURGOIN JALLIEU (E) y figurent. Il s'agit de zones **communales**, pas d'affectations prouvées des arrêts GTFS.

## Conséquence pour Convoyage Ultra

Le fichier `data/tarifs/isere-communes-zones-2026-extrait-officiel.json` reste une documentation partielle (`complete:false`, `usableAsGTFSStopZoneReference:false`). Ses champs `validFrom` et `validThrough` sont **des hypothèses de travail conservatrices à confirmer**, pas une certification par le titre interne du PDF.

Le module de calcul **ne doit jamais** créer `isereOfficialZones` en joignant automatiquement le préfixe INSEE du `stop_id` aux communes du PDF. Les correspondances tarifaires doivent être validées au niveau des arrêts et des parcours, y compris hors Isère.

## Preuves à réunir avant activation

1. Confirmation de la date d'effet du barème et de la table communale auprès de l'autorité organisatrice.
2. Référentiel officiel reliant les identifiants exacts d'arrêts à leur zone ou méthode explicitement autorisée de rattachement.
3. Vérification de la méthode de comptage des zones traversées et des cas particuliers (zones A/E, RH, S, HT1/HT2, lignes inter-départementales).
4. Test sur itinéraires GTFS complets puis comparaison au diagnostic de référence 379/965.

**Statut : non activable pour la tarification des arrêts GTFS à ce stade.**
