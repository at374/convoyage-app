# Veille transports du 9 novembre 2026

État distant relevé avant modification. La [PR #208](https://github.com/at374/convoyage-app/pull/208) est ouverte à partir de `docs/transport-sources-audit-20261105`, au commit `13b1ab0f90d83ac31f6ccfefba67b019c9504c71`. La branche principale est au commit `c92366fe9a40e3b275295592157ad9e35b13f2c5`.

## Ain et Cars Région Express

- Le [GTFS individuel Cars Région Ain](https://transport.data.gouv.fr/resources/83113) a été téléchargé auprès d’Oùra. `feed_info.txt` couvre du 28 octobre 2026 au 31 août 2027. Le ZIP contient 31 lignes, 1 374 entrées d’arrêts et 711 entrées de courses. Le calcul du jour de service avec `calendar.txt` et `calendar_dates.txt` donne 483 courses sur 31 lignes le 9 et le 16 novembre 2026, 461 courses sur 29 lignes le 31 août 2027 et aucune course le 1er septembre 2027. Ces comptages portent sur l’horaire théorique. SHA-256 du ZIP `353e091109c44021582998f6edfaa7b486fd37aa75c101c4f8d9656d49e47431`.
- Le [NeTEx de l’Ain](https://transport.data.gouv.fr/resources/83896) affiche également cette période sur le PAN. L’API du catalogue indique une actualisation du NeTEx le 8 novembre et un horodatage GTFS distinct de celui de la page de présentation. Pour la période GTFS, la preuve retenue est celle du ZIP. La comparaison des versions binaires, des parcours, des horaires détaillés et des exploitants reste à faire. Aucun changement de tarif déduit de ces dates.
- Le [catalogue Cars Région Express](https://transport.data.gouv.fr/datasets/reseau-interurbain-cars-region-express) annonce une échéance au 31 janvier 2027 pour le GTFS et le NeTEx. Ce calendrier est distinct du GTFS de l’Ain.
- Les deux PDF opérateur du barème adulte illico autocar au 1er mars 2026 ont été comparés au [relevé structuré X37/X38](../data/transport/x37-x38-illico-autocars-references-2026-11-08.json). Les 66 cellules X37, les 28 cellules X38 et les 20 libellés d’arrêt concordent. La cellule Saint-Claude Gare → Molinges Village affiche bien 6,00 €, contre 4,00 € jusqu’à Dortan Mairie. Contrôle visuel effectué sur X37. Le rapprochement avec les identifiants d’arrêts, les sens et l’éventuelle règle de correspondance reste nécessaire. L’anomalie exige un prix confirmé par le calculateur avant automatisation.

## Haute-Savoie — Proxim iTi

- L’[avis officiel Proxim iTi](https://www.proximiti.fr/vos-deplacements/infos-trafic/) déplace Marignier Gare sur l’avenue de la Gare du 4 novembre au 11 décembre 2026 inclus pour les lignes 180, 380 et 480. Utiliser l’arrêt provisoire pour les approches et correspondances pendant cette période. Les coordonnées exactes du quai provisoire restent à valider.
- Le [jeu dédié sur le PAN](https://transport.data.gouv.fr/datasets/offre-de-transport-du-reseau-proxim-iti-gtfs) a zéro ressource active. Les [horaires officiels](https://www.proximiti.fr/vos-deplacements/horaires-a-telecharger/) et [Bus CheckIn](https://www.proximiti.fr/vos-deplacements/itineraire-enregistrement/) donnent un accès à la recherche par date et aux conditions des arrêts sur demande. Source opérateur exploitable en consultation. Flux automatisable actuel à confirmer.
- Le [barème opérateur en ligne](https://www.proximiti.fr/tarifs-abonnements/lignes-regulieres-de-bus/) affiche 1,70 € à l’unité avec correspondance pendant 1 h 30 sur les lignes régulières, 14 € les dix trajets, 21 € par mois et 210 € par an au tarif de base. La page date le ticket unitaire du 1er septembre 2024. Ce contrôle confirme le montant affiché au 9 novembre 2026. Aucun changement de prix au 9 novembre établi.

## Genève, Lausanne et Suisse

- Le [catalogue SKI](https://data.opentransportdata.swiss/fr/dataset/timetable-2027-gtfs2020) publie `GTFS_FP2027_20261104.zip` pour la période du 13 décembre 2026 au 11 décembre 2027. Le [contrôle précédent](transport-swiss-current-source-2026-11-07.md) s’arrêtait à l’horaire 2026 dont la validité se termine le 12 décembre. Sélectionner le millésime par date de service pour un futur index. Les courses de l’archive 2027 et son temps réel restent à valider.
- Le [projet d’horaire CFF](https://news.sbb.ch/fr/019e3f6f-623c-7086-87cf-ebb0809277ad/ameliorations-ponctuelles-avec-lhoraire-2027) prévoit RE34 pour Genève-Aéroport–Martigny et conserve RE33 pour Annemasse–Saint-Maurice/Martigny. Éviter un rapprochement fondé uniquement sur le numéro avant validation des identifiants et des dates du nouveau flux.

## Catalogue et portée

Comparaison de l’[API nationale du PAN](https://transport.data.gouv.fr/api/datasets) au [relevé du 5 novembre](transport-pan-inventory-2026-11-05.json). Des horodatages ont évolué pour les flux de l’Allier, de l’Ardèche, de la Drôme, de l’Isère, de la Loire, de la Haute-Loire, de la Savoie et de la Haute-Savoie, ainsi que Cars Région Express, SNCF, le GTFS FlixBus et le SIRI Lite BlaBlaCar Bus. Ce sont des signaux de republication. Ils ne prouvent ni une nouvelle desserte, ni un changement de prix, ni la circulation d’une course. La comparaison exhaustive des lignes, arrêts, zones et grilles dans les douze départements et jusqu’à Lausanne reste ouverte.

Les prix variables de SNCF, des cars longue distance, de BlaBlaCar, des CFF et des comparateurs demandent un devis frais par trajet, date et profil. Les flux d’horaires et le temps réel ne fournissent pas ce devis. Le contrôle de ce jour ne valide aucun nouveau connecteur de prix.

Les seules corrections préparées ici concernent les références et la documentation. Tests effectués sur les 94 cellules X37/X38 et sur les jours de service du GTFS Ain. Aucun raccordement à l’application, déploiement ou changement dans l’authentification, Supabase et la synchronisation des missions.
