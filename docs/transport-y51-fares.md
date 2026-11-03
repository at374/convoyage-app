# Références tarifaires Y51 dans l’Agenda — 31 octobre 2026

## Fonctionnement livré

Les propositions GTFS Y51 disposent d’une référence de prix calculée d’après le barème officiel au 01/03/2026 et sa matrice départ/arrivée, avec lien vers la preuve. L’affichage reste distinct de l’abonnement SIBRA déclaré : plein tarif hors abonnement, coût supplémentaire conditionnel d’une portion incluse, et prix inconnu pour une portion non reconnue.

`transport-y51-fares.js` contient les 225 cases de la matrice (15 secteurs), les montants d’un voyage plein tarif et 91 identifiants/coordonnées de quais. Le worker fournit déjà le réseau, la course, les heures et tous les arrêts de la portion. Le moteur vérifie que la preuve correspond exactement à cette portion et que chaque arrêt reste reconnu à 50 m au maximum de sa position épinglée. Il rejette un détour qui sort de l’intervalle tarifaire des extrémités, un arrêt inconnu, une preuve étrangère ou un autre réseau/ligne.

Les secteurs distincts de Doussard (Bredannaz, Bout du Lac, Gare) ne sont pas fusionnés en une seule commune. Chez Daviet est rattaché à Duingt et Thénésol au groupe tarifaire Marthod de la fiche, sans déduire leur zone du seul code communal GTFS. Les correspondances demandent encore une preuve de cumul des titres : les montants des portions ne sont jamais additionnés automatiquement pour annoncer un total.

Exemples du barème unitaire plein tarif : Annecy–Albertville 8,90 € (zone 4), Annecy–Faverges 4,00 € (zone 2), Duingt–Bredannaz 1,70 € (zone 1), Ugine–Albertville 1,40 € (Arlysère). Pour le secteur SIBRA : 2,50 € à bord ou 2,00 € en digital/rechargement, avec support éventuel en supplément. Aucune réduction Déclic, sociale, âge ou abonnement non justifiée n’est appliquée.

## Nature de la preuve

Source primaire : https://annecy.transdev.com/wp-content/uploads/2021/04/AURA-FICHES-TARIFAIRES-2026-Y51_mars-2026.pdf, toujours reliée depuis la page officielle Y51 de Transdev consultée le 31/10/2026. Le document porte bien « tarifs au 1er mars 2026 » et indique qu’ils peuvent changer en cours d’année. La matrice utilise les couleurs de sa propre légende ; les anciens libellés de couleurs de la page web ne sont pas substitués à cette légende.

Les montants sont donc des **références de barème datées**, à revérifier avant achat, pas des prix de réservation garantis ni une confirmation de disponibilité. Aucun `fareValidUntil` n’est inventé, `priceEUR`/les preuves de tarif actuel ne sont pas modifiés, et le classement global « moins cher » ne consomme pas ces références. Le moteur se limite aux voyages de 2026 par prudence d’application ; il ne prétend pas que le barème expire le 31/12/2026. Pour une date hors périmètre ou une correspondance, il conserve l’inconnu plutôt que d’appliquer un prix indu.

Un abonnement SIBRA ne rend pas gratuite une course Albertville–Annecy. Aucun montant SIBRA n’est soustrait du billet régional et aucun cumul à bord n’est supposé. Les éléments de circulation, marche et accès restent inchangés ; aucun badge Réalisable n’est ajouté.

## Extraction reproductible et données réelles

`scripts/extract_y51_tariff_reference.py` est un outil d’audit local sans réseau. Il lit le PDF avec PyMuPDF/Pillow, vérifie sa taille, son titre, la palette des cases, la symétrie de la matrice et plusieurs cellules repères, puis recoupe les 91 quais connus avec l’archive GTFS téléchargée. Un changement de document, couleur, nom ou coordonnées fait échouer l’audit et demande une relecture. Aucun de ces outils Python ne s’exécute dans l’application.

Commande d’audit utilisée :

```sh
python scripts/extract_y51_tariff_reference.py tmp/y51-fares.pdf tmp/y51-fares-fresh.zip tests/fixtures/y51-tariff-reference-2026-10-31.json
```

L’archive officielle Haute-Savoie a été retéléchargée avec demande de revalidation HTTP avant l’essai. `docs/validation-y51-fares-2026-10-31.json` enregistre son empreinte et sa relecture par le véritable worker : le 02/11/2026, trois Y51 directs depuis le quai École Saint-François **direction Annecy** ont une référence de 8,90 €, dont 11 h 48 → 13 h 15, heure de Paris. Le quai est `FR:73011:ZE:58901:HAUTExSAVOIE` ; le quai opposé est à environ 65 m et n’est pas substitué silencieusement. L’essai final part des coordonnées exactes du bon quai, avec rayon de recherche de 50 m.

Ces coordonnées sont publiques ; aucune mission personnelle ni marche depuis l’adresse de livraison n’est testée ici. Les horaires restent théoriques et les dates d’abonnement d’essai fictives. Les données réelles sont séparées des missions et horaires synthétiques du navigateur.

## Validation

- Audit d’extraction réussi : 15 secteurs, 225 cellules, 91 quais, empreintes PDF/GTFS dans la fixture.
- 203 tests JavaScript et 2 tests Python réussis localement ; syntaxe et diff vérifiés. Toutes les cases de la matrice sont contrôlées ; exemples indépendants des zones, sens inverse, dates invalides/hors périmètre, mauvaise course, coordonnées déplacées, détour extérieur, portion inconnue et absence de total de correspondances sont couverts.
- Chromium 156, viewport Pixel 7 : parcours complet Agenda, GTFS worker réel, affichage du barème sur Y51 interne et Albertville–Annecy, dates/source/réserves visibles, abonnement actif ne rendant pas la course extérieure gratuite, aucun débordement horizontal ni erreur non interceptée. Les services et missions du navigateur sont synthétiques. Capture `mobile-y51-full-fare.png` dans l’artefact GitHub.
- GitHub Actions sont vérifiées séparément dans la PR. Android physique non testé ; aucune publication sur téléphone, fusion, activation payante ou modification Supabase/auth/synchronisation.

Restent les prix actuels des autres réseaux, la vérification des cumuls/abonnements et l’utilisation de prix suffisamment comparables pour le classement global. Cette version n’étend pas à elle seule la couverture des itinéraires nationaux.
