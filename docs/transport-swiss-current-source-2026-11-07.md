# Suisse — état vérifié des sources de trajet et de tarifs

Contrôle du 7 novembre 2026. Ce document décrit les sources constatées ; il ne publie aucun prix et ne modifie aucun trajet utilisateur.

## Source nationale d’horaires

La plate-forme officielle suisse publie le GTFS statique national 2026. Le catalogue signale une couverture du 14 décembre 2025 au 12 décembre 2026, une mise à jour bihebdomadaire et, au contrôle, une ressource datée du 4 novembre 2026. Le fichier couvre les horaires planifiés ; il ne constitue pas une preuve de circulation réelle ni de tarif.

- Catalogue : https://data.opentransportdata.swiss/fr/dataset/timetable-2026-gtfs2020
- Documentation GTFS : https://opentransportdata.swiss/fr/cookbook/timetable-cookbook/gtfs/

Le flux national n’est **pas** chargé directement dans Android : son volume dépasse le plafond sûr du chargeur mobile. Il reste une source possible pour un index serveur borné par zone et par date, à préparer sans déploiement.

## Calcul d’itinéraire Suisse

L’OJP 2.0 officiel est adapté aux itinéraires adresse-à-adresse et fournit des données continuellement actualisées. Il exige une clé API avec `Authorization: Bearer`; aucune clé n’est créée ni activée dans ce dépôt.

- OJP officiel : https://data.opentransportdata.swiss/fr/dataset/ojp2-0
- Documentation : https://opentransportdata.swiss/fr/cookbook/open-journey-planner-ojp-landing-page/
- Limites et conditions : https://opentransportdata.swiss/fr/limits-and-costs/

Le quota gratuit annoncé est limité ; les seuils supérieurs peuvent être payants. Aucun appel payant, abonnement ou contact n’est autorisé par cette veille.

## Calculateur déjà raccordé

`swiss-transport-api.js` appelle `https://transport.opendata.ch/v1/connections`, un calculateur tiers documentant une alimentation par horaires suisses et GTFS-RT. Le 7 novembre 2026, une recherche Genève → Lausanne a répondu avec un service RE 33 planifié. Cette réponse reste indicative : l’adaptateur affiche explicitement `price: null` et `confirmed: false`.

- Documentation du calculateur : https://transport.opendata.ch/docs.html

Ce service est utile pour les suggestions Genève/Lausanne, mais ne remplace pas OJP officiel, un contrôle temps réel officiel, ni un tarif d’achat.

## Prix

Aucun barème suisse global n’est ajouté. Un prix dépend des zones, du titre, du trajet et de la date. L’OJP Fare officiel fait partie des API qui nécessitent une clé ; un devis frais est requis avant achat. Un document tarifaire ou une réponse d’itinéraire sans devis ne doit jamais être affiché comme prix confirmé.

## Décision

- Découvert et vérifié : GTFS suisse national, OJP 2.0 officiel, réponse actuelle du calculateur tiers déjà intégré.
- Raccordé : seulement le calculateur tiers existant, avec prix inconnu et transport non confirmé.
- Non raccordé : GTFS national complet sur Android, OJP officiel, OJP Fare et temps réel officiel, faute de clé/configuration et de contrôle de volume.
- Aucun déploiement, aucune fusion et aucune modification d’authentification, Supabase ou synchronisation des missions.
