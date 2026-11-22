# Grandole Mobilités — vérification des sources (2026-11-22)

Statut : SOURCES PUBLIÉES / ZIP NON TÉLÉCHARGÉ / NON INTÉGRÉ / NON TESTÉ.

## Producteur et périmètre
- Réseau : Grandole Mobilités (Dole, Jura).
- Producteur : Communauté d'Agglomération du Grand Dole.
- Page nationale officielle : https://transport.data.gouv.fr/datasets/reseau-de-transport-du-grand-dole/
- Licence : Licence Ouverte 2.0.

## GTFS statique
- Nom publié : gtfs-dole.zip.
- Validité annoncée : 2026-09-01 à 2027-09-10.
- Dernière modification affichée : 2026-09-02.
- URL de téléchargement nationale : https://transport.data.gouv.fr/resources/81254/download
- URL d'archive nationale publiée : https://transport-data-gouv-fr-resource-history-prod.cellar-c2.services.clever-cloud.com/81254/81254.20260902.123827.444787.zip
- Validation nationale : 94 informations (détails non vérifiés).
- Aucun fichier GTFS n'a été téléchargé ni analysé dans cette session : résolution DNS impossible depuis le conteneur ; lecteur web refuse les ZIP binaires.

## Temps réel
- Deux ressources publiées sur la page nationale : GTFS-RT vehicle_positions et GTFS-RT trip_updates.
- Les URLs directes et leur réponse binaire ne sont pas encore vérifiées ; ne pas marquer le temps réel fonctionnel.

## Tarif et TAD (à revérifier avant intégration)
- Tarif unitaire 1,00 € précédemment relevé depuis une délibération de 2023 : https://www.grand-dole.fr/fileadmin/GRAND_DOLE_CONNAITRE/DELIBERATIONS_CONSEIL_COMMUNAUTAIRE/2023/08.06.2023/042_du_08_06_2023_Tarifs_des_services_Grand_Dole_Mobilit%C3%A9s_-_Septembre_2023.pdf
- TAD Flexi Agglo/Flexi Job précédemment documenté ; numéro 0 800 346 800, préavis 1 h, à revérifier dans les règlements en vigueur.
- Ne pas afficher de rentabilité si le coût complet n'est pas vérifié.

## Consigne de coordination
ChatGPT prend en charge la récupération et l'analyse des sources. Claude ne doit pas télécharger les GTFS ni inventer des données à partir de cette fiche. Ne raccorder le réseau qu'après dépôt par ChatGPT d'un fichier GTFS effectivement extrait/validé ou d'un artefact de données préparé. Ne pas déclarer Grandole opérationnel avant tests d'horaires, correspondances, marche GPS, prix et dates.

## État du travail
- [x] Existence des ressources nationales vérifiée.
- [x] Licence ouverte et période GTFS vérifiées.
- [ ] Téléchargement et extraction ZIP.
- [ ] Contrôle routes/stops/trips/stop_times/calendar.
- [ ] Contrôle des GTFS-RT.
- [ ] Vérification tarif actuel et TAD.
- [ ] Intégration et tests bout-en-bout.
