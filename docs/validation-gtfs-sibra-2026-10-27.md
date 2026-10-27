# Validation du flux statique SIBRA (GTFS)

**Date de vérification :** 27 octobre 2026  
**Archive contrôlée localement :** `gtfs-sibra.zip`  
**SHA-256 :** `ecb4c0627e47818c8fcd0e7590980f5b905f6c95ab3881bfca88f68f54f81c83`

## Résultats structurels

- Archive ZIP lisible, test d'intégrité réussi.
- Fichiers GTFS attendus présents : `agency.txt`, `calendar.txt`, `calendar_dates.txt`, `routes.txt`, `stops.txt`, `trips.txt`, `stop_times.txt`.
- 1 861 arrêts, tous avec latitude/longitude.
- 28 lignes.
- 18 597 courses.
- 550 167 horaires d'arrêt.
- 81 entrées dans `calendar_dates.txt`, couvrant le 1er octobre au 20 décembre 2026.
- Aucun identifiant d'arrêt, de course ou de ligne inconnu dans les relations contrôlées.

## Limites importantes

Cette vérification confirme la structure et la cohérence référentielle du flux, **pas** la disponibilité en temps réel, l'absence de perturbations, les tarifs, les parcours piétons vers chaque adresse ou la faisabilité d'un trajet précis.

Le flux n'est pas encore branché au calculateur de trajets de l'Agenda. Ne pas afficher un itinéraire comme confirmé sur la seule base de ce rapport.

Sources officielles du flux à vérifier avant chaque actualisation :
- https://www.data.gouv.fr/datasets/offre-de-transports-sibra-a-annecy-gtfs
- https://transport.data.gouv.fr/resources/80100
