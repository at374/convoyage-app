# TRANSMISSION À CLAUDE — OTP2 / Convoyage Ultra — 16 novembre 2026

## Dépôt et branches
- Dépôt : https://github.com/at374/convoyage-app
- Branche de travail ChatGPT : `feature/transport-cards-mobile-20261116`
- PR : https://github.com/at374/convoyage-app/pull/210
- Branche cible transport : `feature/transports-aura-suisse`.
- **Récupérer le HEAD distant, les changements de Claude et la CI avant tout cherry-pick ou fusion.** Ne pas écraser la branche cible.

## Modules créés ou modifiés par ChatGPT
1. `transport-otp-adapter.js` : `CPOTPAdapter.parse(response)`, conversion d'une réponse OTP2 GraphQL (`data.plan.itineraries` ou `plan.itineraries`) vers les journeys/legs du hub. Modes marche, bus, car, train, tram, métro, funiculaire. Bateau exclu. Contrôles GPS, ordre chronologique, continuité des correspondances (seuil provisoire 150 m), données marche valides, valeurs nulles, dates hors plage. Ne fabrique **ni tarif, ni temps réel, ni géométrie piétonne**.
2. `transport-otp-client.js` : `CPOTPClient.search({enabled,endpoint,query,variables,fetch,timeoutMs,signal})`. POST GraphQL HTTPS explicite, opt-in, timeout, refus d'URL avec identifiants, rejet d'erreurs GraphQL, prise en charge AbortSignal. Le client n'a **aucun serveur préconfiguré**, aucune requête par défaut, aucun secret.
3. `transport-mission-hub.js` : fournisseur `P.otp` ajouté dans `makeProviders(root,opts)`, seulement si `root.CPOTPClient.search` existe, `opts.allowOTP===true`, `opts.otpEndpoint` est une chaîne et `opts.otpQuery` est une fonction. `otpQuery(task,queryWindow(task))` doit retourner `{query,variables}`. Résultats envoyés au pipeline de marches, évaluations, tarifs et classement existant. Annulation de mission transmise au client.
4. `scripts/otp-smoke.cjs` : `node scripts/otp-smoke.cjs <reponse-otp.json>`, vérification hors réseau d'une réponse enregistrée. Rapporte itinéraires, modes, marche, sans prétendre valider temps réel ou prix.
5. Tests : `tests/transport-otp-adapter.test.cjs`, `tests/transport-otp-client.test.cjs`, `tests/transport-otp-hub.test.cjs`.
6. Workflow `.github/workflows/test-transport-mobile.yml` : exécute les tests OTP2 avec les tests mobiles.

## État CI vérifié
- Commit `038c654d858df9b775aab14f0e96a8f29ffbf40c` : **5/5 workflows réussis**.
- Commit plus récent `be5be3c70e9e6e42cce6b8e91d83cdd3bda10d57` : à la dernière consultation, **3 réussis et 2 encore en cours**. Revérifier les résultats, en particulier le test d'annulation.

## Points indispensables pour finaliser
1. **Ne pas prétendre OTP2 opérationnel** : aucun serveur OTP2 réel installé, aucun graphe GTFS+OSM AURA/Suisse construit, aucune requête GraphQL réelle validée.
2. Vérifier la version OTP2 choisie, sa **vraie API GraphQL** (schéma, endpoint, variables, champs), puis créer `otpQuery` conforme et des fixtures issues de vraies réponses. Ne pas supposer que le schéma fictif des tests est utilisable tel quel.
3. Préparer une installation **locale ou gratuite**, sans Cloud Run facturable ni activation de service payant sans accord utilisateur. Construire le graphe avec OSM et GTFS officiels AURA/Suisse, documenter licences et fraîcheur.
4. Charger `transport-otp-adapter.js` et `transport-otp-client.js` dans l'application avant le hub ; activer OTP uniquement après vérification de l'endpoint, des quotas, de la confidentialité et des tests.
5. Essais de bout en bout sur **Ambérieu↔Lyon, Chambéry↔Saint-Julien-en-Genevois, Annecy↔Genève/Annemasse, Archamps**, dates réelles, adresses GPS exactes, horaires et marches OSM.
6. Attention : seuil de rupture de 150 m dans l'adaptateur = protection provisoire, pas un routage piéton. Vérifier les correspondances avec Valhalla/OSM ; pas de trajet en ligne droite présenté comme marche réalisable.
7. **OTP2/GTFS ne donne pas les prix commerciaux réservables SNCF, BlaBlaCar, FlixBus.** Les raccorder séparément à des sources autorisées et vérifiées ; sinon prix inconnu et lien officiel, jamais prix inventé.
8. Fiche mission : **aucune recherche manuelle** ; cartes automatiques avec plusieurs itinéraires, prix visible si vérifié, itinéraires piétons et cartes ; classements « moins cher », « compromis », « plus rapide ». Marche gratuite sous 3 km (seuil paramétrable). « Réalisable » seulement avec transports et marges réellement confirmés.
9. Ne pas utiliser TripGo sans accès entreprise (désactivé). Ne pas toucher aux secrets OJP, tables, authentification, synchronisation missions ni lancer de déploiement/achat sans autorisation.

## Commandes de vérification
```bash
node --test tests/transport-otp-adapter.test.cjs tests/transport-otp-client.test.cjs tests/transport-otp-hub.test.cjs
node scripts/otp-smoke.cjs chemin/vers/reponse-reelle-otp.json
```
Le smoke-test nécessite un fichier JSON réel, pas une simple simulation. Le rapport ne confirme ni tarifs ni temps réel.

## Prochain livrable demandé à Claude
Faire un bilan concret : branche et commit fusionnés, état CI, serveur OTP réellement opérationnel ou non, trajets tests réellement trouvés, GPS/marches vérifiés, couverture des tarifs, liens et blocages restants. **Ne pas déclarer AURA/Suisse terminé sans tests de bout en bout.**
