# Ligne 272 Annecy–Genève : grille tarifaire TPG

Vérification le 7 novembre 2026. La [page officielle TPG de la ligne 272](https://www.tpg.ch/fr/ligne-272) lie directement la [grille tarifaire 272](https://www.tpg.ch/sites/default/files/2026-09/LIT272_grille_tarifaire_20251214_20261212_vDEF.pdf). L'image de sa matrice a été examinée : la grille porte la période du 14 décembre 2025 au 12 décembre 2026.

## Parcours Annecy–Genève : références publiées

La matrice associe Annecy ou Annecy Pringy vers « Genève ou Saint-Julien Douane » à la zone transfrontalière 5. Pour cette zone, le document indique :

| Titre | Montant en euros |
| --- | ---: |
| Billet unité Parcours | 11,30 € |
| Billet unité Parcours + zone 10 | 14,50 € |
| Carte journalière Parcours | 22,50 € |
| Carte journalière Parcours + zone 10 | 28,90 € |

La zone 10 ajoutée permet d'utiliser les transports de la zone genevoise selon les conditions indiquées par TPG. Ces montants sont des références de la grille, non un devis personnalisé, ni une preuve de circulation, de disponibilité ou de validité après le 12 décembre 2026. L'application n'identifie pas encore de manière fiable chaque arrêt de la 272 et sa zone : aucun prix n'est injecté automatiquement.

La page TPG rappelle que le titre adapté doit couvrir l'ensemble du parcours transfrontalier. La vente à bord n'est pas autorisée sur le territoire suisse, sauf à l'arrêt Genève-Aéroport gare routière selon la page de la ligne ; la note générique du PDF est plus restrictive. Vérifier le canal de vente avant le départ.

## Tarification locale et conflit documentaire

La grille actuellement liée depuis la page TPG indique pour un trajet **entièrement** dans la zone Sibra Grand Annecy : un voyage à 2,00 €, ou 2,50 € en vente à bord, et un pass mensuel adulte à 40,00 €. Une [autre grille TPG encore accessible](https://www.tpg.ch/sites/default/files/2025-12/LIT_272_Grille_tarifaire_20251214_20261212.pdf), portant les mêmes dates de validité, indique 1,50 € pour le billet unité et 40,00 € pour l'abonnement mensuel adulte. Les documents divergent donc sur le billet local ; leur existence ne prouve ni une date précise de changement ni le prix applicable à chaque canal/date.

La référence à une tarification locale Sibra sur une portion française de la 272 ne démontre pas que chaque abonnement Sibra, et notamment un abonnement annuel particulier, est accepté pour chaque portion ou pour un trajet traversant la frontière. Elle nuance la décision conservatrice de garder le prix 272 inconnu : ne pas conclure qu'aucun titre Sibra n'est utilisable localement. Vérifier les droits précis et les arrêts avant toute déduction.

## Statut

Contrôle GTFS direct le 7 novembre : l'archive officielle Haute-Savoie (SHA-256 `9d3c594378d1618793aa8b8878d3023c1eb7de7e21ddaa9dc2d2e46dc36677cb`, version `20261028`) contient la ligne 272, 61 courses et 63 arrêts associés. Les arrêts Gare Routière Annecy, Pringy Gare dans les deux sens et Aéroport Genève figurent sur certaines courses. Le lecteur préparé rapproche uniquement ces identifiants et leurs coordonnées (tolérance 50 m) des secteurs Annecy, Annecy Pringy et Genève de la matrice. Cette correspondance ne prouve pas qu'une course relie les arrêts pour la date choisie, que le véhicule circule ou que le billet est vendable. Aucun autre arrêt, notamment Douane P+R, n'est assimilé automatiquement à un secteur. Le calendrier global du fichier ne prouve pas le service de chaque course ni la validité des prix au-delà de la grille TPG.

- Découvert et contrôlé : documents officiels TPG, matrice zone 5, divergence entre deux publications locales.
- Préparé et testé : correspondance bornée à quatre identifiants GTFS, sans validation de course ni de prix final.
- Non raccordé : grille à l'application, correspondance exhaustive entre arrêts et zones, abonnements locaux et correspondances.
- Aucun nouveau tarif appliqué à un résultat Android, aucune fusion, aucun déploiement ou achat.
