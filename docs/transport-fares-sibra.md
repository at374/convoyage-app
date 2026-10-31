# Tarifs et abonnement SIBRA — état du 31 octobre 2026

## Comportement livré dans l’Agenda

Un volet repliable présente les prix de titres SIBRA : 2,50 € à bord, 2,00 € en achat digital ou rechargement, avec support éventuel en supplément. La consultation est datée et les liens officiels restent accessibles. Ces montants ne sont jamais injectés dans `priceEUR`, additionnés par branche ou utilisés pour annoncer le trajet le moins cher : l’éligibilité des arrêts et du produit choisi n’est pas encore calculée automatiquement.

Le volet rappelle l’acceptation des titres SIBRA sur Y21, Y22, Y51, Y62, Y63 et 272 à l’intérieur du Grand Annecy, hors ticket SMS. Le règlement décrit des arrêts supplémentaires pour Y21/Y22 à Sillingy et La Balme-de-Sillingy. Le nom d’une ligne ne prouve pas la couverture de ses extrémités. Un abonnement personnel doit être valide au moment du voyage ; le prix d’achat annuel n’est pas le coût supplémentaire du déplacement. Le trajet complet vers Genève n’est pas rendu gratuit.

## Sources primaires consultées

- https://www.sibra.fr/voyages-occasionnels/ : conditions de correspondance et périmètre annoncé depuis le 1er juillet 2026.
- https://www.sibra.fr/voyages-reguliers/ : périmètre des abonnements et lien vers la grille du 1er juillet 2026.
- https://www.sibra.fr/app/uploads/2025/12/Reglement_BUS_CARS_CGV_06012026_VDEF_compressed.pdf : grille des titres page imprimée 4, limites régionales page 4, frais de support page 6. Les tarifs peuvent être révisés ; aucune date de fin de barème n’est inventée.

L’interface indique la date de consultation et invite à consulter les conditions actuelles. Ce volet est un repère documentaire, pas une preuve tarifaire calculée pour une mission.

## Correction du calcul par portion

`CPTransportFares.fare` vérifie désormais les bornes du barème et de l’abonnement au départ de **chaque portion**, et non systématiquement au premier départ du trajet. Exemple : un départ le 30 novembre à 23 h 50 n’autorise pas l’application d’un barème expirant ce jour-là à une correspondance du 1er décembre à 0 h 10. La date globale sert uniquement de secours lorsqu’une portion n’a pas de départ. Une date fournie mais invalide ou vide ne contourne pas la validation.

Les indicateurs `passApplied` et `verified` sont des booléens. Chaque portion vérifiée conserve sa source et ses bornes de validité dans le détail tarifaire. Si un abonnement a expiré mais qu’un tarif payant indépendant est valide, seul ce tarif peut être retenu. Si une portion reste inconnue, le total demeure inconnu. Les appels historiques sans aucune date restent compatibles ; ils ne constituent pas une validation datée de mission.

## Validation et limites

- Local : 174 tests JavaScript réussis, 2 tests Python réussis, contrôles de syntaxe et `git diff --check` réussis.
- Nouveaux cas : changement de barème après minuit, expiration de l’abonnement, date de portion prioritaire, date invalide/vide, repli sur tarif payant, chaîne réelle adaptateur → calculateur.
- Navigateur : Chromium 156, viewport Pixel 7 412 × 839, ouverture du volet, prix et limites présents, liens officiels, aucun débordement horizontal ; régression Aller/Jonction/Retour, géocodage tardif, fermeture et relais maintenue. Missions fictives, requêtes externes simulées ; les pages tarifaires ont été consultées séparément pendant la recherche.
- Android physique : non testé. Aucun déploiement ni changement Supabase/authentification/synchronisation.
- Restent à raccorder : reconnaissance fiable des portions tarifaires régionales, validité personnelle de l’abonnement, titres couvrant plusieurs branches sans double comptage, puis tarifs SNCF/FlixBus/BlaBlaCar vérifiables. Aucun prix total supplémentaire n’est annoncé par ce lot.
