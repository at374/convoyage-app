# X36 : vérification réelle du GTFS, 8 novembre 2026

État distant consulté : PR #208 aab46921bc01df356653d4a99e3d0bc38afcfca3.

Flux téléchargé : https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=CARS_REGION_EXPRESS&dataFormat=GTFS&dataProfil=OPENDATA
SHA-256 : cce953c705ff0b49993822f806364af53b0e3d084933b47e0994fcfcf7d8ab5e. feed_info : version 20261102, du 2 novembre 2026 au 31 janvier 2027.

La X36 contient 16 trip_id et 15 stop_id distincts. Lecture de calendar.txt et calendar_dates.txt (exceptions prioritaires) : 8 courses actives le lundi 9 novembre 2026. Certaines sont partielles et ne doivent pas être assimilées à des trajets entre les deux terminus.

Exemples : Bourg-en-Bresse Gare Routière FR:01053:ZE:29763:CARSxREGIONxEXPRESS (46.199498, 5.215381) 07:02 → Bellegarde Gare Routière FR:01033:ZE:29769:CARSxREGIONxEXPRESS (46.110645, 5.824986) 08:40. Sens inverse : 16:32 → 18:22. Les services partiels Nurieux–Bellegarde et Bellegarde–Nurieux doivent rester visibles.

La matrice tarifaire officielle X36 enregistrée donne 11 € pour BELLEGARDE Gare–BOURG-EN-BRESSE Gare au produit adulte illico AUTOCARS. Le rapprochement des terminus est documenté ; les points intermédiaires nécessitent un rapprochement exact des secteurs. Par exemple le GTFS appelle un point Montréal-la-Cluse Gare dans la commune INSEE 01063, alors que la grille distingue BRION Gare et MONTREAL-LA-CLUSE Ville : ne pas choisir selon le seul nom.

Le calendrier général finit le 31 janvier 2027 ; il ne doit pas être prolongé. Aucune date de fin de la grille tarifaire n'est déduite de cette échéance GTFS. Prix commercial à revérifier pour la date, le produit et le voyageur ; pas de seconde remise de 30 %.

Statut : téléchargement et contrôle de services effectifs dans le fichier, non confirmation de circulation réelle. Pas de nouveau code applicatif, de déploiement ou de fusion. Auth, Supabase et synchronisation préservés.
