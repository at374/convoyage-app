# SIBRA 82 : calendrier et arrêt provisoire, contrôle du 8 novembre 2026

État distant récupéré avant contrôle : PR #208 d45be78cf30ab872f3cbbde637b8d1ef6d25210e. Archive SIBRA déjà téléchargée, SHA-256 13948ea007139e52708bd3ebc90c5eff481e091f13d28c98db2dccc90b67da51.

Ressource officielle : https://www.data.gouv.fr/api/1/datasets/r/8b12f6db-9aa7-43dc-a179-013998a1c4c0

Contrôle de stop_times.txt → trips.txt → calendar_dates.txt pour les quais 0:1BER et 0:2BER : 78 trip_id distincts répartis sur 4 service_id. En sélectionnant les services explicitement ajoutés pour chaque date, 25 courses contenant l'un des quais sont actives les 9 novembre, 4 décembre, 7 décembre et 18 décembre 2026 ; 8 le dimanche 6 décembre ; aucune le 21 décembre dans cette archive. Ces nombres ne sont pas des fréquences garanties ni une absence réelle de transport le 21 décembre : le flux doit être renouvelé au-delà de sa couverture.

Source officielle trafic : https://www.sibra.fr/infos-trafic/deviation-ligne-82-du-19-10-2026-au-28-02-2027/

SIBRA annonce une déviation dans les deux sens du 19 octobre 2026 au 28 février 2027. Thorens-Glières Chef Lieu n'est pas desservi à son emplacement habituel ; report au poteau provisoire au niveau du centre technique municipal. Cette information ne concerne pas une suppression de Bergeronette. Les coordonnées exactes et la prise en compte du poteau provisoire dans le GTFS n'ont pas été vérifiées ici ; ne pas promettre un accès porte-à-porte à partir de l'ancien arrêt.

Statut : contrôle réel de calendrier et avis trafic confirmé, références enregistrées. Aucun changement tarifaire établi, aucune modification des courses, aucune mise à jour de l'application, aucun déploiement ni fusion. Auth, Supabase et synchronisation préservés.
