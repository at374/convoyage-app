# TRANSMISSION À CLAUDE — Convoyage Ultra, OTP2 et moteurs AURA–Suisse
Date : 16 novembre 2026. Destinataire : Claude. Dépôt : https://github.com/at374/convoyage-app ; branche : `feature/transports-aura-suisse`.

## Objectif utilisateur NON NÉGOCIABLE
Dans chaque fiche mission, afficher **automatiquement plusieurs itinéraires**, leurs prix vérifiés et visibles, les segments piétons sur carte, les horaires et les correspondances ; classement moins cher / plus rapide / compromis. **Aucun moteur de recherche à remplir dans la fiche mission.** Seuil marche gratuite < 3 km configurable. Faisabilité uniquement si arrivée à l'adresse GPS exacte avec marge ; ne jamais inventer un prix, un trajet, une disponibilité ou une réservation. Aucun bateau. Réseaux AURA, Suisse frontalière (Genève, Lausanne au maximum), SNCF/TER (réservation au moins 1 mois), BlaBlaCar Bus/covoiturage, FlixBus, Cars Région, Sibra, TAC, TPG, TAG, TCL et petits réseaux.

## Travail effectivement poussé sur la branche
Fichiers vérifiés présents via GitHub :
- `transport-otp-adapter.js` : adaptateur de réponses OTP2 `plan.itineraries` et `planConnection.edges[].node` ; contrôles coordonnées, horaires, continuité et modes interdits. Expérimental.
- `transport-otp-client.js` : client GraphQL OTP2 strictement opt-in ; endpoint HTTPS et fetch injecté, aucun serveur activé.
- `scripts/otp-gtfs-audit.cjs` + `tests/otp-gtfs-audit.test.cjs` : audit ZIP hors réseau (SHA256, fichiers GTFS, fuseau, arrêts, bornes calendaires).
- `scripts/otp-pan-discover.cjs` + `tests/otp-pan-discover.test.cjs` : découverte de ressources PAN par mots-clés ; **endpoint `/api/datasets` et forme de réponse non validés en direct**, pagination non gérée.
- `scripts/otp-pan-coverage.cjs` + `tests/otp-pan-coverage.test.cjs` : rapprochement de candidats GTFS avec axes prioritaires et doublons d'URL ; **heuristique textuelle, ne prouve pas une desserte**. Commits `221b821`, `88e4204`.
- `scripts/otp-gtfs-readiness.cjs` + `tests/otp-gtfs-readiness.test.cjs` : contrôle préliminaire de dates et intégrité ; **ne prouve pas la circulation d'un service le jour demandé**. Commits `930d7eb`, `55df412`.
- `scripts/otp-local-graph.sh` + `tests/otp-local-graph.test.sh` : lancement local Docker OTP2 image `opentripplanner/opentripplanner:2.10.0`, 2 CPU, 12 Gio max build/9 Gio Java ; 2 CPU, 8 Gio max serveur/6 Gio Java ; port serveur 127.0.0.1:8080. Contrôles ZIP GTFS/OSM et tests avec faux Docker. Commits `780a3fa`, `75dedb1`, `d8dbab8`, `ef53b75`, `b99399c`, `83c344c`, `29a7274`. **Version/image/CLI et tests non validés par exécution réelle**.
- `scripts/otp-memory-report.cjs` + test : mesure locale RAM/temps via `/usr/bin/time`, Linux uniquement.
- Documentation : `docs/OTP2-GOOGLE-CLOUD-SANS-DEPENSE-20261116.md`, `docs/OTP2-QUALIFICATION-SANS-DEPLOIEMENT-20261116.md`, `docs/OTP2-SOURCES-OFFICIELLES-SUISSE-20261116.md`, `docs/OTP2-SOURCES-OFFICIELLES-AURA-20261116.md`, `docs/OTP2-COUVERTURE-SNCF-FLIXBUS-BLABLACAR-AURA-20261116.md` (commit `57130fc`).
- Tests OTP2 existants : `scripts/otp-smoke.cjs`, `tests/transport-otp-adapter.test.cjs` et autres ; **pas de résultat CI récent vérifié**.

