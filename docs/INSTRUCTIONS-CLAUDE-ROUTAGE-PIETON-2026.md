# Instructions à Claude — Convoyage Ultra — routage piéton + tarifs
Date : 13 novembre 2026. Branche unique : `feature/transports-aura-suisse`.

## Synchronisation obligatoire avant toute modification
1. `git fetch origin`, puis `git log -8 --oneline origin/feature/transports-aura-suisse`.
2. Lire `docs/TRANSMISSION-CHATGPT-TRANSPORTS-2026.md` **dans docs/**.
3. Travailler depuis la dernière version distante et éviter toute réécriture concurrente de `transport-fare-grids.js` et `transport-coverage.js`.
4. Les commits ChatGPT suivants ont déjà modifié le routage piéton : `059fcf8964e3711358cd559431559c9461d2b423`, tests `5fe6e0b2a8f87d91b19cc5ee703ba11b0d5fbeb3` et `d1b315eb7a1103c855e4a9ef964eb581c7e8b395`, CI `869f97427377c1cdbc7d210d45123a2c1bf30cc0`. Examiner ces changements, les conserver et corriger leurs éventuels échecs au lieu de les réimplémenter.
5. Ne rien déployer sur Android et ne modifier ni Auth, ni Supabase, ni la synchronisation des missions, ni `main` sans autorisation.

## Objectif fonctionnel : une fiche mission sans recherche manuelle
- Pour **aller, retour et enchaînements**, obtenir automatiquement plusieurs propositions de transport depuis les moteurs existants ; affichage des prix vérifiés, durée, arrivée à l'adresse GPS exacte, marches d'accès et de sortie, correspondances, plan/tracé, statut.
- Classer « moins cher », « meilleur compromis », « plus rapide », avec priorité aux tarifs réellement confirmés ; les offres sans prix doivent rester visibles « Prix à confirmer » mais jamais tarifées artificiellement.
- Marche seule **gratuite** si distance réelle de marche <= seuil configurable (par défaut 3 km) ; vérifier le seuil sur la distance calculée **par le routeur**, pas la distance à vol d'oiseau.
- Marge par défaut **15 minutes avant le rendez-vous** (option spécifique 5 minutes uniquement si point GPS exact et choix autorisé de l'utilisateur).

## Section 5 — routage piéton : travail précis à poursuivre
1. Récupérer systématiquement les coordonnées GPS de l'origine de mission, de la destination et **de chaque arrêt** ; identifier les arrêts par identifiants GTFS / opérateur (pas uniquement le nom).
2. Calculer les marches sur le graphe piéton Valhalla/OpenStreetMap entre :
   - adresse de départ et premier arrêt ;
   - arrêt de descente et arrêt de montée à chaque correspondance ;
   - dernier arrêt et **adresse d'arrivée exacte**.
3. Pour les marches fournies par un moteur, valider leurs extrémités et métriques. Si leur origine ou destination GPS est éloignée de l'adresse de mission, compléter **avec une vraie marche**. Si la donnée est absente ou incertaine, marquer « Transport non confirmé » avec cause explicite. Ne jamais considérer un nom d'arrêt identique comme preuve suffisante d'une correspondance.
4. Inclure le temps réel de marche + **tampon de correspondance minimal 2 min** dans la faisabilité. Ne pas certifier « réalisable » si la marche n'est pas calculée ; préserver l'affichage des propositions incomplètes.
5. Afficher sur la carte la polyline piétonne issue du routeur. Si une géométrie réelle est absente, **ne pas dessiner de ligne droite en la présentant comme un trajet piéton**. Afficher la cause et la source ; distinguer parcours bus/train de parcours piéton.
6. Conserver cache Valhalla déjà en place, avec expiration et déduplication ; limiter appels et éviter les services payants. Attention à l'arrondi des points et à la validité des itinéraires transfrontaliers.
7. Ajouter des tests pour marche initiale, correspondance, marche finale, GPS absent, segment fournisseur incomplet, délai négatif, marche seule <=3 km et dépassement du seuil, cache sans géométrie et réponse routeur incomplète.
8. Faire tourner `node scripts/test-pedestrian-hub.cjs` et les tests existants, puis publier l'état mesuré et le commit. **GitHub Actions doit être vert**, ce qui n'est pas encore confirmé au moment de cette transmission. Corriger tout échec sans désactiver les assertions.

## Recherche tarifs — poursuivre en parallèle, sans données inventées
- **TAM 1,10 €** : confirmé, ne plus rouvrir le désaccord.
- **J'ybus 1,00 €** : intégré par Claude, vérifier que les moteurs identifient son opérateur correctement.
- **Cars Région Isère** : source officielle `https://www.laregionvoustransporte.fr/cars-region/cars-region-de-lisere/infos-et-services-cars-region-de-lisere/titres-et-tarifs-de-lisere/`. Les tarifs à partir du 1er mars 2026 dépendent du **nombre de zones parcourues**, et une **liste des communes par zone** est liée sur cette page. Prochaine tâche : récupérer cette liste et construire une association vérifiée commune/arrêt/zone, avec contrôle des frontières et du trajet effectivement traversé ; ne jamais déduire le prix des seules coordonnées des terminus si la ligne parcourt d'autres zones.
- **TPG zone 10** : tarif officiel 3,00 CHF / 60 min, source `https://www.tpg.ch/fr/tarifs-titres-de-transport`. Ce tarif ne doit s'appliquer qu'à une **portion entièrement attestée zone 10**. Récupérer les données de zone des arrêts (et du trajet), notamment sur les parcours transfrontaliers. L'absence d'identifiant de zone doit conserver « Prix à confirmer ».
- **Léman Pass** : la divergence 4,80/4,90 € est **expliquée par des combinaisons de zones distinctes**, pas nécessairement deux prix contradictoires. Site officiel `https://www.lemanpass.com/points-de-vente/` : zone 10+200 = 4,80 €, zone 10+210 = 4,90 € (plein tarif, 90 min), les deux à 4,60 CHF. **Ne pas réactiver LÉMAN_PASS_ACTIVE avant d'avoir une correspondance explicite itinéraire ↔ zones et des tests transfrontaliers**. Vérifier également les dates de validité des tarifs publiés.
- Cars Région Savoie et petites lignes : tarif par **ligne et éventuellement trajet** selon fiche officielle ; identifier ligne GTFS + course + catégorie tarifaire, sans appliquer de montant uniforme.
- Chercher tous les tarifs officiels manquants (sites d'autorités organisatrices, exploitants, fiches lignes, PDF, délibérations), garder URL exacte, date de vigueur, restrictions, titre, devise, validité et exceptions. Ne pas créer manuellement tous les trajets : exploiter les moteurs et GTFS.

## Livraison demandée
- Un compte rendu factuel : commit(s), fichiers changés, sorties de tests, itinéraires piétons corrigés, évolutions de couverture tarifaire réellement mesurées par `docs/diagnostic-serveur.json`.
- Conserver les parcours incomplets visibles, statut « Transport non confirmé » si faisabilité non prouvée.
- Coordonne-toi avec ChatGPT : **tu prends la suite du routage piéton, et ChatGPT continue l'investigation tarifaire et les sources**, sauf nouveau partage de tâches explicitement convenu.
