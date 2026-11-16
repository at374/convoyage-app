# Sources officielles OTP2 — Suisse (16 novembre 2026)

## Source identifiée et vérifiée
- Organisme : SKI, mandaté par l'Office fédéral des transports suisse.
- Documentation GTFS : https://opentransportdata.swiss/fr/cookbook/timetable-cookbook/gtfs/
- Catalogue 2026 : https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020
- Catalogue 2027 : https://data.opentransportdata.swiss/en/dataset/timetable-2027-gtfs2020
- La page 2026 recense notamment `GTFS_FP2026_20261111.zip` et `GTFS_FP2026_20261107.zip` (archives référencées dans le catalogue, **non téléchargées ni auditées**).
- Le GTFS suisse décrit le réseau national de transport public ; vérifier dans les archives les arrêts précis utiles à Genève, Lausanne et aux correspondances avec les lignes françaises.
- Attention : GTFS Static = horaires planifiés, **pas de temps réel**. Les prix SNCF, FlixBus, BlaBlaCar et autres billets commerciaux ne sont pas garantis par ce jeu de données.
- La documentation suisse indique que `shapes.txt` n'est pas fourni dans le GTFS standard ; ne pas présenter les lignes géométriques comme des tracés précis avant routage OSM.

## Protocole de récupération (aucune ressource Cloud)
1. Sur le catalogue, choisir une ressource datée couvrant les dates des missions à tester, et enregistrer l'URL de téléchargement **réelle** ainsi que la licence.
2. Télécharger sur un ordinateur local uniquement après vérification de la taille et de la capacité disque.
3. Exécuter `node scripts/otp-gtfs-audit.cjs <archive.zip>` et enregistrer le JSON (SHA256, dates, arrêts, fuseau).
4. Contrôler le nombre et la localisation des arrêts, les calendriers et les identifiants de services.
5. Ne pas affirmer que les lignes AURA et transfrontalières sont couvertes avant validation des GTFS français.
6. Pour 2027, ne pas utiliser un jeu d'horaires 2026 sans vérification des dates de service.

## Données françaises
Les flux AURA/SNCF/Sibra/TAC/TPG/TER ne sont **pas** attestés par cette fiche. Rechercher les archives officielles par opérateur, puis documenter leurs URLs, licences et couvertures dans un manifeste distinct. Éviter d'importer deux fois les mêmes courses depuis plusieurs flux.

## Suivi
- Sources officielles identifiées : **oui, Suisse 2026 et 2027**.
- ZIP téléchargés et SHA256 vérifiés : **non**.
- GTFS français validés : **non**.
- Graphe OTP2 construit : **non**.
- Serveur déployé : **non**.
