# Cars Région Express dans Transports

Le code est construit à partir de la PR #208 au commit `c77fb47`. Le panneau Transports utilise le [GTFS officiel Cars Région Express](https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-express) comme source principale si aucun réseau local n’est sélectionné, ou comme second réseau si aucun partenaire local existant ne remplit déjà cette place. La limite de deux flux par recherche est conservée. L’enveloppe géographique sert à sélectionner le flux. Les itinéraires dépendent des arrêts, des courses et du calendrier du fichier téléchargé.

## Vérification du fichier opérateur

Le fichier reçu le 9 novembre 2026 depuis [Oùra](https://api.oura3.cityway.fr/dataflow/offre-tc/download?provider=CARS_REGION_EXPRESS&dataFormat=GTFS&dataProfil=OPENDATA) est la version `20261109`. Il contient 13 lignes et 159 arrêts. Son calendrier va du 9 novembre 2026 au 7 février 2027 inclus, au-delà du 31 janvier annoncé pour le fichier précédent. La source reste dynamique. SHA-256 de cette archive `25d6fbd91fdfa416ced408d47dcc4a2b51044021fcea6217ec501f8aabfa895d`.

Le chargeur applicatif a retrouvé dans l’archive réelle les trajets ci-dessous pour le lundi 9 novembre 2026 et zéro service le 8 février 2027. Les horaires sont théoriques, en heure locale.

| Ligne | Sens vérifié | Nombre de courses directes | Premier départ et arrivée |
| --- | --- | ---: | --- |
| X36 | Bourg-en-Bresse Gare Routière → Bellegarde Gare Routière | 1 | 07:02 → 08:40 |
| X37 | Saint-Claude → Nantua Médiathèque | 8 | 05:50 → 06:59 |
| X38 | Oyonnax → Bourg-en-Bresse Gare Routière | 8 | 05:30 → 06:27 |

Les essais de sélection vérifient l’association Ain–Express, l’utilisation d’Express en l’absence de réseau local et le maintien des deux réseaux Grenoble–Grésivaudan. Le serveur producteur a répondu avec un en-tête CORS autorisant l’origine GitHub Pages testée. Le panneau conserve l’indication de circulation non confirmée et la vérification des accès et des correspondances.

## Tarifs

Les matrices X36, X37 et X38 restent des références documentaires. Le rapprochement des arrêts et des sens doit être établi avant l’affichage automatique. Le GTFS Express téléchargé fournit les horaires et les arrêts. Il ne livre aucun devis. Les trajets à prix variable demandent un devis frais pour la date, le sens et le profil. Le prix inconnu reste affiché comme tel.

Cette branche est prête pour revue. La publication Android et la vérification exhaustive des autres réseaux AURA, de Genève et de Lausanne restent ouvertes.
