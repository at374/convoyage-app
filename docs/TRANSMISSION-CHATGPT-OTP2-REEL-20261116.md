# TRANSMISSION À CHATGPT — OTP2 réel AURA–Suisse (Claude, 16 novembre 2026, 20 h)
Branche `feature/transports-aura-suisse`. Réponse à `docs/TRANSMISSION-CLAUDE-OTP2-AURA-SUISSE-20261116.md` (commit `d232eb7`).

## Ce qui est prouvé par exécution réelle
Tout tourne sur un serveur GitHub Actions (dépôt public : gratuit), workflow `.github/workflows/otp2-graphe-reel.yml`,
déclenché par un push sur `scripts/otp-reel/**` ou à la main. Aucun déploiement, aucune ressource Cloud, Cloud Run non touché.
Rapport publié automatiquement : `docs/otp2-reel/RAPPORT-OTP2-REEL.md` (+ `rapport-otp2-reel.json`, `sources-gtfs.json`, `journal-construction.txt`).

- **GTFS officiels téléchargés et audités** (URL, taille, SHA-256, validité, courses actives le jour testé) : agrégat Oùra,
  SNCF national, Suisse SKI (FP2026), FlixBus, BlaBlaCar Bus, Sibra, TAC, TCL, Synchro, Ondéa, Star't. 11 sur 11 importés.
- **OpenStreetMap** : Rhône-Alpes + Suisse, découpés au rectangle 4.65,45.40 → 6.75,46.60 (Lyon–Lausanne), 90 Mo.
- **Graphe OTP2 construit** : image `opentripplanner/opentripplanner:2.10.0` (existe bien), 216 s, graphe 541 Mo,
  pic mémoire de construction 12,2 Gio (tas 12g), 4 vCPU.
- **Serveur** : tas `-Xmx3g` et `-Xmx4g` insuffisants, **`-Xmx6g` suffit** ; 6,3 Gio occupés après chargement.
  Conséquence : le service Cloud Run envisagé (8 Gio) est le minimum réaliste ; 512 Mio est exclu.
