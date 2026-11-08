# Haute-Savoie : contrôle croisé GTFS et fiches du 8 novembre 2026

État distant récupéré avant contrôle : branche de la PR #208 au commit 502d4f27a885b76f399dcae551a4390e4cd52b4f.

Flux effectivement téléchargé : https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=HAUTE_SAVOIE&dataFormat=GTFS&dataProfil=OPENDATA

SHA-256 : a692fad8642b1ecf3f0a810f5ad1d0c53ef22fe52bc2004173a0cd569fb72e27. Version producteur 20261028, feed_start_date 20261028, feed_end_date 20270831. La date de fin globale ne prouve pas la couverture de chaque arrêt ou départ.

Contrôle par lecture de routes.txt, trips.txt, stops.txt, stop_times.txt, calendar.txt et calendar_dates.txt. Pour chaque date, les exceptions 1/2 sont prioritaires sur le jour de semaine et les bornes du calendrier.

## Y22 : changements présents dans le flux

Le lundi 9 novembre 2026, course HAUTExSAVOIE:ServiceJourney:1103971x1176850:LOC : Gare Routiere 09:00 → Les Grandes Vignes 09:31. Le dimanche 15 novembre 2026, course HAUTExSAVOIE:ServiceJourney:1103972x1176853:LOC : Gare Routiere 10:00 → Gare Routiere 11:17. Ces deux résultats correspondent aux décalages annoncés par l'avis régional : https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/09/InfoTrafic-Y22-17.09.2026.pdf

Validation des horaires théoriques uniquement, pas de circulation réelle, marge porte-à-porte ou prix. La présence d'une autre course à 09:30 en semaine ne doit pas être interprétée comme un défaut : le décalage à 10:00 concerne le dimanche.

## Y62/Y63 : reprise Bergeronette non confirmée par ce GTFS

Fiche officielle pour le 7–18 décembre : https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/09/cars_region_haute_savoie_horaires_Y62-63_rentree_2026-du-7-12-au-18-12-1.pdf

Le fichier stops.txt téléchargé ne contient aucun nom comprenant Bergeronette ou le radical bergeron. Il contient seulement La Bergerie parmi les noms contenant berger : ce n'est pas le même arrêt. Les lignes Y62 et Y63 ont pourtant des services actifs le 7 décembre : respectivement 30 et 13 courses dans cette archive (contre 10 et 1 le 6 décembre). Il ne faut donc pas interpréter la fin globale du flux comme une preuve de prise en compte de l'arrêt annoncé dans la fiche.

Impact : un calcul GTFS vers Bergeronette après le 6 décembre peut manquer un arrêt annoncé dans le PDF. L'absence dans ce fichier ne prouve ni suppression ni suspension réelle après cette date. Recontrôler le flux ou une autre source datée ; ne pas inventer de course ou coordonnées.

## Livraison

Références et contrôle enregistrés ; aucun remplacement manuel de GTFS, aucun tarif ajouté, aucun changement applicatif. Contrôle des données effectué par script local, sans test de circulation. Auth, Supabase et synchronisation préservés ; aucun déploiement ni fusion. Ce contrôle limité ne vaut pas audit exhaustif AURA/Suisse.
