Warning: truncated output (original token count: 21864)
Total output lines: 500

# Transmission à ChatGPT — module Transports AURA + Suisse de Convoyage Ultra

## SESSION CHATGPT DU 24/11/2026 — collecteur national : mémoire bornée et validation réelle

### Consignes Claude récentes relues avant modification

- Branche observée : `feature/transports-aura-suisse`, tête `1af9e40b` (23/11/2026). Les commits récents portent principalement sur l'audit GTFS Isère.
- L'audit officiel Isère a trouvé **135 dates de circulation différentes sur 293** et **5 414 courses-jour ajoutées/modifiées**. Décision documentée : ne pas remplacer automatiquement le GTFS de production avant analyse et validation fonctionnelle. Cette session n'a modifié ni les données Isère, ni les tarifs/zones, ni les moteurs AURA/Suisse.
- Le bilan détaillé des moteurs reste dans les sections historiques ci-dessous ; elles décrivent des mesures antérieures et ne sont pas présentées comme une mesure nationale actuelle.

### Correctif du collecteur

- `scripts/collect-national-gtfs.cjs` traitait les ressources avec deux workers par défaut, puis retenait les octets de toutes les archives validées dans `uploads` jusqu'à la fin de la collecte. Une collecte nationale pouvait donc accumuler plusieurs gros ZIP en RAM.
- Le traitement par défaut est maintenant séquentiel (`concurrency = 1`). Le CLI utilise un callback `onValidatedArchive` pour écrire chaque ZIP sur disque immédiatement après sa validation et ne conserve que les métadonnées. L'API `collect()` conserve son comportement historique par défaut pour ses appelants ; `retainUploads: false` désactive explicitement cette rétention.
- Le workflow national reste volontairement limité à cinq ressources maximum et ne déclenche aucune collecte nationale complète. Aucun service payant ni nouvelle source fournisseur n'a été ajouté.
- `scripts/test_national_gtfs_aura.py` vérifie maintenant le trajet de bout en bout : GTFS de test → extrait AURA produit par le vrai constructeur → recherche avec `transport-national-gtfs-journeys.js`. Il exige les horaires exacts, un service seulement programmé et un prix inconnu explicite.

### Vérifications au 24/11

- `node --test tests/collect-national-gtfs.test.cjs` : **61/61 réussis**, dont le nouveau test de publication immédiate sans ZIP conservé dans `uploads`.
- Suite complète `node --test tests/**/*.test.cjs` : **1 050 réussis, 13 échoués, 2 ignorés sur 1 065**. Les échecs sont hors des fichiers modifiés : assertions de péages (données/fichiers de travail absents ou référentiel local différent) et une assertion de cache hors ligne Android (`transport-gtfs-flex-courses.js?v=20261123`).
- Collecte réelle PAN, échantillon de cinq ressources : **5 téléchargées et validées, 0 erreur, 5 archives écrites**. La lecture initiale a classé Renfe sans service futur à cause d'en-têtes GTFS remplis d'espaces ; le correctif du parseur ci-dessous rétablit ses calendriers.
- L'échantillon comprenait BlaBlaCar Bus (1 590 lignes, 1 590 courses, 661 arrêts), Eurostar (27, 9 916, 173), FlixBus/FlixTrain (1 224, 41 333, 2 072), Trenitalia (31, 482, 16) et Renfe (10, 80, 16). Ces statuts signifient **découvert/téléchargé/validé/calendrier contrôlé uniquement** : cette session n'a pas testé leur raccordement effectif au moteur de recherche ni leurs trajets ou tarifs.
- Vérification réelle du flux complet FlixBus/FlixTrain de 33 378 713 octets : le découpeur AURA existant a produit un extrait valide de 145 415 octets ; le moteur national a retourné **9 candidats Annecy → Genève pour le 10/12/2026**. Aucun tarif GTFS n'était fourni. Ce contrôle valide l'extrait AURA avec le moteur existant ; il ne vérifie pas la marche, la faisabilité complète de mission ou les autres nouveaux flux.
- Le test de construction AURA passe avec la nouvelle assertion d'itinéraire ; les tests Node `national-journeys-real-slice` et `national-stop-fallback` passent **12/12**. L'intégration des autres ressources au moteur et leur couverture de trajets restent à vérifier. Un ZIP valide seul ne prouve pas le raccordement ni la disponibilité d'un trajet.

## Progression nationale en escargot depuis AURA — Bourgogne-Franche-Comté (24/11/2026)

Laurent confirme que les nouveaux trajets vers les pays étrangers sont en pause ; le moteur Suisse déjà terminé reste activé. La progression régionale française commence au nord d'AURA par la Bourgogne-Franche-Comté. Le catalogue régional PAN y référence Mobigo (interurbain) et 15 réseaux urbains ; aucun de ces réseaux n'est assimilé à un trajet opérationnel avant raccordement et test.

- Les 7 flux départementaux Mobigo ouverts ont des ressources officielles distinctes et des calendriers futurs : Jura (39), Nièvre (58), Côte-d'Or (21), Doubs (25), Yonne (89), Haute-Saône (70), Saône-et-Loire (71). Les tailles PAN observées sont entre 50 Ko et 10,96 Mo ; ils n'annoncent pas de tarifs GTFS. Ressources prévues via leurs identifiants data.gouv stables : 84076, 84075, 84078, 84077, 84072, 84074, 84073.
- Le constructeur régional a terminé une collecte CI réelle le 24/11 : **58 flux produits, 0 erreur**, incluant les 7 Mobigo BFC et les 3 premiers réseaux urbains BFC. Toutes les archives ont passé la validation de structure et de calendrier.
- Après correction de la fenêtre de test et de l'assertion de provenance (`provider.name` ajoute « GTFS » au nom réseau présenté dans les étapes), le run **45361795660** a réussi : chacun des 7 flux Mobigo a fourni un trajet actif dans `local_*`. Les archives Mobigo ont été publiées sur la branche dans le commit automatique `1a09f318`. Statut exact : **archives téléchargées, validées, publiées et trajets moteur testés** ; pas de tarif annoncé dans les GTFS, aucun prix ajouté.
- Première tranche urbaine testée : DiviaMobilités/Dijon, Ginko/Besançon et évolitY/Montbéliard sont reliés aux fournisseurs géolocalisés des fiches mission. Le run réel **45362931252** a trouvé des trajets datés actifs sur les 3 archives et vérifié leur retour par `local_divia`, `local_ginko`, `local_evolity` ; le test d'itinéraires compte **10/10 réussis, 0 échec, 0 ignoré**. Les trois archives ont été publiées dans le commit automatique `5bdad7c0`. Statut : **flux validés, raccordés et trajets moteur testés** ; aucun prix n'est certifié par ce test.
- La suite régionale exige maintenant les archives en CI (`REQUIRE_REAL_GTFS=1`) : un réseau absent du lot fera échouer le test au lieu de produire un faux succès avec un test ignoré. En local sans archives urbaines, seuls les tests réels non disponibles restent ignorés.
- L'indexeur GTFS normalise maintenant les espaces de fin des noms de colonnes et des valeurs, correction générique qui reste conservée.
- Renfe a été mis de côté à la demande de Laurent le 24/11/2026; son moteur, sa configuration et son archive AURA sont retirés de cette livraison. Cette décision ne retire pas la normalisation générique des champs GTFS.
- La découpe GTFS AURA exclut maintenant les arrêts italiens « Oulx » du flux Trenitalia et écarte le trajet entier lorsqu'il traverserait ce point, même si le point tombe dans le rectangle géographique AURA. Test synthétique : arrêt italien absent, trajet tronqué écarté. La recherche vers la Suisse reste assurée par le moteur suisse déjà terminé.
- Les nouveaux flux régionaux ne cherchent que des trajets en France ; les liaisons Suisse existantes restent séparées. La prochaine couronne après BFC sera choisie en continuant autour d'AURA, avec contrôle d'emprise et tests de trajet avant de l'afficher.

