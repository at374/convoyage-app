# Audit de couverture — Aix-les-Bains, Ambérieu, Archamps, Saint-Julien, Chambéry (2026-11-09)

## Constat code
Dans `transport-gtfs-agenda.js`, les sources explicitement déclarées incluent Cars Région Ain, Cars Région Haute-Savoie, Cars Région Express, TAC et d'autres réseaux. **Aucune ressource distincte Ondéa, TAM ou Synchro n'y est déclarée** à la date de cet audit. Les rectangles de sélection géographique ne démontrent pas la présence d'horaires ou de tarifs valides. Le chargement est limité à deux flux GTFS par recherche.

## Sources publiques à raccorder et vérifier
- Agrégat Oùra, 44 réseaux dont Ondéa, TAM, Synchro, TAC, Cars Région Ain/Savoie/Haute-Savoie/Express : https://transport.data.gouv.fr/datasets/agregat-oura ; ressource https://transport.data.gouv.fr/resources/78904 . Attention : le ZIP agrégé dépasse 100 Mo, il ne doit pas être téléchargé intégralement dans chaque fiche mission.
- Ondéa Aix-les-Bains : GTFS + GTFS-RT alertes et TripUpdates : https://transport.data.gouv.fr/datasets/ctlb-donnees-theoriques-et-rt-aix-les-bains-lac-du-bourget/
- Synchro Chambéry : GTFS, tracés et GTFS-RT : https://transport.data.gouv.fr/datasets/arrets-et-horaires-theoriques-bus-temps-reel
- TAM Ambérieu-en-Bugey : présent dans l'agrégat Oùra, mais ressource individuelle, accessibilité navigateur, tarifs et calendrier à vérifier.
- Archamps / Saint-Julien-en-Genevois : vérifier par arrêt les Cars Région Haute-Savoie, les réseaux genevois et les produits transfrontaliers. Le périmètre géographique d'une source ne prouve pas qu'une ligne dessert un arrêt.
- Vérifier les dates de service par opérateur dans l'agrégat : la validité globale du ZIP ne garantit pas celle de chaque réseau.

## Critères d'acceptation
1. Téléchargement réel de chaque GTFS nécessaire, contrôle CORS, format, taille et fraîcheur.
2. Vérification des arrêts et courses sur des dates précises, y compris mercredis, vacances et jours fériés.
3. Marche d'approche et de sortie avec géométrie réelle, correspondances et marge de prise en charge.
4. Prix officiels attribués au bon réseau, à la zone, au titre, à la date et au profil ; sinon « Tarif inconnu ».
5. Plusieurs résultats automatiques dans la fiche mission existante, carte et tri, sans champ de recherche supplémentaire.
6. Tests de régression, navigateur mobile puis Android réel avant tout déploiement.
7. Aucun changement de synchronisation des missions, authentification ou Supabase.

**Statut : sources repérées, raccordement et couverture complète non validés.**

## Fenêtres calendaires relevées dans la ressource officielle Oùra (consultation du 9 novembre 2026)
La ressource officielle https://transport.data.gouv.fr/resources/78904 publie une validité **par réseau**, distincte de la validité générale de l'agrégat :

| Réseau | Fin de couverture GTFS annoncée dans la ressource consultée |
|---|---|
| Cars Région Ain (Ambérieu) | 15 novembre 2026 |
| Synchro Chambéry | 20 décembre 2026 |
| TAM Ambérieu-en-Bugey | 31 décembre 2026 |
| Cars Région Express | 31 janvier 2027 |
| Ondéa Aix-les-Bains | 31 mars 2027 |
| Cars Région Savoie | 31 août 2027 |
| Cars Région Haute-Savoie (Archamps / Saint-Julien, selon arrêts réels) | 31 août 2027 |
| TAC Annemasse | 31 décembre 2027 |

Ces dates proviennent d'un instantané publié, et doivent être revérifiées à chaque mise à jour. **Un itinéraire postérieur à la fin du calendrier de son réseau ne doit jamais être considéré comme confirmé par ce GTFS**, même si l'agrégat global annonce une couverture jusqu'en 2028. Les horaires ne constituent pas une preuve de tarif.

## Rectificatif — 9 novembre 2026
La date « 15 novembre 2026 » donnée plus haut pour **Cars Région Ain** ne correspond plus à la version de l'agrégat Oùra consultée le 9 novembre. La ressource officielle https://transport.data.gouv.fr/resources/78904 indique désormais **27 octobre 2026 – 31 août 2027** pour Cars Région Ain. Toujours vérifier le calendrier des courses réellement chargé et ne pas extrapoler la validité d'un flux à un autre.
