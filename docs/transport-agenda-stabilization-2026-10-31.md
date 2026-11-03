# Stabilisation Agenda / TripGo / SNCF — 31 octobre 2026

## État repris et régressions reproduites

La tête distante vérifiée était `895cfe4172dcac7cf590856cc53792c46aae7407`, PR #170 en brouillon. Le contrôle TripGo était en échec. Tous les nouveaux commits distants ont été intégrés par avance rapide, sans réinitialisation. Le travail local SIBRA non terminé a été conservé séparément.

1. **Test TripGo défaillant** : l’essai de livraison tardive demandait 15 h avec une réponse étiquetée comme recherche de 10 h. Le parseur rejetait correctement cette réponse étrangère avant d’exercer le filtrage des départs. La réponse de test porte désormais l’heure de la requête tardive ; les services enregistrés restent inchangés et leur exclusion est effectivement testée. Les fixtures officielles ne sont pas modifiées.
2. **Vraie régression SNCF de l’Aller** : l’ajout distant d’une limite ISO faisait comparer `Date.parse(arrival)` à une chaîne ISO. Le résultat était faux pour tous les trains. La limite est désormais convertie en millisecondes avant le filtrage d’affichage, avec maintien des limites numériques de Jonction. Le test enregistré Annecy–Grenoble et le navigateur reproduisaient l’absence de résultats avant la correction.
3. **Synchronisation du test navigateur** : attendre l’apparition de la mission Grenoble attendue, pas uniquement la première carte rendue. Cela évite de confondre un rendu incomplet avec une mission absente.

## Changements fonctionnels

- Restaure les propositions SNCF compatibles avec la limite de prise en charge diminuée de cinq minutes. Un nouveau test d’interface vérifie l’acceptation de la borne exacte et le rejet à une seconde près ; les limites ISO et numériques sont exercées. Ce filtre de gare à gare ne vérifie pas la marche finale et ne confère aucune faisabilité complète.
- Ajoute aux propositions TripGo un volet des étapes : dates/heures avec secondes, nom des arrêts, cartes de départ et d’arrivée fondées sur les coordonnées des portions, liens piétons Maps. Les liens restent manuels, HTTPS, sans clé privée. Maps effectue un nouveau calcul ; la carte ne certifie ni le tracé TripGo, ni la circulation, ni l’ouverture des accès. Il ne s’agit pas encore d’une carte intégrée affichant la géométrie complète.
- Active les tests SNCF sur les pushs de la branche de travail, pour que cette régression soit contrôlée sans attendre une fusion.
- Préserve les modifications distantes de chronologie, l’indépendance des itinéraires, le bouton bleu clair et les trois sections. Aucun changement Supabase/authentification/synchronisation, Cloud Run ou production.

## Validation

- Local : 190 tests JavaScript et 2 tests Python réussis ; syntaxe et diff vérifiés.
- Navigateur : Chromium 156, viewport Pixel 7 412 × 839, fr-FR, Europe/Paris. Parcours Aller/Jonction/Retour, géocodage tardif, mise à jour, fermeture/annulation, retour SNCF après coordonnées précises, TripGo et observation opérateur rejouée ; ouverture des étapes, liens de cartes et absence de débordement horizontal. Aucun appel d’écriture de compte/mission ni erreur JavaScript non interceptée. Les missions sont fictives et les appels externes simulés, avec véritable worker GTFS et relais HTTP local.
- Les captures et le rapport sont produits par `tests/browser/transport-mobile.cjs` et conservés comme artefact GitHub Actions. Ils ne constituent pas un test de mission réelle.
- Android physique : non testé, aucun appareil/ADB accessible et aucun projet Android natif de construction d’APK trouvé dans ce dépôt. L’application installée ne reçoit pas cette branche tant qu’une publication autorisée n’a pas été effectuée. Aucun déploiement ni fusion effectué.

## Suite

Validation sur téléphone, carte intégrée avec géométrie vérifiée, extension AURA/Genève et tarifs restent à poursuivre. Le travail SIBRA conditionnel local est conservé, sans être mélangé à cette stabilisation prioritaire. Les contrôles GitHub du commit publié sont suivis dans la PR ; les résultats locaux ci-dessus ne les remplacent pas.