## BILAN CLAUDE DU 15/11/2026 (22 h) — mission « terminer Transports », réponse à la section 5 de Laurent

Suite à la mission prioritaire de Laurent (« terminer le travail, ça doit marcher les trajets automatiques »), voici le bilan chiffré demandé, structuré exactement selon les 6 points de sa section 5.

### 1. Moteurs réellement fonctionnels

- **51 fournisseurs** au total dans `makeProviders()` : 43 réseaux régionaux `local_*` (GTFS Oùra), 3 nationaux (SNCF, FlixBus, BlaBlaCar Bus), `tripgo` (désactivé, pas de clé), `swiss` (transport.opendata.ch), `ojp` (OJP Suisse), `regional` et `sncf` (fallback).
- **43/43 réseaux régionaux vérifiés en réel** via `scripts/verifier-moteurs-regionaux.cjs` sur des paires d'arrêts et des dates tirées des vrais calendriers GTFS officiels — tous renvoient de vrais trajets, sauf `proximiti` (fenêtre de calendrier vide, anomalie déjà documentée, non bloquante).
- **OJP Suisse** : était du code mort dans le navigateur — `transport-ojp.js` n'était chargé par aucune page (`index.html`, `sw.js`). **Corrigé** (commits `5155602`, `8912482`) et **validé en réel** dans un navigateur authentifié réel (pas une simulation) : 3 trajets Genève ↔ Lausanne obtenus via le relais Supabase et l'API officielle opentransportdata.swiss, tarif réel 23,80 CHF, 2/3 réalisables, 1 correctement écarté pour départ avant la fenêtre demandée. Un filtre de fenêtre temporelle a été ajouté (`fitsWindow`) pour écarter ce cas en amont plutôt que de laisser `assess()` le faire trajet par trajet. **Important** : OJP ne peut pas être exercé par le diagnostic CI automatique (le relais exige une session utilisateur Supabase authentifiée, qu'un job serveur n'a pas) — sa seule validation possible est manuelle, en navigateur réel, comme fait ici.
- **SNCF / FlixBus / BlaBlaCar Bus** : horaires GTFS officiels valides sur plus d'un mois (confirmé par lecture directe de `calendar.txt`/`calendar_dates.txt`), aucun fichier de tarif dans aucune des trois archives — horaires oui, prix commercial confirmé non, pour les trois.

### 2. Pourcentage de trajets avec prix complet

