# Bergeronette : rapprochement SIBRA du 8 novembre 2026

État distant de la PR #208 vérifié avant le contrôle : 30a5a7f76cf0a696c137834adda4ac7413ae5c08.

Catalogue officiel : https://transport.data.gouv.fr/datasets/offre-de-transports-sibra-a-annecy-gtfs/
Ressource téléchargée : https://www.data.gouv.fr/api/1/datasets/r/8b12f6db-9aa7-43dc-a179-013998a1c4c0
Redirection observée vers https://static.data.gouv.fr/resources/offre-de-transports-sibra-a-annecy-gtfs/20261106-075925/gtfs-sibra.zip
SHA-256 de l'archive : 13948ea007139e52708bd3ebc90c5eff481e091f13d28c98db2dccc90b67da51.

Lecture réelle de stops.txt : BERGERONETTE existe avec quais 0:1BER (45.922175, 6.1715287), 0:2BER (45.9224305, 6.1717371), parent 1:BER. Rapprochement stop_times.txt → trips.txt → routes.txt : seule la ligne 82, intitulée Ligne 82 - Groisy / Annecy, utilise ces points dans l'archive. Aucun route_short_name Y62 ou Y63 n'est présent.

Ce constat complète le rapport Haute-Savoie : l'arrêt existe dans un autre flux officiel, mais sa présence sur SIBRA ne démontre ni les courses Y62/Y63 ni leur reprise après travaux. Les quais de deux flux ne doivent pas être fusionnés par simple ressemblance de nom ou de coordonnées. Aucun calendrier ou tarif régional n'est ajouté à partir de ce rapprochement.

Le fichier calendar.txt est vide : contrôler calendar_dates.txt avant toute recherche à une date donnée. Aucune circulation de la ligne 82 n'a été certifiée ici. Source identifiée et arrêt rapproché seulement ; pas de raccordement applicatif supplémentaire, déploiement ou fusion. Auth, Supabase et synchronisation non modifiés.
