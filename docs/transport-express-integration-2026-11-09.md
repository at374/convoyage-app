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

Le panneau affiche 198 références pour un trajet direct du réseau Cars Région Express dans le sens consigné dans la grille. Le rapprochement porte sur la ligne, le code communal et l’identifiant de chaque arrêt, avec contrôle des coordonnées à 50 mètres du point vérifié. La date locale de montée doit être comprise entre le 1er mars et le 31 décembre 2026. Cette limite borne l’usage de la référence et ne constitue pas une date de fin officielle du barème.

| Ligne | Arrêts rapprochés | Cellules raccordées | Exemple testé sur le GTFS réel du 9 novembre |
| --- | ---: | ---: | --- |
| [X36](https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/03/CAR_RARA_TARIFS-ILLICO-AUTOCARS_X36_Bellegarde-Bourg_2026.pdf) | 15 | 105 | Bellegarde Gare Routière → Bourg-en-Bresse Gare Routière · 11,00 € |
| [X37](https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/03/CAR_RARA_TARIFS-ILLICO-AUTOCARS_X37_Nantua-St-Claude_2026.pdf) | 12 | 65 | Saint-Claude → Nantua Médiathèque · 7,00 € |
| [X38](https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/03/CAR_RARA_TARIFS-ILLICO-AUTOCARS_X38_Bourg-en-Bresse-Oyonnax_2026.pdf) | 8 | 28 | Oyonnax → Bourg-en-Bresse Gare Routière · 8,60 € |

Les [fiches horaires régionales X36](https://www.laregionvoustransporte.fr/cars-region/cars-region-de-lain/ligne/x36-bellegarde-bourg-en-bresse/), [X37](https://www.laregionvoustransporte.fr/cars-region/cars-region-de-lain/ligne/x37-nantua-saint-claude/) et [X38](https://www.laregionvoustransporte.fr/cars-region/cars-region-de-lain/ligne/x38-oyonnax-bourg-en-bresse/) permettent de distinguer des libellés GTFS incomplets. Les heures ci-dessous recoupent la fiche avec la course dans le GTFS. Les fiches papier servent ici à identifier les arrêts. Le calendrier des recherches reste celui du GTFS de la date demandée.

| Arrêt de la grille | Identifiant GTFS | Preuve d’identité |
| --- | --- | --- |
| Brion Gare | `FR:01063:ZE:29691:CARSxREGIONxEXPRESS` | X36 à 07:03, X37 à 06:48 et X38 à 05:47. Le code UIC 87131961 renvoie à Brion dans le [registre SNCF](https://ressources.data.sncf.com/explore/dataset/liste-des-gares/). |
| Villereversure Gare | `FR:01447:ZE:29804:CARSxREGIONxEXPRESS` | X36 à 07:32 et code UIC 87743328 dans le registre SNCF. |
| Montréal-la-Cluse Mairie | `FR:01265:ZE:29808:CARSxREGIONxEXPRESS` | X37 à 06:43 et X38 à 11:17. L’arrêt Ville porte l’identifiant distinct 29754. |
| Martignat Mairie | `FR:01237:ZE:29809:CARSxREGIONxEXPRESS` | X37 à 06:37 et X38 à 11:22. |

Les références sont affichées avec leur PDF et une mention de vérification avant achat. La cellule X37 Saint-Claude → Molinges reste exclue et demande un devis. Aucun tarif n’est déduit pour le sens opposé ou une correspondance. Aucune remise supplémentaire n’est appliquée sur ces montants illico AUTOCARS. L’affichage n’alimente pas le total ni le tri par prix confirmé. Les offres à prix variable exigent un devis frais pour le trajet, la date et le profil.

La publication Android et la vérification exhaustive des autres réseaux AURA, de Genève et de Lausanne restent ouvertes.

## Extension aux lignes X25 et X33

La [page tarifaire officielle de l’Ain](https://www.laregionvoustransporte.fr/cars-region/cars-region-de-lain/infos-et-services-cars-region-de-lain/titres-et-tarifs-de-lain/) publie deux autres grilles. Le périmètre compte désormais 491 références affichables sur cinq lignes. Chaque montant reste distinct du devis.

| Ligne | Produit | Arrêts | Montants | Cases vides dans le triangle |
| --- | --- | ---: | ---: | ---: |
| [X25](https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/03/Tarifs-a-bord-mars-2026-x25.pdf) | Adulte à bord | 9 | 33 | 3 |
| [X33](https://storage.googleapis.com/is-wp-170-prod/uploads-prod/2026/03/X33_Grilles-tarifaires-01032026.pdf) | Adulte illico AUTOCARS | 27 | 260 | 91 |

La X25 a été transcrite depuis le PDF rendu, car les chiffres ne figurent pas dans sa couche texte. La X33 a été lue par position des nombres dans les colonnes du PDF, en conservant les trous entre les branches. Les arrêts proviennent du GTFS officiel et les fiches [X25](https://www.laregionvoustransporte.fr/cars-region/cars-region-de-lain/ligne/x25-villefranche-sur-saone-macon-loche-tgv/) et [X33](https://www.laregionvoustransporte.fr/cars-region/cars-region-de-lain/ligne/x33-valserhone-divonne-les-bains/) distinguent les arrêts de même commune et les variantes, notamment Allondon Nord et Sud. Une case vide ne produit aucun montant. Le moteur exige une course directe effectivement planifiée dans le sens recherché avant d’afficher la référence.

Essai du 9 novembre avec l’archive GTFS officielle. Six courses X25 Villefranche Gare routière → Mâcon Loché TGV affichaient la référence de 9,60 €. Dix-huit courses X33 Divonne Ancienne Gare → Valserhône Gare affichaient la référence de 8,60 €. Le cas Villefranche Gare routière → Arnas Avé Maria et la case Divonne Ancienne Gare → Ferney Mairie restent sans prix. Les PDF vérifiés ont pour SHA-256 `252c93fdc72d36cc7f1f8264d88f68307933d34791979188ad862682a5d326d9` (X25) et `553b06a4e267c648b231536b9b72a704019b28435e13c79ac22e0df81c6b381c` (X33).

## Recherche de prix sur les autres lignes Express

Les fiches officielles X13, X18, X51, X71, X73, X74, X75 et X76 ont été consultées, avec leurs PDF d’horaires. Elles ne fournissent pas de matrice chiffrée par arrêt dans les documents consultés. La [Loire](https://www.laregionvoustransporte.fr/cars-region/cars-region-de-la-loire/infos-et-services-cars-region-de-la-loire/titres-et-tarifs-loire/) et [l’Ardèche](https://www.laregionvoustransporte.fr/cars-region/cars-region-de-lardeche/titres-et-tarifs-de-lardeche/) distinguent les produits Express des barèmes ordinaires. La [fiche commune D36/X71](https://www.laregionvoustransporte.fr/cars-region/cars-region-de-la-drome/ligne/d36-x71-montelimar-grignan-nyons/) précise que la X71 relève du tarif régional SNCF.

Les détails GTFS des treize lignes Express proposent désormais la fiche officielle de la ligne et un lien vers la recherche SNCF Connect. Cette recherche doit être renseignée par trajet et date. Le lien ne garantit ni une réponse pour tous les arrêts, ni un prix. Le total reste inconnu en l’absence de devis. Les liens s’appliquent uniquement aux portions identifiées dans le flux Express. L’essai vérifie notamment que la D36 n’hérite pas du lien de la X71.