Diagnostic réel serveur du 15/11 21:42 UTC (run CI `43765137918`, départs 2026-11-16T08:00+01:00), **27 axes dont les 8 demandés par Laurent** (Chambéry → Grenoble, absent jusqu'ici, a été ajouté à `transport-coverage.js` et intégré à ce run) :

**1091 trajets, 334 avec prix vérifié (30,6 %), 1050 avec marches calculées (96,2 %), 192 réalisables, 855 en horaire programmé (officiel, marches/correspondances/marge vérifiées, sans confirmation temps réel).**

Détail des 8 axes demandés :

| Axe | Trajets | Prix vérifié | Réalisables | Horaire programmé |
|---|---|---|---|---|
| Annecy → Genève | 59 | 0 | 14 | 45 |
| Genève → Lausanne | 26 | 0 | 8 | 18 |
| Annemasse → Genève | 33 | 29 | 11 | 20 |
| Saint-Julien-en-Genevois → Genève | 45 | 8 | 8 | 37 |
| Archamps → Genève | 9 | 9 | 8 | 1 |
| Ambérieu-en-Bugey → Lyon Part-Dieu | 19 | 0 | 5 | 14 |
| Chambéry → Grenoble | 76 | 0 | 8 | 68 |
| Lyon Part-Dieu → Bellecour | 55 | 42 | 1 | 31 |

Détail complet des 27 axes, exemples d'itinéraires et lignes sans tarif : `docs/DIAGNOSTIC-SERVEUR.md` (généré automatiquement, ne pas modifier à la main).

### 3. Réseaux / tarifs restant à intégrer (travail ChatGPT, périmètre inchangé)

- **Cars Région Isère** : grille zonale officielle confirmée (4,10 € à 12,10 €), mais aucune donnée de zone par arrêt dans le pipeline — impossible d'appliquer un chiffre sans inventer un prix.
- **Cars Région Savoie** : pas de tarif réseau unique, prix par ligne à vérifier au cas par cas (plusieurs lignes touristiques/TAD à tarifs différents).
- **Léman Pass** : grille 10+210/10+230 déjà intégrée (contradiction 4,80/4,90 levée le 15/11, voir section du 15/11 11h ci-dessous) ; reste Archamps (B 82, zone non prouvée) et les trajets internes Genève.
- **TPG transfrontalier** : zone 10 (3,00 CHF) appliquée, mais pas de zone par arrêt pour distinguer un trajet intra-Genève d'un trajet frontalier hors Léman Pass.
- **Star't Thonon** : grille par zone déjà intégrée le 15/11 (1,20 €/2,20 €), à revalider si une grille 2026/2027 plus récente apparaît.
- **SNCF TER** : aucune source de prix exacte en open data (jeu « Tarifs TER AURA » archivé) ; FlixBus/BlaBlaCar Bus : prix dynamiques, pas d'API tarifaire câblée.
- **BlaBlaCar Bus (`bus-api.blablacar.com` v3) et OJP Fare (opentransportdata.swiss)** : accès gratuits sur inscription existent mais nécessitent que **Laurent** crée la clé — aucun service payant ni contrat entreprise, donc rien d'autre à faire côté code tant que la clé n'existe pas.

### 4. Anomalies bloquantes

**Aucune anomalie bloquante ou de sécurité détectée** sur les 8 axes ni plus largement sur les 27. Un point de qualité non bloquant, constaté mais pas corrigé (pour éviter un conflit de fichier avec ChatGPT, signalé plutôt que traité) :

- **`lyon-intra` (TCL)** : sur cet axe, le rayon de recherche de `nearbyDirectTrips` (3 000 m) remonte des lignes sans rapport avec le trajet avant la bonne ligne, épuisant le quota de marches — 0 trajet "réalisable" sur cet axe malgré un tarif GTFS correct. Déjà noté le 14/11, toujours vrai le 15/11.

### 5. Commits et tests exécutés (session du 15/11, soir)

**Commits sur `feature/transports-aura-suisse`** :
- `0e675b5` — câble le moteur OJP Suisse dans les fiches mission (`P.ojp`, `fromOJP`, `ojpMode`)
- `5155602` — charge `transport-ojp.js` dans l'application (`index.html`, `sw.js`) — corrige le bug de code mort
- `8912482` — valide en réel le moteur OJP sur un vrai trajet, filtre les trajets hors fenêtre (`fitsWindow`)
- `b38f9d8` — ajoute l'axe de validation Chambéry → Grenoble manquant
- `13ea18b`, `8bbc092` — diagnostics réels automatiques (bots CI, déclenchés par les commits ci-dessus)

**Tests** :
- `node --test tests/*.test.cjs` : **811/823 passent** ; les 12 échecs sont préexistants et hors périmètre (grilles péage APRR/AREA/SANEF — confirmés identiques avant et après ce travail).
- `tests/transport-ojp-provider.test.cjs` : 14/14 (dont le nouveau test de filtre de fenêtre).
- `tests/transport-coverage.test.cjs` : 5/5.
- `scripts/verifier-moteurs-regionaux.cjs` : 43/43 réseaux régionaux (1 anomalie non bloquante déjà connue : `proximiti`).

### 6. Tâches sans conflit pour ChatGPT

1. Zones par arrêt pour Cars Région Isère (seule donnée manquante pour activer la grille déjà confirmée).
2. Tarifs par ligne pour Cars Région Savoie.
3. Zone Léman Pass d'Archamps (B 82).
4. Création des clés `bus-api.blablacar.com` et OJP Fare (opentransportdata.swiss) — **nécessite l'autorisation explicite de Laurent**, pas une décision ChatGPT ou Claude.
5. Avant toute modification de `transport-fare-grids.js` ou `transport-coverage.js` : `git fetch` + lire les derniers commits (ce soir j'ai ajouté un axe dans `transport-coverage.js`, commit `b38f9d8`).

---

**Date du relevé : 14 novembre 2026, 12 h (section du 14/11 en tête) ; sections suivantes : 13 novembre 2026.** Dépôt : `at374/convoyage-app`, branche `feature/transports-aura-suisse`. Ce document décrit l'état après la session Claude du 13/11/2026, pour éviter de refaire le même travail.

## SESSION CLAUDE DU 15/11/2026 — lignes 272 et 274 tarifées, réseau Cars Région Haute-Savoie

**Demande de Laurent** : la page Région « Cars Région de Haute-Savoie » doit donner des trajets. Constat : la page n'a pas de moteur propre (liste d'horaires PDF + renvoi Oùra) ; l'application lit déjà le flux officiel Oùra de ce réseau (`oura-haute-savoie`). Inventaire du flux (`docs/sources-tarifs/cars74-lignes.txt`) : 272, 274, Y02, Y03, Y04, Y13, Y21, Y22, Y51, Y62, Y63, Y81 à Y86, Y91 à Y94 + navettes Aravis/Balad'Aulps/Éconavette. La 271 n'est pas dans ce flux.

**Tarifs intégrés (`transport-fare-grids.js`)**
- **272** (commit `853ddcd`) : grille officielle tpg 14/12/2025 → 12/12/2026, matrice par couple de communes, vérifiée symétrique. Commune = code INSEE de l'identifiant d'arrêt Oùra, recoupé BAN. Ex. Annecy → Genève 11,30 € (14,50 € avec zone 10), Saint-Julien → Genève 4,80 €. Zone Sibra, même commune, arrêt non recoupé : aucun prix.
- **tpg Saint-Julien ↔ canton de Genève** : Léman Pass multizones 10+230, 4,80 €, 90 min. Collonges/Archamps (B 82) : zone non prouvée, aucun prix.
- **274** (ce commit) : grille Jacquet « Déplacements transfrontaliers » à partir du 14/12/2025. Billet unité Parcours commune française ↔ Genève : Fillinges 4,60 ; Saint-Jeoire/Ville-en-Sallaz/Viuz-en-Sallaz 6,00 ; Bonneville 6,40 ; Taninges/Mieussy 7,50 ; Sallanches 11,40 (avec zone 10 : 4,90 / 6,40 / 8,10 / 8,20 / 14,60). **Non intégré** : Nangy (multizones 10,210 — arrêt Findrol non recoupé BAN), trajets internes France (matrice en couleurs illisible de façon sûre dans `img/jacquet-fr-fr-1.png`), trajets internes Genève.
- **`priceOf`** : un titre combiné officiel (Parcours + zone 10, multizones) est compté une seule fois quand le trajet continue en zone 10 ; la portion genevoise affiche « couvert par le titre combiné ». Conforme à la note de validation (pas d'addition 10 + zone française).

**Diagnostic réel du 15/11 08:27 UTC (run sur `853ddcd`)** : 23 axes, 873 trajets, 0 erreur moteur. Cars Région Haute-Savoie : 48 portions tarifées (272), 48 sans prix = ligne 274 interne Genève (Aéroport → Poste / Mont-Blanc). Portions sans prix restantes : SNCF 429, FlixBus 57, BlaBlaCar Bus 48, Ondéa 38, Star't 32, CFF 24, Cars Isère 24, TPG 5 (B 82).

**Pour ChatGPT** : (1) la 274 dans Genève accepte-t-elle le trafic local au tarif unireso ? (la grille dit seulement « consulter unireso ») ; (2) zone Léman Pass d'Archamps/Collonges (B 82) ; (3) matrice Star't A/AB/B, Ondéa 400–419, zones Cars Isère par arrêt — inchangé.

### Suite du 15/11 (11 h – 13 h) — « tous les moteurs, tous les tarifs »

**Tarifs ajoutés (sources officielles relues, `docs/sources-tarifs/`)**
- **Léman Pass 10+210** réactivé à **4,90 €** (trains Léman Express / RE Annemasse ↔ Genève). La contradiction 4,80/4,90 est levée : `lemanpass.com/points-de-vente` publie 10+210 = 4,90 € et 10+200/230/240/250 = 4,80 € ; TAC et tpg concordent. Les 4,80 € de la grille Jacquet ne concernent que Nangy.
- **Léman Pass 10+230** étendu à **Collonges et Valleiry** (définition officielle de la zone 230 sur `lemanpass.com/tarifs`) : tpg 82 Collonges ↔ Genève = 4,80 €. Archamps : toujours aucun prix.
- **Star't** : tarif par zone de l'arrêt sur tout le réseau (`startZoneFare`). 517 arrêts dont la commune BAN et le `zone_id` du flux officiel concordent avec les listes de communes A/B de star-t.fr (`start-arrets.txt`). 1,20 € dans une zone, 2,20 € A+B. Ligne 271 et lignes scolaires exclues.
- `priceOf` : un titre combiné peut couvrir plusieurs réseaux (Léman Pass 10+210 couvre zone 10 et TAC).

**Diagnostic réel 15/11 10:13 UTC** : trajets avec prix complet 262 → 323 sur 873 (30 % → 37 %). Portions sans prix : SNCF 404, FlixBus 57, BlaBlaCar Bus 48, Cars 74 (274 interne Genève) 48, Ondéa 38, Cars Isère 24, SBB 8, But 8, TPG 5, Star't 1.

**Moteurs ajoutés** : l'agrégat régional Oùra contient 44 réseaux ; l'application n'en lisait que 11. Les 33 autres sont ajoutés (`EXTRACT` de `scripts/build_regional_gtfs.py` + `localNetworks` de `transport-mission-hub.js`) : Rubis Bourg, ÉVA'D Évian, Chamonix Bus, Proxim iTi, Mobi'Vals, TRA Albertville, Duobus, Ruban, L'va, Colibri, TICO, Saônibus, Cars Région Express / Loire / Drôme / Ardèche / Allier / Cantal / Haute-Loire, et les réseaux urbains d'Annonay, Aubenas, Aurillac, Montélimar, Montluçon, Moulins, Privas, Le Puy, Riom, Roanne, Tain-Tournon, Thiers, Vichy, Péage-de-Roussillon. Horaires seulement : **aucun tarif** pour ces réseaux (à chercher — travail ChatGPT). Chemin « fiches mission » uniquement ; le panneau Agenda (`transport-gtfs-agenda.js`, deux réseaux au plus) n'est pas modifié. Trois axes de diagnostic ajoutés : `bourg-intra`, `bonneville-laroche`, `evian-thonon`.

**Vérifié, sans issue** : aucun jeu « Tarifs TER Auvergne-Rhône-Alpes » sur data.gouv (seul « tarifs-intercites » répond pour SNCF) ; Ondéa 400–419 : le titre à bord 1,70 € existe mais sa validité sur les cars de proximité n'est pas écrite.

### Suite du 15/11 (13 h – 15 h) — moteurs, liens d'achat, OJP Suisse

- **Moteurs** : 51 branchés. Contrôle `scripts/verifier-moteurs-regionaux.cjs` (CI + local) : 39 des 40 moteurs régionaux des fiches mission rendent des trajets sur leurs archives réelles ; Proxim iTi est publié avec un calendrier vide (2 dates en 2027).
- **Prix non connu** : pastille 🎟️ par opérateur non tarifé, lien vers le site officiel d'achat (`ticketLink` dans `transport-mission-hub.js`). Aucun prix estimé.
- **OJP Suisse** : il n'existait **aucun moteur OJP** dans la branche (le moteur suisse est transport.opendata.ch). Nouveau module `transport-ojp.js` + `tests/transport-ojp.test.cjs` + essai réel `scripts/essai-ojp-reel.cjs` (workflow `essai-ojp.yml`, résumé `docs/essai-ojp-reel.md`).
  - Type de référence = élément lu dans `OJPLocationInformationResponse` (`StopPlaceRef` / `StopPointRef`), jamais déduit du SLOID ; `siri:StopPointRef`, `ojp:StopPlaceRef` ; absent/ambigu/invalide → aucune requête (« Transport non confirmé »).
  - **Essai réel 15/11 13:50 UTC** : seul le secret `OJP_FARE_API_KEY` existe (`OJP_API_KEY` absent → `/ojp2020` répond 403). L'adresse `/ojpfare` accepte lieux, trajets et prix avec ce jeton. Genève = `StopPlaceRef ch:1:sloid:1008`, Lausanne = `StopPlaceRef ch:1:sloid:1120` ; 3 trajets directs ; prix reçus : Streckenbillett 2e classe **23,80 CHF**, 1re 40,60 CHF, et un Sparbillett 20,20 CHF (dégriffé : exclu).
  - Limites officielles d'OJP Fare : système d'intégration (données hors production), prix non contractuels, Suisse seulement, trajets futurs, pas de prix pour les arrêts étrangers (Léman Express) hors communauté tarifaire.
  - **Non branché dans l'application** : le jeton ne peut pas être embarqué dans le code du téléphone ; il faut décider où il vit (aucun service serveur hors Supabase, interdit de modification).
- **BlaBlaCar Bus** : Laurent signale `bus-api.blablacar.com` inaccessible → pas de clé pour l'instant.

### 15/11 15 h — mission « Intégration OJP Suisse » : test réel sur quatre trajets

Résumé complet : `docs/essai-ojp-reel.md` (test réel, API suisses, 15/11 13:55 UTC). Tests simulés à part : `tests/transport-ojp.test.cjs` (10 tests).
- **Secrets** : `OJP_FARE_API_KEY` présent ; `OJP_1_API_KEY` **absent** (et `OJP_API_KEY` aussi). Tout a répondu par l'adresse `/ojpfare` avec le jeton Fare (lieux, trajets, prix).
- **Aucun module OJP de ChatGPT n'est sur GitHub** : seul `transport-ojp.js` (Claude) existe dans la branche.
- **Genève → Lausanne** : directs IR15/IR90/RE33 ; billet ordinaire 2e classe 23,80 CHF ; sur l'IR15 seule une offre dégriffée 2e classe est renvoyée → « Prix à consulter ».
- **Genève → Nyon** : directs ; billet ordinaire 9,40 CHF (RE33) ; IR15 et IR95 : seulement du dégriffé en 2e → « Prix à consulter ».
- **Genève → Annemasse** (réf. `StopPlaceRef 8774549`, numéro étranger) : RE33 / RL4 directs ; « Léman Pass Einzelbillett Multizonen » 4,60 CHF.
- **Genève → Saint-Julien-en-Genevois** (réf. `StopPlaceRef 8774543`) : train jusqu'à Lancy-Bachet puis bus 80 (opérateurs `ojp:11` → `ojp:881`) ; Léman Pass 4,60 CHF couvrant les portions 1 à 3 (trajet complet).
- **Demi-tarif** : la demande avec `EntitlementProduct HTA` (forme de la documentation) renvoie **HTTP 500** sur les 12 trajets → non validé.
- **Intégration dans les fiches mission : bloquée** par l'emplacement du jeton (ne peut pas être dans le code du téléphone ; pas de serveur hors Supabase). Décision attendue de Laurent.

### 15/11 ~16 h 30 — relais `ojp-relais` déployé sur Supabase (autorisation explicite de Laurent)

Le blocage ci-dessus (jeton `OJP_FARE_API_KEY` ne pouvant pa…9864 tokens truncated…017/08/TAM-TARIFS-2026.pdf`, hébergée sur le site de Cars Philibert — l'exploitant réel du réseau TAM, confirmé via `transbus.org/reseaux/01500.html`. J'ai mis à jour la source citée dans `transport-fare-grids.js` pour utiliser ce lien opérateur (plus solide qu'un bucket GCS sans attribution), en gardant le même montant déjà validé par ChatGPT. **TAM = 1,10 € est donc maintenant doublement confirmé. Rien à refaire sur ce point.**

## Corrections de couverture poussées aujourd'hui

Trois écarts du diagnostic réel ont été corrigés dans `transport-coverage.js` — dans les trois cas c'était l'attente du test qui était fausse, pas le moteur :
- **Rumilly → Annecy** : Sibra dessert la liaison (ligne 42), pas J'y bus (les lignes J4/J5 s'arrêtent avant Annecy, vérifié sur les arrêts GTFS réels et confirmé par recherche officielle des terminus).
- **Voiron → Grenoble** : Cars Région Isère (lignes T40/T41/T50/T51/T55 via Saint-Laurent-du-Pont/Moirans, confirmées sur itinisere.fr), pas M réso Voironnais (réseau local, pas de ligne directe vers Grenoble).
- **Ambérieu-en-Bugey → Lyon** : TER seul. La « ligne 103 » affichée en gare comme « Cars interurbains » n'est pas un car direct jusqu'à Lyon : c'est la navette OùRA Lagnieu ↔ Ambérieu, combinée commercialement avec le TER (« Lagnieu → Ambérieu → Lyon : car + train », confirmé par plusieurs fiches horaires officielles). TCL ne dessert pas Ambérieu (sa propre ligne 103 est une ligne de banlieue ouest de Lyon, sans rapport).

## Couverture tarifaire — recherche approfondie du 13/11 (soir)

- **Cars Région Ain** : tarif réseau **unique** confirmé à **2,20 €** le 1 voyage (comparaison de plusieurs fiches horaires officielles datées : 2 € en 2022, 2,20 € pour la période 25/08/2025-23/08/2026 — même montant sur des lignes différentes à la même date). Intégré dans `transport-fare-grids.js`. **Limite connue** : validité bornée au 23/08/2026, faute de fiche 2026/2027 trouvée — à revérifier si quelqu'un trouve la fiche de la période en cours.
- **Cars Région Isère** : grille zonale officielle confirmée avec URL (carsisere.auvergnerhonealpes.fr), 1 à 6 zones de 4,10 € à 12,10 €. **Non intégrée** : aucune donnée de zone par arrêt dans le pipeline pour savoir combien de zones un trajet traverse. Appliquer un chiffre au hasard de cette grille serait un prix inventé.
- **Cars Région Savoie** : confirmé qu'il n'y a **pas** de tarif réseau unique (contrairement à l'Ain) — plusieurs lignes touristiques/TAD ont des tarifs différents vérifiés sur fiches officielles (S80 3,00 €, S66/S32/S33/S40/S41 12,50 €/8,90 €, S70 8,50 €/6,10 €...). Pas de prix unique possible sans savoir quelle ligne est concernée.
- **TPG (Genève, zone 10)** : confirmé 3,00 CHF (billet 60 min plein tarif) via 3 sources officielles concordantes. **Non intégré** : `transport.opendata.ch` ne donne aucune zone par arrêt, donc impossible de distinguer un trajet intra-Genève d'un trajet transfrontalier (tarif Léman Pass, plus élevé) — risque de prix trop bas, pas juste une lacune.
- **Léman Pass** : toujours désactivé (`LEMAN_PASS_ACTIVE=false` dans `transport-fare-grids.js`) suite à un désaccord apparent entre sources (TAC 4,90 € vs Jacquet 4,80 €). Piste trouvée mais pas vérifiée : ce serait peut-être des zones de départ différentes plutôt qu'une vraie contradiction — à vérifier spécifiquement avant de réactiver, pas en passant.
- **J'y bus (Rumilly)** : **trouvé et intégré** (recherche approfondie du 13/11 soir, suite à l'insistance de l'utilisateur à chercher plus fort). Ticket unité = **1,00 €**, 1 h, tout le réseau, confirmé par trois sources concordantes : le règlement/CGV officiel hébergé sur `jybus.fr` lui-même, la page Wikipédia du réseau (qui précise que ce ticket a été « maintenu à 1 € sur l'ensemble du réseau » lors de la révision tarifaire de janvier 2023), et une délibération Rumilly Terre de Savoie du 03/11/2025 sur le contrat dépositaire de billetterie Oùra, qui atteste d'un dispositif encore actif à cette date. Intégré dans `transport-fare-grids.js`, test CI mis à jour en conséquence.
- **TCL (Lyon)** — confirmé le 14/11, **sans aucun code nouveau** : le flux officiel relayé (`data/gtfs/tcl-lyon.zip`, zone Part-Dieu/Bellecour/Perrache, cf. `filter_by_bounds`) publie lui-même `fare_attributes.txt`/`fare_rules.txt` (Fares V1 SYTRAL), que le mécanisme générique déjà existant `transport-gtfs-fares.js` lit automatiquement. Test direct sur l'archive réellement publiée : routes 31/125/108 → **2,10 €**, correspondance 60 min (fare_id `1_1895382540`) — conforme au guide tarifaire officiel `tcl.fr` « 1 voyage, zones 1+2 » (`TCL_Campagne_Unification_Guide_Tarifaire_Mai2026`). 73 lignes sur 76 du flux filtré renvoient ce prix sans ambiguïté. Les 3 restantes (**F1, F2, 7601**) ont chacune deux tarifs officiels distincts dans le flux (ex. F1/F2 : zones 1+2 à 2,10 € ou toutes zones à 3,60 €, selon le titre réellement utilisé, non déterminable depuis le GTFS seul) → `legFare` renvoie intentionnellement **aucun prix**, comme pour toute ambiguïté dans ce dépôt. **Rien à ajouter dans `transport-fare-grids.js`** : ce serait soit redondant (le tarif GTFS gagne déjà sur une grille statique, cf. `isVerifiedFare`/`priceOf` dans `transport-mission-hub.js`) soit faux pour F1/F2/7601. `transport-coverage.js` mis à jour (les deux structures, `NETWORKS` et le second dictionnaire) pour refléter `tarif` confirmé au lieu de « manquants ». Nouveau test CI ajouté dans `diagnostic-transports.yml` (« Vérifier le tarif GTFS officiel embarqué TCL ») qui rejoue ce test sur l'archive publiée à chaque run.
  - **Note pour l'historique** : `transport-coverage.js` indiquait encore `tarif:'manquants'` pour J'y bus et TAM malgré leur intégration dans `transport-fare-grids.js` la veille — documentation non resynchronisée après coup. Pas corrigé ici (hors périmètre de cette tâche), mais à garder en tête si quelqu'un se fie à ce fichier pour l'état des tarifs plutôt qu'à `transport-fare-grids.js` lui-même.

### Correctif TCL du 14/11 (11 h) — le tarif GTFS n'atteignait pas les fiches mission

L'affirmation ci-dessus « sans aucun code nouveau » était vraie pour le module `transport-gtfs-fares.js` mais **fausse pour le chemin réel des fiches mission**. Le nouvel axe de diagnostic `lyon-intra` (Lyon Part-Dieu → Bellecour, ajouté dans `AXES_COUVERTURE` car TCL, non fédéré, n'était exercé par aucun axe) a donné en réel 70 trajets TCL et **0 tarifé** : seul `transport-gtfs-worker.js` attachait `gtfsFare` aux portions ; les fournisseurs `local_*` de `makeProviders` et le diagnostic serveur ne le faisaient pas. Corrigé par `attachGTFSFares(feed,rows)` dans `transport-mission-hub.js` (commit `71136c9`), `transport-gtfs-fares.js` chargé dans `index.html`. Diagnostic réel suivant (run `43584680912`) : **65 trajets sur 70 tarifés à 2,10 €** sur cet axe ; les 5 restants sont des trains SNCF et la ligne « 1 » (deux tarifs officiels, sans prix voulu). Seul TCL publie des Fares V1 parmi les archives `data/gtfs/`, donc aucun autre réseau ne change de prix.

**Constaté, non corrigé (code des fournisseurs `local_*`, à trancher avec ChatGPT)** : sur cet axe, 0 trajet « réalisable » et 0 marche calculée ; le rayon de 3 000 m de `nearbyDirectTrips` remonte des lignes sans rapport avec le trajet (ex. C14 Pierre Scize → Homme de la Roche, départ = arrivée) avant C9 Part-Dieu → Bellecour, et le quota de marches est épuisé par ces candidats.

## Section 5 (routage piéton) — vérifiée ce soir, déjà faite par ChatGPT, rien à refaire

Suite à `docs/INSTRUCTIONS-CLAUDE-ROUTAGE-PIETON-2026.md`, j'ai relu l'intégralité des commits `059fcf8`, `5fe6e0b`, `d1b315e`, `869f974` plutôt que de réimplémenter. Vérification faite point par point par rapport aux 8 exigences de la section 5 :
- **GPS par arrêt avec identifiant GTFS** (point 1) : déjà en place côté `transport-gtfs-index.js` (`stopInfo`/`nearbyStops` portent `stopId`, `name`, `lat`, `lon` — pas une correspondance par nom seul).
- **Calcul Valhalla/OSM des marches** (point 2) : `transport-walking.js` (pré-existant) interroge le vrai service Valhalla OSM, valide strictement la réponse (mode piéton, pas de ferry, cohérence durée/distance/géométrie, écart aux extrémités ≤ 50 m) et borne à 50 km/24 h.
- **Validation des extrémités de marche fournies par un moteur, pas de correspondance « même nom »** (point 3) : traité par `059fcf8` — `completeWalks` exige maintenant des points GPS réels, un nom d'arrêt identique ne suffit plus.
- **Tampon de correspondance minimal 2 min, pas de « réalisable » sans marche calculée, propositions incomplètes conservées** (point 4) : confirmé dans `059fcf8` et `assess()` (statut « Transport non confirmé » sans filtrer le trajet).
- **Pas de ligne droite présentée comme marche, distinction bus/piéton sur la carte** (point 5) : corrigé dans le SVG par `059fcf8` (plus de fallback `[fromPoint,toPoint]` pour les legs de marche).
- **Cache Valhalla avec expiration/déduplication, limitation d'appels, service gratuit, arrondi des points** (point 6) : déjà en place (`cachedRouter` avec `ttlDays`/`maxEntries`/clé arrondie à 1e-4°, `createRouter` avec quota de requêtes) — le routage piéton OSM n'a pas de restriction de frontière, donc les trajets transfrontaliers Genève sont couverts sans traitement spécial.
- **Tests de régression** (point 7) : `scripts/test-pedestrian-hub.cjs` couvre bien les 8 cas demandés (marche initiale, correspondance, marche finale, GPS absent, segment incomplet, délai négatif implicite via durée nulle, marche seule ≤3 km, cache sans géométrie).
- **CI verte** (point 8) : confirmé directement sur GitHub Actions — runs `43466922758` et `43467297410` tous les deux `completed success` sur `feature/transports-aura-suisse`.

J'ai aussi fait tourner la suite complète (`node --test tests/*.test.cjs`, 743 tests) après rebase sur les tout derniers commits (Ain 2,30 €, zones Isère) : 729 passent, 14 échouent — tous dans le module péages (APRR/AREA/SANEF, hors périmètre Transports) et les 2 Y51 déjà connus comme préexistants. Rien côté piéton ni côté Transports en général.

**Conclusion : la section 5 est fonctionnellement complète et testée. Pas de code à écrire côté piéton — simplement vérifié et confirmé vert.**

## Ce qui reste ouvert

1. **Zones Isère** : ChatGPT a commencé l'intégration (`transport-isere-zonal-fares.js`, commit `25d8f01`, CI encore en cours au moment de ce relevé) — travail en cours côté ChatGPT, je n'y touche pas pour éviter un conflit.
2. **Savoie, Léman Pass, TPG** : toujours documentés mais non intégrés (limite de données réelle, pas un problème de recherche) — ne pas réinventer un chiffre pour forcer l'intégration.
3. Avant toute modification de `transport-fare-grids.js` ou `transport-coverage.js` : `git fetch` + lire les derniers commits, pour éviter un nouveau conflit simultané comme celui du matin.
4. **TCL** : tarifs confirmés (voir ci-dessus), mais reste à vérifier par un diagnostic téléphone réel (ex. Ambérieu → Lyon Part-Dieu) que la bbox Part-Dieu/Bellecour/Perrace est effectivement exercée par une mission utile — au moment du relevé du 13/11, cet axe ne sollicitait pas encore TCL.

Historique complet : commits `2ba2ce6`, `6e6f369`, `54d73ae`, `11775f6`, `8573921`, `201d58e`, `4ad6c97`, `aa5d5c1`, `fc7bd65` sur cette branche.

## Relais diagnostic réel du 23 novembre 2026 — mesures et priorités

Exécution GitHub Actions **45242417560** : **succès**, rapport publié dans `docs/diagnostic-serveur.json` et `docs/COUVERTURE-TARIFS-DIAGNOSTIC.md` (commit automatique `16a4895`). Scénario du **30/11/2026 à 08:00**. Résultat **965 trajets, 379 entièrement tarifés (39,3 %), 64 partiellement tarifés, 93 déclarés faisables**. Attention : les 379 trajets tarifés ne sont **pas** 379 trajets faisables ; l'intersection n'est pas mesurée. Les tarifs manquants restent inconnus et ne doivent pas produire de rentabilité.

Gains constatés depuis le diagnostic précédent : **339 → 379** entièrement tarifés ; Chambéry → Aix-les-Bains **45/65**, Aix-les-Bains gare → Technolac **19/19**. Ces nombres mesurent des options calculées, non des billets commercialement disponibles.

Blocages les plus utiles sur les trajets **partiellement** tarifés : Cars Région Haute-Savoie **48 occurrences** (ligne 274, notamment portions **Aéroport → Poste / Mont-Blanc** internes à Genève), SNCF **11**, But **4**, Cars Région Ain **2**, AFO **1**, Star't **1**, Mobilités M - SNCF **1**. Le tarif transfrontalier de la ligne 274 ne doit pas être appliqué à un déplacement interne à Genève ; le billet zone 10 n'y est pas automatiquement applicable non plus. Ne pas étendre les grilles sans preuve d'acceptation du titre sur cette ligne et cette portion. Le test de non-régression de la ligne 274 est validé (GitHub Actions **45243992363**).

La couverture des lignes Ondéa **102/419** utilise le titre conducteur vérifié à **1,70 €** à partir de juillet 2026, avec conditions de vente propres aux cars scolaires ; vérifier la circulation GTFS à la date demandée. Tests GTFS et mobiles passés. Les rapports tarifaires distinguent désormais prix et faisabilité (commits `5ad8de5e`, `efc6a527`).

## Extension nationale GTFS — Eurostar et Trenitalia (24/11/2026)

La collecte PAN en échantillon a également récupéré les flux publics Eurostar (`integration-storage.dm.eurostar.com`) et Trenitalia France (`thello.axelor.com`). Vérification faite sur les archives téléchargées et extraits AURA générés avec `scripts/build_national_gtfs_aura.py` :

- **Eurostar** : extrait de 4,6 Ko, 4 lignes, 70 courses, 12 arrêts AURA. Le moteur renvoie bien Chambéry-Challes-les-Eaux → Aime-La-Plagne le 19/12/2026, 10:59–12:29. Il s'agit du service saisonnier observé dans ce flux. Aucun tarif GTFS.
- **Trenitalia** : extrait de 7,0 Ko, 18 lignes, 280 courses, 9 arrêts AURA ; 4 courses écartées car leur passage intérieur à la zone traversait une séquence hors AURA. Le moteur renvoie une circulation Lyon-Perrache → Lyon-Part-Dieu le 25/11/2026, 05:08–05:16. La ressource fraîche inspectée avait une couverture de calendrier courte, jusqu'au 27/11 pour ce service : ne pas extrapoler ces horaires à un mois.
- Le moteur de parcours et les fournisseurs de fiches mission acceptent désormais `eurostar` et `trenitalia`. Les liens d'achat redirigent vers les sites officiels ; prix et disponibilité restent inconnus, et les horaires GTFS statiques ne confirment pas l'exploitation réelle.
- Le rafraîchissement de build est programmé quotidiennement (03:43 UTC); l'échec d'un opérateur isolé n'empêche plus la publication des autres flux valides. Le cron GitHub Actions ne s'exécute que si ce workflow a été transféré sur la branche par défaut; sur cette branche de fonctionnalité, la collecte reste déclenchable manuellement jusque-là.
- `tests/national-european-slices.test.cjs` vérifie les deux extraits réels et leur passage par l'indexeur de parcours. Les réseaux sont maintenant découverts, archives validées, extraits AURA validés et trajets statiques testés. Aucun tarif n'est vérifié. Cette intégration concerne seulement les dessertes effectivement conservées dans la bbox AURA, pas une couverture nationale complète.

## Extension BFC en cours — tranche 2 (24/11/2026)

Le branchement strict du collecteur régional exige désormais `REQUIRE_REAL_GTFS=1` en CI : une archive absente fait échouer le job au lieu de transformer la vérification en succès partiel. Le run **45364042006** a terminé avec succès : **58 flux générés, aucune erreur**, et **10 trajets sur 10** proposés par les fournisseurs BFC effectivement testés, zéro test ignoré. Les ZIP et manifestes ont été publiés par le bot dans `a52f50b`.

Quatre nouveaux flux urbains ont été ajoutés au collecteur, au registre des fournisseurs `local_*` et aux tests de trajet réel : Zoom Grand Chalon, MonRéZO Le Creusot–Montceau, Léo Auxerre et Tanéo Nevers. Une seconde sélection officielle à calendriers actifs a également été câblée pour Grand Sénonais (Intercom), Grandole Mobilités, Côte&Bus Beaune et moova Vesoul. Le run **45365298784** confirme les huit ajouts : **66 flux générés, aucune erreur**, et **18/18 trajets** réellement proposés par les fournisseurs (7 Mobigo et 11 urbains, zéro omission). Les archives sont publiées dans `848067c`.

La vérification locale de ce poste ne possède pas les archives ZIP des huit réseaux récemment ajoutés. Les 10 archives déjà présentes passent encore par le moteur de mission ; l'exécution locale sans garde stricte vérifie ces 10 et marque les 8 sans ZIP comme ignorés, tandis que la CI les exige tous. Les tests Python hors ligne du collecteur passent (6/6). Aucun tarif n'est déclaré vérifié dans cette tranche.

Trois réseaux supplémentaires ont été câblés dans le collecteur et les fournisseurs : ça roule Autun, Papillon Cosne-Cours-sur-Loire et ECLA Mobilité Lons-le-Saunier. Le run **45366839957** les a validés avec l'ensemble de la tranche : **69 flux générés, aucune erreur, 21/21 trajets** proposés par les fournisseurs de mission, zéro test ignoré (7 Mobigo et 14 urbains). Les archives, dont ces trois ZIP, sont publiées par le bot dans `5e22f05`. Provenance, éditeur et licence sont consignés dans le manifeste. Ces résultats établissent la présence d'horaires statiques indexables dans les fournisseurs, pas une confirmation temps réel, une faisabilité d'adresse à adresse ou un tarif vérifié.

Le jeu Autun est annoncé valable du 01/09/2025 au 31/08/2028 sous ODbL avec conditions particulières PAN ; Papillon jusqu'au 31/12/2026 sous Licence Ouverte 2.0, avec GTFS-RT publié mais pas encore raccordé ; ECLA jusqu'au 31/07/2029 sous Licence Ouverte 2.0. Optymo est maintenant découvert, téléchargé et validé dans l'archive `data/gtfs/optymo-belfort.zip`, mais reste hors moteur : son GTFS mêle offres urbaines, suburbaines et scolaires et impose une coordination conducteur pour chaque montée et descente. Le catalogue PAN BFC recense 15 réseaux urbains ; 14 ont un trajet candidat testé par le fournisseur, Optymo restant le réseau découvert mais non raccordé. La carte publique de déploiement n'est pas modifiée, car cette branche n'est pas le déploiement public.

Le diagnostic général **45366839791** a échoué uniquement à l'étape d'audit des archives régionales : il a tourné sur le commit `3751edf` avant que l'exécution régionale n'ait pu publier les ZIP manquants. Le run régional qui suit a validé les 21 routes candidates et publié les archives dans `5e22f05`. Le diagnostic général n'a pas été rejoué depuis cette publication ; ne pas considérer cet échec d'audit comme un test de trajet raté après publication.

## Optymo — audit d'accès GTFS (24/11/2026)

Le run régional **45369503434** (commit d'entrée `a72b2ef0`, résultat publié par le bot dans `f11a4f0c`) a réussi : l'archive Optymo officielle de 2 670 087 octets a été collectée, ses calendriers et tables sont valides, et les 21 fournisseurs BFC déjà raccordés ont tous encore proposé un trajet réel (7 Mobigo + 14 urbains). Ce résultat valide le téléchargement d'Optymo, pas son raccordement au moteur.

Inspection de l'archive collectée : 50 lignes, 6 846 courses, 1 024 arrêts annoncés par PAN, deux agences (`OPTYMO urbain` et `OPTYMO suburbain`) et 165 089 lignes horaires. **Les 165 089 horaires portent tous `pickup_type=3` et `drop_off_type=3`** ; ce sont les valeurs brutes confirmées par le ZIP, sans modification. La référence GTFS indique que `3` demande une coordination avec le conducteur pour organiser la montée ou la descente. L'indexeur écarte ces horaires comme accès régulier ; les inclure sans preuve de coordination créerait des trajets non confirmés. Le fichier ne contient pas de grille tarifaire GTFS.

Le contrôle `tests/optymo-gtfs-access.test.cjs` est lancé dans le workflow après la collecte réelle : il échoue si les marqueurs de montée/descente changent, afin qu'une correction de la source déclenche un nouvel audit, et vérifie que `makeProviders` ne publie pas Optymo tant que les courses restent soumises à coordination. Le réseau est donc actuellement au statut **découvert → téléchargé → GTFS validé**, pas **raccordé** ni **trajet testé**. Prochaine action : réexaminer le flux lors de chaque actualisation ; s'il garde les marqueurs, rechercher une offre horaire officiellement exploitable avec règles d'accès compatibles.


## Validation locale BFC avec échéance — 24 novembre 2026

Après récupération de ff6e9a7, les 21 archives BFC passent le test strict des fournisseurs de mission, sans omission (21/21, 27,6 s). Le test inclut désormais un appel « arriver avant » et le contrôle de l'heure d'arrivée de chaque résultat. Le test Optymo passe aussi (1/1) et maintient son exclusion tant que les accès demandent une coordination conducteur. Ces résultats sont des parcours GTFS statiques proposés par les fournisseurs, sans validation Android, temps réel ou prix. Test publié dans bc66eac.

## Grand Est — préparation de la couronne suivante (24/11/2026)

Le PAN répertorie un flux GTFS interurbain Fluo Grand Est gratuit en Licence Ouverte 2.0, valide selon sa fiche du 28/09/2026 au 29/08/2027. La ressource indique 2 165 lignes, 10 226 arrêts et ne publie aucun tarif GTFS. Le fichier source de 41,91 Mo contient plusieurs délégations/agences départementales et relève de la Région Grand Est. Source : ressource PAN `83635`.

Le run régional **45374933127** a réussi sur le commit `0175f1a5` : **71 archives produites, aucune erreur**. Le flux Fluo brut (41,91 Mo) a été découpé et publié par le bot dans le commit `2887db41` sous `data/gtfs/fluo-grand-est.zip` (2 090 480 octets, SHA-256 `b459c9e444f2d06d8215e1991410e1482647be350c210778f6c17d68cd2d3143`). L'extrait contient 2 162 lignes, 11 977 courses, 19 081 arrêts (parents de stations inclus) et aucune grille tarifaire. Le filtre géographique conserve les courses avec au moins deux arrêts dans la boîte de la région ; il ne prouve pas une couverture exacte des frontières administratives.

L'indexeur GTFS a fourni un candidat à horaire actif pour le 24/11/2026 : ligne 8912, Chavannes-sur-l'Étang – École Cousteau → Montreux-Vieux – Temple, 08:10–08:20. `tests/fluo-grand-est-real-feed.test.cjs` reproduit ce contrôle sur l'archive réelle des sept jours à venir et est désormais exécuté en CI après chaque collecte. **Statut : source découverte, GTFS téléchargé et validé, candidat indexeur testé ; pas de fournisseur `local_*`, pas de trajet proposé par le moteur de mission, pas de tarif vérifié.**

La sélection actuelle repose sur une boîte géographique et peut contenir des arrêts transfrontaliers. Avant tout raccordement, le moteur devra appliquer le périmètre demandé par Laurent — trajets en France uniquement, Suisse restant gérée par son moteur existant — puis un test réel devra prouver qu'un parcours local est proposé. Le grand agrégat urbain/interurbain PAN `83634` contient aussi tramways et TER mais ne fait pas partie de cette première tranche ; il faudra éviter de compter deux fois les cars Fluo lorsque cette source sera auditée. La carte de déploiement reste inchangée : ce flux n'est pas encore raccordé au moteur et la branche feature n'est pas publiée sur le site.