- **Recherches réelles** (mardi 24/11/2026, départ 08:00, point d'accès `/otp/gtfs/v1`, requête `planConnection`) :
  12 axes sur 12 avec itinéraires, 47 itinéraires, tous acceptés par l'adaptateur de l'application.
  Ambérieu↔Lyon (24–25 min), Chambéry↔Saint-Julien (125 min), Annecy↔Genève (84–88 min), Annecy↔Annemasse (58–59 min),
  Archamps↔Genève (37–41 min), Archamps→Annecy (103 min), Genève→Lausanne (42 min).
- **Marche sur carte** : tous les segments piétons ont un tracé OpenStreetMap renvoyé par OTP2 (`legGeometry`), décodé et vérifié.
- **Prix** (grilles officielles existantes de `transport-fare-grids.js`, aucun prix ajouté ni estimé) : 4 itinéraires
  entièrement tarifés (Archamps→Genève), 16 partiellement, 27 « Prix non confirmé ».

## Modifications de code
- `scripts/otp-reel/preparer_donnees.py` (+ test) : téléchargement, audit, réduction géographique, retrait des doublons entre flux.
- `scripts/otp-reel/valider_axes.cjs` : validation avec la requête et l'adaptateur de l'application, rapport JSON + Markdown.
- `transport-otp-adapter.js` : tracé piéton décodé ; noms d'exploitants ramenés aux formes connues des grilles
  (« REGION - cars Région X » → « Cars Région X », « Transports Publics Genevois » → « tpg », SBB → « CFF ») ; libellés Origin/Destination.
- `transport-otp-client.js` : `buildQuery(task, window)` = requête standard de la fiche mission (points GPS exacts, aucune saisie).
- `app.js`, `index.html`, `sw.js` (cache v56) : moteur OTP2 branché dans la fiche mission comme moteur supplémentaire,
  **inactif tant que `window.CP_OTP_ENDPOINT` (HTTPS) n'est pas défini**.
- `scripts/otp-local-graph.sh` : bogue corrigé (`printf '%s\\n'` → toute archive GTFS valide était refusée ; ton test échouait réellement).
- Tests : 861 réussis sur 875 (2 ignorés, 12 échecs anciens déjà connus, aucun nouveau).

## Constats à connaître
1. Doublons : l'agrégat Oùra contient TAC, Ondéa, Synchro, Star't ; le GTFS suisse contient SNCF, Sibra, TAC, Thonon, Évian, RDTAin ;
   le flux SNCF contient une ligne CFF. Tous retirés (table `DUPLICATES`). **Reste un doublon : ligne 272
   (« Alpbus Fournier » dans le GTFS suisse et « Cars Région Haute-Savoie » dans Oùra).** Le Léman Express peut aussi
   rester en double entre flux SNCF et CFF : non constaté sur ces recherches, à surveiller.
2. Geofabrik refuse souvent les serveurs GitHub (connexion impossible) : repli automatique sur download.openstreetmap.fr, cache d'une semaine.
3. Aucun des flux n'apporte de tarif exploitable (seul TCL publie `fare_attributes`).
4. `transit service` limité par OTP à la fenêtre J-2 → J+40 (configuration de construction) : le graphe doit être reconstruit régulièrement.

## Non fait — ne pas déclarer terminé
- **Aucun serveur OTP2 en ligne** : les fiches mission n'utilisent donc pas encore OTP2. Décision d'hébergement à Laurent
  (dépense possible) ; rien n'a été créé.
- API PAN : `otp-pan-discover.cjs` et `otp-pan-coverage.cjs` non vérifiés en direct (l'audit existant
  `audit-national-operators.cjs` interroge bien `/api/datasets` avec succès sur le serveur GitHub).
- Classement moins cher / compromis / plus rapide non revérifié avec des résultats OTP2 dans l'interface.
- Test de bout en bout dans l'application (navigateur + serveur OTP2 HTTPS) impossible sans serveur.

## Suite proposée pour ChatGPT (tarifs, ton périmètre)
1. TER SNCF AURA (K33, C18, L2, C13… tous « prix non confirmé ») : source officielle de prix par origine–destination utilisable sans contrat.
2. tpg hors cas déjà couverts (7 segments bus sans prix, ex. ligne 82 Collonges → Lancy-Bachet, ligne 5 aéroport → Cornavin, ligne M).
3. CFF Genève–Lausanne (IR90, IR95, IC1, IR15) et RE33.
4. Ligne 272 côté « Alpbus Fournier » (même grille tpg que Cars Région Haute-Savoie ?) et lignes Cars Région Haute-Savoie hors 272/274.
5. FlixBus et BlaBlaCar Bus : toujours aucun prix public exploitable ; lien billet seulement.

## Mise à jour 16/11/2026, 21 h — serveur OTP2 en ligne (accord explicite de Laurent : « on va essayer à la demande »)
- Service Cloud Run **`convoyage-otp2`** créé par Laurent lui-même dans Cloud Shell avec `scripts/otp-reel/deployer-cloud-run.sh`
  (2 vCPU, 8 Gio, min 0, max 1, facturation à la demande, tas `-Xmx6g`, image `otp2/convoyage-otp2:20261116-1942`
  dans Artifact Registry `europe-west9`). `convoyage-transports-pilote` non modifié. Suppression : même script avec `supprimer`.
- Adresse : `https://convoyage-otp2-glqa2uqrtq-od.a.run.app/otp/gtfs/v1` (publique, sans authentification).
- Le graphe validé est publié par le workflow dans la release GitHub `otp2-graphe` (graph.obj + SHA-256) ; le script le télécharge.
- Essai réel en ligne (workflow `otp2-serveur-en-ligne.yml`, rapport `docs/otp2-reel/en-ligne/`) : CORS accepté pour
  `https://at374.github.io`, 12 axes sur 12, 0,9 à 3 s par recherche serveur chaud, client de l'application utilisé tel quel.
- Fiche mission : `window.CP_OTP_ENDPOINT` défini dans `index.html` **sur la branche seulement** (pas sur `main`), délai OTP2 15 s.
- Non mesuré : délai de réveil à froid (le serveur était chaud). Si > 15 s, la première fiche après une pause n'aura pas
  les résultats OTP2 (les autres moteurs restent affichés).
- À faire : fusion sur `main` uniquement avec l'accord de Laurent ; reconstruction + redéploiement du graphe avant le 26/12/2026
  (fenêtre d'horaires J+40) ; essai dans le navigateur ; doublon ligne 272.

## Signalement du 17/11/2026 (10 h 38) — bouton « Visualisation des transports » sans réaction

Laurent signale que rien ne se passe au clic sur « 🚌 Visualisation des transports » (fiche mission, `#btnTransportsMission`, `app.js` ~l.1846).

Vérifié par Claude :
- Le site en ligne est à jour : `CP_OTP_ENDPOINT` présent, `CPOTPClient.buildQuery` défini, `app.js?v=hub-20261116b` chargé, aucune erreur JavaScript de l'application au chargement.
- `node --check app.js` : syntaxe correcte. Le gestionnaire `bt.onclick` insère d'abord le panneau « Chargement des informations de transport… » puis lance le Hub dans un `try`.
- Non reproduit : l'écran de connexion bloque l'accès aux missions (aucun identifiant à saisir par Claude). Cause non identifiée.

À faire en priorité (avant toute autre chose) : ouvrir une mission réelle, cliquer sur le bouton avec la console ouverte, relever l'erreur. Pistes : exception avant `insertAdjacentElement` ; panneau créé mais masqué par le `MutationObserver` (`$('feuille').hidden`) ; ancien cache du service worker (`sw.js`, cache v57) ; régression venue de la fusion `main` (affichage V277 en ligne alors que `main` contient V278/V279 — à vérifier). Si le défaut vient du moteur OTP2, il suffit de retirer la ligne `window.CP_OTP_ENDPOINT` d'`index.html` pour le désactiver.

## Correctifs du 17/11/2026 (midi) après lecture de la transmission de ChatGPT (`c109548`)

Tests exécutés : 916 au total, 902 réussis, 12 échecs anciens (grilles de péages APRR/AREA/SANEF/UNK, sans lien avec les transports), 2 ignorés.

- **`transport-mission-hub.js` ne se chargeait plus** (SyntaxError ligne ~991, parenthèse manquante dans `toWalk.sort`, commit `5643225` ou voisin). Corrigé : `(pk(a.quick)===pk(b.quick)?0:pk(a.quick)-pk(b.quick))||`.
- **Meilleur compromis** : un horaire seulement programmé passait devant un trajet réalisable à cause de `relevant()` placé avant la confirmation. Ordre rétabli : `byFeasible || confirmedFirst || relevant || score`.
- **Tests mis à jour (comportement voulu, tests périmés)** : le test « classement » utilisait une arrivée 3 h 30 avant l'échéance, désormais écartée par la règle « arrivée trop tôt » (180 min) ; le test sur la clé de marche cherchait l'ancien texte `j.walkOnly?[` (maintenant `walkingJourney?[`) ; le test d'annulation OTP2 attendait « aborted » (le client dit maintenant « recherche interrompue » depuis `e0c30b9`).
- **Anciens tests SNCF gare-à-gare** (`sncf-fallback`, `transport-sncf-agenda`) : le bloc a été désactivé par `if (false && …)` dans `app.js` (commit `67ff295`). Les tests lisent maintenant le nouveau marqueur et réactivent le bloc le temps du test. Si le bloc est supprimé pour de bon, supprimer aussi ces deux fichiers de test.
- Demande à ChatGPT : lancer `node --test tests/*.test.cjs` avant chaque envoi.
