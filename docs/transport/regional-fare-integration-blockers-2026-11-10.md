# Tarifs AURA — obstacles de raccordement (10 novembre 2026)

Ce relevé décrit les données **déjà présentes dans le dépôt**, pas une validation des tarifs d'un trajet réel.

| Référence | État dans le dépôt | Blocage avant prix dans une fiche mission |
|---|---|---|
| Cars Région Ain, famille A | `data/transport/cars-region-fare-references-2026-11-06.json` : référence officielle, `currentJourneyPriceVerified:false` | Vérifier ligne/famille A, produit, date de validité et parcours exact ; exclure les X |
| Cars Région Haute-Savoie | Même fichier, références par familles de lignes | Identifier la bonne famille et le tarif applicable au trajet daté |
| X36 illico AUTOCARS | `data/transport/x36-illico-autocars-reference-2026-11-08.json` : `appConnected:false`, `stopMappingVerified:false`, `journeyFareVerified:false` | Rapprocher les arrêts de la matrice des identifiants GTFS et GPS officiels ; vérifier sens et date |
| Y62/Y63 Aravis | `data/transport/aravis-fare-reference-2026.json` et calculateur de référence | Seuls les arrêts GTFS Y62 audités peuvent afficher une référence ; pas de prix confirmé |
| Proxim iTi 460/461 | `transport-proximiti-booking.js` : contrôle de preuve sans connexion Bus CheckIn | Obtenir horaires et arrêts officiels, nature des arrêts, disponibilité et réservation propres au trajet |

## Règle de raccordement

Ne jamais transférer automatiquement un tarif publié vers `fareVerified:true`. Exiger l'identité exacte du réseau, de la ligne, des arrêts, du sens, de la date, du produit et une source valable pour le trajet. En cas de manque : « tarif inconnu » ou « prix de référence non confirmé ». Les distances à vol d'oiseau ne constituent pas un chemin piéton vérifié.

## Ordre d'intégration proposé

1. Cartographier les identifiants GTFS et coordonnées officielles de la X36 vers sa matrice, sans supposer que le tarif est symétrique.
2. Raccorder les familles tarifaires Ain et Haute-Savoie aux seules lignes et dates admissibles.
3. Obtenir le flux officiel Proxim iTi et les preuves Bus CheckIn ; calculer les correspondances piétonnes à l'adresse exacte.
4. Exécuter les tests de non-régression, puis valider les trajets réels sur Android avant toute fusion.

Aucun pourcentage de couverture nationale ne peut être déduit de ces fichiers : les dénominateurs des courses, arrêts, lignes et produits effectivement vérifiés ne sont pas établis.
