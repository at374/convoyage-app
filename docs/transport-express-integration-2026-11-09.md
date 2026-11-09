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

Les PDF adulte illico AUTOCARS du 1er mars 2026 donnent 105 cellules X36, 66 X37 et 28 X38. La comparaison des trois PDF téléchargés avec les inventaires confirme les 199 montants transcrits.

Le panneau affiche 123 références pour un trajet direct du réseau Cars Région Express dans le sens consigné dans la grille. Le rapprochement porte sur la ligne, le code communal et l’identifiant de chaque arrêt, avec contrôle des coordonnées à 50 mètres du point vérifié. La date locale de montée doit être comprise entre le 1er mars et le 31 décembre 2026. Cette limite borne l’usage de la référence et ne constitue pas une date de fin officielle du barème.

| Ligne | Arrêts rapprochés | Cellules raccordées | Exemple testé sur le GTFS réel du 9 novembre |
| --- | ---: | ---: | --- |
| [X36](https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/03/CAR_RARA_TARIFS-ILLICO-AUTOCARS_X36_Bellegarde-Bourg_2026.pdf) | 13 | 78 | Bellegarde Gare Routière → Bourg-en-Bresse Gare Routière · 11,00 € |
| [X37](https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/03/CAR_RARA_TARIFS-ILLICO-AUTOCARS_X37_Nantua-St-Claude_2026.pdf) | 9 | 35 | Saint-Claude → Nantua Médiathèque · 7,00 € |
| [X38](https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/03/CAR_RARA_TARIFS-ILLICO-AUTOCARS_X38_Bourg-en-Bresse-Oyonnax_2026.pdf) | 5 | 10 | Oyonnax → Bourg-en-Bresse Gare Routière · 8,60 € |

Les références sont affichées avec leur PDF et une mention de vérification avant achat. Les 76 autres cellules ne sont pas raccordées. Elles incluent les arrêts ambigus et le montant X37 Saint-Claude → Molinges qui demande un devis. Aucun tarif n’est déduit pour le sens opposé ou une correspondance. Aucune remise supplémentaire n’est appliquée sur ces montants illico AUTOCARS. L’affichage n’alimente pas le total ni le tri par prix confirmé. Les offres à prix variable exigent un devis frais pour le trajet, la date et le profil.

La publication Android et la vérification exhaustive des autres réseaux AURA, de Genève et de Lausanne restent ouvertes.
