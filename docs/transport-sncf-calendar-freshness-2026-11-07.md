# SNCF — fraîcheur du calendrier embarqué, contrôle du 7 novembre 2026

## État réellement publié dans la branche de calcul

Le manifeste `data/sncf/manifest.json` de la branche de travail indique :

- source officielle : https://eu.ftp.opendatasoft.com/sncf/plandata/Export_OpenData_SNCF_GTFS_NewTripId.zip
- version du flux : 2026-11-04 ;
- génération locale : 2026-11-05T10:56:45Z ;
- journées indexées : du 4 au 11 novembre 2026 seulement ;
- portée : horaires théoriques gare à gare, sans temps réel, sans prix, sans cheminement à pied.

Le module SNCF refuse une date hors manifeste avec « Calendrier SNCF non publié ». C’est le comportement à conserver : il empêche de présenter le 12 novembre et les jours suivants avec un ancien horaire.

## Sources officielles disponibles

SNCF Open Data indique que le GTFS et NeTEx théoriques couvrent les 151 jours à venir. Les flux GTFS-RT de mises à jour et d’alertes sont renouvelés toutes les deux minutes, avec une couverture TGV, Intercités et TER. Références :

- https://ressources.data.sncf.com/explore/dataset/horaires-sncf/
- https://proxy.transport.data.gouv.fr/resource/sncf-gtfs-rt-trip-updates
- https://proxy.transport.data.gouv.fr/resource/sncf-gtfs-rt-service-alerts

## Décision

- **Constaté** : le calendrier déjà embarqué est courant pour les dates du 7 au 11 novembre, mais son horizon est très court.
- **Non confirmé** : aucune circulation future hors cette fenêtre ; aucun retard ou suppression en temps réel.
- **À faire avant le 12 novembre** : régénérer le manifeste et ses journées à partir d’un téléchargement GTFS daté, puis contrôler les sommes de contrôle et les tests.
- **Prix** : ni GTFS ni temps réel ne sont des devis. Les tarifs SNCF Connect, Intercités ou Ouigo restent à demander frais pour le trajet, la date, la classe et les conditions du client.

Aucun déploiement, fusion, contact tiers, activation payante, ni changement d'authentification, Supabase ou synchronisation des missions.
