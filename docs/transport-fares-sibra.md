# Tarifs et abonnement SIBRA — état du 31 octobre 2026

## Comportement livré dans l’Agenda

Un volet repliable présente les prix de titres SIBRA : 2,50 € à bord, 2,00 € en achat digital ou rechargement, avec support éventuel en supplément. La consultation est datée et les liens officiels restent accessibles. Ces montants ne sont jamais injectés dans `priceEUR`, additionnés par branche ou utilisés pour annoncer le trajet le moins cher : l’éligibilité des arrêts et du produit choisi n’est pas encore calculée automatiquement.

Le volet rappelle l’acceptation des titres SIBRA sur Y21, Y22, Y51, Y62, Y63 et 272 à l’intérieur du Grand Annecy, hors ticket SMS. Le règlement décrit des arrêts supplémentaires pour Y21/Y22 à Sillingy et La Balme-de-Sillingy. Le nom d’une ligne ne prouve pas la couverture de ses extrémités. Un abonnement personnel doit être valide au moment du voyage ; le prix d’achat annuel n’est pas le coût supplémentaire du déplacement. Le trajet complet vers Genève n’est pas rendu gratuit.

## Sources primaires consultées

- https://www.sibra.fr/voyages-occasionnels/ : conditions de correspondance et périmètre annoncé depuis le 1er juillet 2026.
- https://www.sibra.fr/voyages-reguliers/ : périmètre des abonnements et lien vers la grille du 1er juillet 2026.
- https://www.sibra.fr/app/uploads/2026/07/Reglement_BUS_CARS_CGV_01072026_3.pdf : grille des titres page imprimée 4, limites régionales page 4, frais de support page 6. Les tarifs peuvent être révisés ; aucune date de fin de barème n’est inventée.

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

## Raccordement conditionnel dans l’Agenda (lot suivant du 31/10)

Le volet permet désormais de déclarer les dates de début et de fin incluses de son abonnement personnel. Ces dates restent dans `cp_sibra_pass_v1` sur cet appareil, sans numéro de carte, preuve d’identité, achat ou écriture de compte/mission. Les dates réelles ne sont pas déduites du prix annuel de 100 €. Le bouton de retrait efface la déclaration locale et remet immédiatement les portions à leur état antérieur.

Pour les résultats du worker GTFS, `transport-sibra-pass.js` reconnaît exclusivement l’identifiant du jeu SIBRA officiel `5bd9843e634f413220f7f04a` **et** une liste explicite des lignes régulières (1 à 28, 30, 40A/B, 41, 42, 80, 81, 82). Un nom de réseau affiché ou un numéro de ligne commun à un autre réseau ne suffit pas. Les variantes non reconnues et les lignes saisonnières sont laissées inconnues. Le contrôle se fait au jour local Europe/Paris du départ de chaque portion, y compris après minuit et aux changements d’heure, après la prise d’effet du règlement au 01/07/2026.

Les portions reconnues affichent un **coût supplémentaire conditionnel de 0 €**, sous réserve que l’abonnement déclaré soit réellement actif. Si toutes les portions sont incluses, le coût supplémentaire transport de la proposition est indiqué à 0 € sous cette réserve. Sinon, seules les portions incluses sont indiquées et le total reste inconnu. Il ne s’agit pas d’un tarif total vérifié : `priceEUR` et le classement global ne sont pas modifiés, aucune preuve de circulation ou d’accès n’est créée. La source et la date de consultation sont rappelées. Une déclaration locale ne constitue pas une vérification des droits sur la carte Oùra.

Les dates peuvent être modifiées sans relancer ni télécharger les horaires GTFS. La mise à jour ne s’applique pas à une fiche fermée ou remplacée. Les trajets GTFS non concernés restent affichés, avec leurs réserves habituelles.

Les portions **Y21/Y22/Y51/Y62/Y63/272 restent à raccorder** : leur périmètre dépend des arrêts. Leur numéro ne suffit pas à déduire le passage gratuit. Le calcul conditionnel n’est pas encore appliqué aux autres moteurs, ni aux suggestions du chargeur SIBRA quotidien historique. Le raccordement aux résultats GTFS automatiques est le périmètre de ce lot.

Validation locale après intégration avec la stabilisation TripGo/SNCF : **195 tests JavaScript + 2 tests Python réussis**. Test navigateur complet Chromium 156/viewport Pixel 7 réussi, avec un scénario GTFS synthétique identifié SIBRA : saisie/enregistrement/retrait des dates, coût conditionnel visible puis retiré, aucun badge Réalisable, aucun débordement, aucune écriture de mission. Il s’agit d’un test d’intégration du véritable worker avec données synthétiques, pas d’une course SIBRA réelle. Android physique reste non testé. Le script produit `mobile-sibra-pass-applied.png` dans l’artefact navigateur. Les résultats GitHub sont suivis séparément dans la PR.