## État véridique au relais
- Les sources GTFS ont été **identifiées dans des catalogues**, mais **aucune archive officielle téléchargée et auditée dans cette série de travaux**.
- Aucun graphe OTP2 AURA–Suisse construit, aucune requête OTP2 réelle sur les quatre axes validée, aucune mesure CPU/RAM réelle.
- Pas de nouveau déploiement Cloud Run ni de dépense autorisée.
- Les modules préparatoires ne signifient PAS que le moteur est raccordé à la fiche mission.
- Les prix commerciaux SNCF/FlixBus/BlaBlaCar ne sont PAS obtenus automatiquement à ce stade. GTFS = horaires, pas billets/prix garantis.

## PRIORITÉS D'EXÉCUTION POUR CLAUDE
1. **Récupérer le HEAD distant** de `feature/transports-aura-suisse` ; comparer avant modification. Préserver les travaux de ChatGPT et les siens, ne pas écraser de commits.
2. Exécuter et réparer les tests existants : `node --test tests/otp-*.test.cjs tests/transport-otp-adapter.test.cjs`, `bash tests/otp-local-graph.test.sh`, `bash -n scripts/otp-local-graph.sh`. Rapporter chiffres et erreurs exactes.
3. Vérifier l'API PAN **sur sa documentation officielle et par vraie requête**, pagination et schéma ; corriger `otp-pan-discover.cjs` si besoin. Ne pas supposer que `GET /api/datasets` renvoie un tableau.
4. Télécharger au moins un GTFS officiel AURA (Sibra en priorité), puis Cars Région, SNCF, TAC, TAG, TCL, FlixBus, BlaBlaCar Bus ; et un GTFS SKI Suisse. Conserver URL officielle, date, licence, SHA256, période de validité ; vérifier les doublons de courses entre agrégat et réseaux individuels.
5. Télécharger un extrait OSM couvrant les trajets prioritaires ; vérifier couverture routable piétonne et licences.
6. Construire **localement** un premier graphe OTP2 sur un sous-ensemble réduit (Annecy + Genève si données disponibles), avec version/image Docker effectivement vérifiée ; mesurer mémoire max, durée et taille de graphe. Étendre AURA–Suisse seulement après succès.
7. Tester de vraies recherches et segments piétons sur : Annecy↔Genève, Ambérieu↔Lyon, Chambéry↔Saint-Julien-en-Genevois, Archamps↔Genève. Pour chaque axe : date/heure, arrêt d'origine et d'arrivée, correspondances, segments à pied, calendrier actif, tarif connu/inconnu. **Ne pas déclarer un axe raccordé avant test réel.**
8. Raccorder OTP2 comme **un moteur supplémentaire** au système de résultats unifiés existant, sans remplacer les autres moteurs. La fiche mission déclenche la recherche depuis les adresses exactes, sans saisie.
9. Poursuivre séparément la recherche de **sources tarifaires utilisables sans compte entreprise**, particulièrement SNCF à 1 mois+, BlaBlaCar Bus/covoiturage, FlixBus ; vérifier contractuellement/techniquement l'accès avant de coder. En cas de tarif non vérifié : `Prix non confirmé` + lien officiel connu ; aucun faux prix.
10. Produire un rapport factuel avec fichiers, commits, tests exécutés, itinéraires réellement obtenus, écarts de couverture, RAM/CPU mesurés, sources de prix, blocages et prochaines actions.

## Contexte Cloud et sécurité
- Projet GCP `convoyage-ultra`, région `europe-west9`.
- Service existant `convoyage-transports-pilote` : **NE PAS MODIFIER** (512 Mio, 1 vCPU, min 0 max 2).
- Limite Cloud Run utilisateur : `Convoyage Ultra - Protection OTP2`, 5 €/mois ; elle peut impacter d'autres services, ne garantit pas zéro dépassement, et ne couvre pas tous les coûts GCP.
- Nouveau service `convoyage-otp2` seulement envisagé : 2 vCPU / 8 Gio, min 0 max 1, **non validé** ; aucun déploiement, activation facturable ou création de ressources sans accord explicite utilisateur.
- Relais OJP Suisse `ojp-relais` déjà documenté côté Supabase, secret créé selon l'utilisateur ; vérifier son fonctionnement réel, ne pas publier de jeton.

## Consigne finale
Ne pas poursuivre une boucle de documentation ou de scripts sans exécution. La prochaine preuve attendue est **GTFS officiel téléchargé + audit réussi + graphe OTP2 construit + première recherche réelle**. Respecter le travail parallèle de Claude/ChatGPT et fournir une transmission réciproque dans `docs/TRANSMISSION-CHATGPT-TRANSPORTS-2026.md` ou un document clairement identifié.
