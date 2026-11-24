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

Le blocage ci-dessus (jeton `OJP_FARE_API_KEY` ne pouvant pas vivre dans le code du téléphone) est levé **avec l'accord explicite de Laurent** pour toucher Supabase sur ce point précis uniquement — aucune autre partie de Supabase (tables, auth, synchronisation des missions) n'a été touchée.

- **Ce qui a été fait** : nouvelle Supabase Edge Function `ojp-relais` (Deno), déployée en production sur le projet `convoyage-pro` (`ozjouxdjhgoprsbefhjq`), via le tableau de bord Supabase (option « Via Editor »). Code source committé : `supabase/functions/ojp-relais/index.ts`. Guide pas à pas : `docs/GUIDE-RELAIS-OJP-SUPABASE.md`.
- **Portée strictement limitée** : la fonction ne fait qu'un relais HTTP vers `https://api.opentransportdata.swiss/ojpfare`, en ajoutant côté serveur l'en-tête `Authorization: Bearer <OJP_FARE_API_KEY>`. Elle ne lit ni n'écrit aucune table Supabase, ne touche pas à l'authentification ni à la synchronisation des missions. Validations avant tout relais : méthode POST uniquement, corps non vide et ≤ 400 000 caractères, corps reconnu comme une requête OJP valide (`OJPLocationInformationRequest`/`OJPTripRequest`/`OJPFareRequest`), sinon 400. Délai de 20 s sur l'appel sortant ; `cache-control: no-store` sur la réponse.
- **Contrôle d'accès** : option « Verify JWT with legacy secret » laissée **activée** (comme la fonction existante `notifier`) **et**, en plus, vérification explicite dans le code de la fonction : la session de l'utilisateur (en-têtes `Authorization`/`apikey` de la requête entrante) est validée par un appel à `{SUPABASE_URL}/auth/v1/user` avant tout relais ; rejet 401 sinon.
- **Tests réels d'accès, faits en direct depuis la console du navigateur sur la fonction déployée** :
  - sans en-têtes → **401**
  - avec la clé anonyme seule (pas de session utilisateur) → **401 « Connexion requise »**
  - avec la clé anonyme + un jeton au mauvais format → **401** (format de JWT invalide)
- **Ce qui bloque encore** : le secret `OJP_FARE_API_KEY` **n'a pas encore été ajouté côté Supabase** (Edge Functions → Secrets) par Laurent — la fonction répond `503 « Relais OJP non configuré »` jusqu'à ce que ce soit fait. Une fois le secret ajouté, reste à : (1) valider un appel réel de bout en bout avec une session utilisateur authentique, (2) câbler `transport-ojp.js::relayPost` dans les fiches mission (`transport-mission-hub.js`) pour afficher automatiquement prix vérifié ou « Prix à consulter » + lien de billetterie — ce câblage n'est pas commencé.
- Trois fichiers JSON non suivis par git ont été trouvés dans `docs/` pendant cette vérification (`audit-grand-geneve-local-stops.json`, `audit-national-aura-axes.json`, `audit-national-aura-transfers.json`, ainsi qu'un quatrième apparu depuis, `audit-tac-saint-julien-archamps.json`) : ce sont des relevés de couverture GTFS statique (correspondances TAC Annemasse autour de Saint-Julien-en-Genevois/Archamps, axes nationaux AURA, candidats de correspondance) — aucun script générateur correspondant n'existe dans l'historique git de la branche, donc leur origine exacte (ChatGPT ou essai local) n'est pas certaine. Contenu sans secret ni donnée sensible. Laissés non committés en l'état ; à réclamer leur paternité avant de les intégrer ou de les supprimer.

### 15/11 21 h — trois réseaux régionaux manquants câblés (demande de Laurent : « raccorder tous les moteurs »)

Laurent a demandé de terminer le raccordement de tous les moteurs. Le sondage PAN du 15/11 (`docs/sources-tarifs/pan-aura-jeux.txt`) avait confirmé trois réseaux urbains hors de l'agrégat Oùra et jamais câblés : **Citéa (Valence Romans Mobilités)**, **STAS (Saint-Étienne Métropole)**, **T2C (Clermont Auvergne Métropole)**.

- **Ajoutés** : `scripts/build_regional_gtfs.py` (nouvelles entrées `FILTERED_MIRROR`), `transport-mission-hub.js` (`localNetworks` : `citea`/`stas`/`t2c`), `TICKET_LINKS` (lien billetterie officiel pour ces trois réseaux si le prix reste inconnu), `transport-coverage.js` (entrées de suivi, état honnête). Tests ajoutés/étendus : `tests/python/test_build_regional_gtfs.py` (forme des entrées MIRROR/FILTERED_MIRROR), `tests/transport-mission-hub.test.cjs` (lien billetterie par opérateur).
- **Citéa** : archive officielle téléchargée et testée réellement depuis ce poste (`static.data.gouv.fr`, atteignable) — 12,2 Mo brut (286 lignes, 17 672 courses), au-dessus du plafond de 12 Mo. Bbox `[44.85,4.80,45.10,5.15]` (Valence/Romans-sur-Isère/Bourg-lès-Valence) testée réellement avec `filter_by_bounds` → 4,56 Mo. **Pas de `fare_attributes.txt`** dans ce flux : tarif restera « Prix à confirmer » + lien billetterie jusqu'à nouvelle source.
- **STAS et T2C** : URLs officielles confirmées par le sondage PAN, mais **ces deux domaines ne sont pas joignables depuis ce poste de développement** (bloqués par le bac à sable, contrairement à `data.gouv.fr`). Bbox câblées sont des **estimations géographiques provisoires du cœur urbain** (Saint-Étienne et Clermont-Ferrand + communes limitrophes immédiates), **non mesurées sur le flux réel**. Elles seront à confirmer/resserrer après le premier passage réel de `build-regional-gtfs.yml` (déclenché automatiquement par la modification du script, puisque GitHub Actions a un accès réseau normal).
- **Pas encore dans `data/gtfs/`** : les trois archives (`citea-valence.zip`, `stas-saint-etienne.zip`, `t2c-clermont.zip`) n'existent pas encore dans le dépôt — elles seront créées par le prochain run de `build-regional-gtfs.yml`. En attendant, ces trois réseaux sont « hors zone » pour toute mission tant que l'archive manque (pas d'erreur silencieuse : `local_*` reste simplement indisponible).
- **Écartés délibérément** (vus dans le même sondage PAN, mais hors périmètre) : **Villefranche-sur-Saône** — déjà couvert par le flux TCL unifié (SYTRAL), pas un réseau à part ; **Pays Voironnais « M covoit' Lignes+ »** — lignes de covoiturage, pas un service à horaires fixes classiques, mal adapté au modèle actuel de recherche GTFS ; **Cluses « Navettes du Giffre »** — flux saisonnier hiver 2023-2024 (déjà expiré), à écarter sauf republication récente confirmée.
- Tests : 794/806 passent après ces changements (les 12 échecs restent les échecs péages préexistants, sans rapport).
- **Toujours pas câblé dans les fiches mission** : l'enrichissement tarifaire OJP Suisse (`transport-ojp.js::relayPost`) — voir section précédente, bloqué par le secret Supabase manquant.

### 15/11 21 h 20 — confirmation réelle : les trois archives sont bonnes

`build-regional-gtfs.yml` s'est déclenché automatiquement (run `43757097623`, succès) et a téléchargé, validé et commité (`eb23735`) les trois archives réelles :
- **Citéa** : 4 576 816 octets, 286 lignes, 17 672 courses, 2 208 arrêts.
- **STAS** : 2 977 417 octets, 53 lignes, 23 461 courses, 1 067 arrêts — la bbox provisoire du cœur urbain (`[45.38,4.32,45.50,4.45]`) **couvrait bien le réseau réel**, pas besoin de l'ajuster.
- **T2C** : 1 404 983 octets, 46 lignes, 5 589 courses, 1 694 arrêts — bbox provisoire (`[45.72,3.00,45.85,3.20]`) **confirmée bonne** également.
- `node scripts/verifier-moteurs-regionaux.cjs` (sur les archives réelles tout juste commitées) : **43 moteurs régionaux, 0 en défaut** (le seul cas connu, Proxim iTi, reste signalé « aucune course » — calendrier vide préexistant, pas un régression). Les trois nouveaux réseaux renvoient chacun 30 trajets réels dans les 7 prochains jours.
- Suite complète (`node --test tests/*.test.cjs`) : 797/809 passent après rebase sur ce commit, les 12 échecs restants sont toujours les péages préexistants.
- Les trois réseaux sont maintenant pleinement opérationnels dans les fiches mission (aucun tarif publié dans ces trois flux → « Prix à confirmer » + lien billetterie officiel).

### 15/11 soir — secret `OJP_FARE_API_KEY` ajouté par Laurent : relais vérifié réel, puis câblé dans les fiches mission

Laurent a confirmé avoir ajouté le secret côté Supabase (Edge Functions → Secrets). Deux étapes faites à la suite :

1. **Vérification de bout en bout avec une session réelle** : Laurent s'est connecté lui-même (jamais de mot de passe saisi par Claude — règle de sécurité) dans un onglet Chrome ouvert sur l'application déployée. Appel réel depuis la console du navigateur, via `window.CPApi` (jeton jamais lu ni journalisé par Claude) : **HTTP 200**, XML OJP réel renvoyé par `api.opentransportdata.swiss` à travers le relais. Le blocage « secret absent » est levé.
2. **Câblage dans les fiches mission** (`transport-mission-hub.js`) :
   - `ojpMode(ptMode)` : vocabulaire PtMode d'OJP → icônes de l'application (bateau exclu, comme les sections bateau de `fromSwiss`).
   - `fromOJP(entries, {origin, destination})` : ne garde que les portions `kind==='timed'` (en véhicule) ; les correspondances (`transfer`/`continuous`) sont retirées, la marche réelle étant recalculée par `completeWalks()`. **Constaté sur une réponse réelle** : OJP ne fournit **aucune coordonnée GPS** pour ses arrêts de correspondance (`LegBoard`/`LegAlight` n'ont que `StopPointRef`/nom/horaires). Seules les positions d'origine/destination de la mission (connues, vérifiées) sont donc posées sur la première/dernière portion ; une correspondance intermédiaire sans GPS bascule honnêtement en « Transport non confirmé » via le pipeline existant (`completeWalks`/`assess`), sans position fabriquée — testé (`tests/transport-ojp-provider.test.cjs`).
   - Tarif : OJP Fare donne un **prix unique pour tout le trajet**, jamais par portion. Pour l'intégrer sans contourner le mécanisme de « titre combiné » de `priceOf()` (pensé pour des tarifs déjà vérifiés par réseau, absents ici) : 0 posé sur chaque portion sauf la dernière, qui porte le prix total — la somme reste exacte, chaque portion reste « vérifiée » au sens de `priceOf()`, rien n'est inventé ni reparti arbitrairement.
   - Opérateur par défaut `'CFF'` quand OJP n'en renvoie aucun (fréquent pour un trajet purement suisse) : évite que `ticketLink()` retombe sur le lien Oùra (portail régional français, sans rapport) pour un trajet suisse.
   - Nouveau fournisseur `P.ojp` dans `makeProviders()` : activé seulement si une session de relais (`opts.ojpSession`) est fournie **et** le trajet touche la zone suisse/Grand Genève **et** les noms de commune (`task.fromCity`/`toCity`) sont connus. Résolution des lieux via `locationRequest`+`parseLocations` (aucune référence fabriquée : un lieu sans type de référence valide désactive simplement le moteur pour ce trajet) puis `tripRequest`+`parseTrips`, puis un `fareRequest`+`parseFare` par trajet trouvé — tout en passant par `relayPost` (le jeton OJP ne quitte jamais le serveur).
   - `app.js` (point d'appel réel des fiches mission, ~ligne 2307) : `ojpSession` construit à partir de la session Supabase déjà chargée par l'application (`api.url`/`api.cle`/`api.session.access_token`), seulement si `api.connecte` — sinon `null`, et le moteur OJP se désactive silencieusement comme tout moteur sans accès (pas d'erreur affichée).
   - **Limite connue, non résolue ici** : `transport-ojp.js::tripRequest` n'a pas de paramètre « arriver avant » distinct — comme pour d'autres moteurs, la fenêtre de recherche utilise le même instant que le départ le plus tôt. Et l'échec HTTP 500 déjà documenté sur une demande de tarif demi-tarif (`EntitlementProduct HTA`) reste ouvert.
   - Tests ajoutés (`tests/transport-ojp-provider.test.cjs`) : vocabulaire `ojpMode`, conversion directe avec tarif complet, répartition 0/montant total sur une correspondance, trajet sans tarif → « Prix à confirmer », portion bateau retirée, correspondance sans GPS → « Transport non confirmé », et le fournisseur `P.ojp` complet (désactivé sans session, désactivé hors zone, trajet réel via relais simulé, relais indisponible, lieu non résolu) — tous avec des réponses OJP fabriquées à la main pour rester déterministes, jamais un appel réseau réel dans le test.
   - Suite complète (`node --test tests/*.test.cjs`) : 810/822 passent, les 12 échecs restants sont les péages préexistants (APRR/AREA/SANEF), sans rapport.

**Reste ouvert côté OJP** : le moteur n'a pas encore été observé sur un vrai trajet mission dans l'application (seul l'appel direct au relais a été vérifié en réel) — à surveiller au prochain diagnostic serveur réel. Le lien `ticketLink()` par défaut CFF n'a pas non plus été revérifié contre une vraie page CFF (juste contre le motif existant dans `TICKET_LINKS`).

### 15/11 22 h 30 — bug critique trouvé et corrigé : `transport-ojp.js` n'était chargé par aucune page

Laurent a transmis une note (relayée depuis un autre agent) signalant exactement le bon doute : « vérifier le chargement dans `index.html` et l'appel réel depuis le hub de mission, ne pas déclarer le raccordement terminé sur la seule présence de `relayPost` ». Vérification faite : **c'était bien le cas**. `transport-mission-hub.js` lisait correctement `r.CPTransportOJP`, mais aucune balise `<script>` ne chargeait `transport-ojp.js` — ni dans `index.html`, ni dans la liste précachée de `sw.js`. Résultat concret : `window.CPTransportOJP` restait `undefined` dans le navigateur, donc `P.ojp` n'était **jamais créé**, quelle que soit la session ou le relais. Corrigé (commit `6fb257b`) :
- `index.html` : ajout de `<script src="transport-ojp.js?v=ojp-20261115a"></script>` avant `transport-mission-hub.js` ; versions de cache de `transport-mission-hub.js` (`…g`) et `app.js` (`…f`) relevées pour refléter le commit précédent.
- `sw.js` : fichier ajouté à la liste précachée, versions alignées, `CACHE` passé en v54 pour forcer le renouvellement chez les utilisateurs déjà installés (PWA).

**Validation réelle de bout en bout faite ensuite**, directement dans un onglet Chrome authentifié (session déjà connectée de Laurent), en chargeant les fichiers réels de la branche (`transport-ojp.js` + `transport-mission-hub.js` tout juste poussés) par-dessus l'application déployée, puis en appelant `providers.ojp.run(task)` sur un trajet réel Genève → Lausanne, suivi de `completeWalks()` + `assess()` + `priceOf()` — exactement le chemin d'une vraie fiche mission :
- **3 trajets réels reçus** via le relais (HTTP 200, vraies données opentransportdata.swiss), tarif **23,80 CHF** (Streckenbillett, 2e classe) confirmé sur chacun.
- **2 des 3 corrects pour la fenêtre demandée → « Réalisable »**, prix vérifié affiché, rien de fabriqué.
- **Le 3e, qui part avant l'heure demandée, correctement rejeté → « Transport non confirmé »** (raison : « départ avant la fin de la mission précédente ») plutôt que faussement accepté.
- Un trajet avec correspondance (3 portions, 2 trains + 1 car) a aussi été vu réellement : prix total correctement posé sur la dernière portion, et la correspondance sans position GPS intermédiaire (Nyon, Gland) a été rejetée avec la raison exacte plutôt que fabriquée — comportement attendu, confirmé en conditions réelles et non plus seulement sur fixtures.
- **Limite confirmée en réel, pas seulement en théorie** : `tripRequest` n'ayant pas de paramètre « arriver après »/« arriver avant » distinct, OJP peut renvoyer un trajet légèrement avant l'instant demandé — sans danger (le trajet est alors rejeté par `assess()`, jamais affiché comme réalisable à tort), mais un peu de bruit en plus sur la fiche mission (un trajet « Transport non confirmé » de plus qu'utile). Piste d'amélioration non faite ici (hors urgence) : filtrer dans `P.ojp.run()` les trajets dont le départ est antérieur à `task.earliestDeparture` avant de les retourner, comme le font déjà les fournisseurs GTFS locaux/nationaux.

**L'onglet de test a été rechargé proprement après la vérification** (retour à la version déployée normale, rien laissé modifié dans le navigateur de Laurent).

## SESSION CLAUDE DU 14/11/2026 (après-midi) — fiches mission et diagnostic réel

Répartition demandée par Laurent : ChatGPT = sources tarifaires, limites d'accès aux prix, contrôles de couverture ; Claude = intégration dans l'application, fiches mission, tests serveur/mobile, performance. **Merci de me signaler avant de modifier `createSession`, `assess`, `rank`, `render` ou `completeWalks` dans `transport-mission-hub.js`.**

### Avant / après (diagnostic serveur réel, 23 axes)

| | 14/11 11:01 UTC | 14/11 14:56 UTC |
|---|---|---|
| Trajets retenus | 1 079 | 956 (détours inutiles écartés) |
| Avec marches calculées | 579 (53,7 %) | 953 (99,7 %) |
| Réalisables | 160 | 166 |
| Horaire programmé (nouveau statut) | — | 542 |
| Prix vérifié | 307 (28,5 %) | 316 (33,1 %) |
| Axes avec réseau absent ou moteur en erreur | 2 | 0 |
| Requêtes piétonnes / échecs | 155 / 0 | 166 / 0 |
| Temps total par axe (moyen / pire) | 7,8 s / 20,2 s | 8,4 s / 18,9 s |
| Premier résultat (moyen) | — | 0,2 s |

### Ce qui a changé (commits `1aa65d3`, `cbe41f4`, `0af0269`)

1. **Quota de marches par couples d'arrêts** (`createSession → add`) : 8 couples de points nouveaux par moteur (+8 si rien de réalisable), au lieu de 8 à 16 trajets. Les départs d'une même ligne partagent leurs marches.
2. **`excessiveDetour(j,task)`** : chemin en véhicule ≥ 3 × la distance directe et ≥ 30 km de plus → écarté, compté dans `discarded`.
3. **Statut à trois niveaux** (`assess`) : `feasible` (« Réalisable ») inchangé ; nouveau `scheduled` (« Horaire programmé — à confirmer le jour J ») quand les seules réserves sont celles de la liste `ADVISORY` (horaire GTFS non confirmé en temps réel, prix commercial et disponibilité non vérifiés, recherche des correspondances incomplète, correspondance programmée non confirmée en temps réel) ; sinon « Transport non confirmé ». Un horaire GTFS n'est toujours **jamais** « Réalisable ». `rank` classe réalisable > programmé > non confirmé.
4. **Correspondances GTFS** (`fromNationalGTFS`) : battement programmé ≥ 10 min (`SAFE_TRANSFER_MIN`) → réserve « correspondance programmée non confirmée en temps réel » ; plus court → « correspondance GTFS non confirmée », bloquant.
5. **Repli national à 6 km réparé** : `transport-national-gtfs-journeys.js` refusait tout rayon > 5 000 m (« Invalid walking search radius ») → FlixBus et BlaBlaCar Bus tombaient en erreur dans le navigateur dès que le repli se déclenchait. Plafond 6 000 m, et un échec du repli ne fait plus perdre les résultats à 3 km.
6. **CI débloquée** : depuis `65b617c`, l'assertion `overnightCalls.length===2` échouait (3 appels avec le repli) et **aucun diagnostic réel ne tournait plus**. Assertions mises à jour (3 appels ; statut programmé ; libellé de correspondance).
7. Budget piéton d'une fiche 60 → 150 requêtes ; axe Bourg-en-Bresse déplacé sur la gare routière officielle.

### Suite (16 h, commits `931e6fd` et suivant) — chemin « horaires aux arrêts » testé en navigateur

- **`transport-gtfs-agenda.js` → `onResults`** reçoit un champ supplémentaire `candidates` (jusqu'à 20 trajets : 10 premiers + 10 répartis) ; `itineraries` (5 affichés) est inchangé. `app.js → renderLocalCards` envoie `candidates` au hub. Raison : pour un « Aller », les 5 affichés sont les plus tardifs et échouaient sur la marge après ajout de la marche finale.
- **Secours d'adresses pour toutes les archives relayées** : `DEFAULT_RESOURCES` est maintenant dérivé de `BASE_RESOURCES` et ajoute à chaque ressource `data/gtfs/*.zip` les copies `raw.githubusercontent.com/…/main/…` puis `…/feature/transports-aura-suisse/…`. Dans `transport-mission-hub.js` (fournisseurs `local_*`) et `index.html` (`CP_NATIONAL_GTFS_RESOURCES`) : secours `main` puis site déployé. (Mise à jour 21 h : plus aucune retouche à faire à la publication — voir « Publication sans retouche » ci-dessous.)
- **M réso relayé** : `data/gtfs/mreso-grenoble.zip` (6,4 Mo, 20 373 courses) et `mreso-gresivaudan.zip` (0,35 Mo) publiés par `build-regional-gtfs.yml` ; le panneau lit la copie relayée d'abord, data.gouv.fr en secours (comme SIBRA).
- Constaté : `main` ne contient ni `data/gtfs/` ni `transport-mission-hub.js` — tout le module vit sur la branche ; aucun test sur le site déployé n'est possible avant publication.

### Suite (16 h 45) — un même train occupait les 20 résultats nationaux

**ChatGPT, j'ai modifié ton moteur `transport-national-gtfs-journeys.js` (fonction `search`) — dis-moi si cela gêne un de tes travaux en cours.** Constat sur la tranche SNCF réelle : Thonon → Genève à 8 h renvoyait 20 lignes pour le seul train de 8 h 00 (une par gare de descente : Eaux-Vives, Champel, Pont-Rouge, Cornavin, Sécheron, puis des correspondances inutiles) ; les trains suivants n'apparaissaient jamais, et la fiche n'avait que 4 trajets utilisables sur 29. Désormais, avant `slice(0,maxResults)` :
- par véhicule de départ (`legs[0].tripId || tripId`, heure, arrêt de montée) : un seul direct, celui dont `egressDistanceMeters` est le plus petit ; une correspondance n'est gardée que si elle rapproche d'au moins 1 km de plus, ou s'il n'y a aucun direct ;
- une correspondance est retirée si un direct part au même moment ou plus tard et arrive au plus tard en même temps.
Résultat hors ligne sur la tranche publiée : Thonon → Genève 6 heures de départ distinctes dans les 9 premiers résultats ; Lyon → Grenoble : directs 7 h 16, 7 h 45, 8 h 16, 8 h 45… Nouveau test `tests/national-journeys-real-slice.test.cjs` (ajouté à la CI). Le format des lignes renvoyées est inchangé.

### Suite (17 h) — fournisseurs `local_*` : tri avant la limite de 30

Deux retouches dans la boucle de sélection des fournisseurs `local_*` (`transport-mission-hub.js`, juste avant `slice(0,30)`) :
- un couple d'arrêts dont (accès + sortie à vol d'oiseau) ≥ distance directe est ignoré **avant** la limite (même règle que `walkDetour`) — sur TCL, les 30 premiers départs tenaient dans la même minute et 24 étaient hors sujet ;
- pour un « Aller » (`w.arriveBy`), on garde les 30 arrivées les plus proches de l'échéance au lieu des 30 premiers départs de la journée.

### Dernier diagnostic réel de la journée (14/11, 15:45 UTC, run sur `68aae0e`)

1 013 trajets sur 23 axes ; **837 exploitables** (164 réalisables + 673 en horaire programmé) ; 972 avec marches calculées (96 %) ; 355 avec prix vérifié (35 %) ; 178 requêtes piétonnes, 0 échec ; aucun moteur en erreur ni réseau attendu absent ; 9 s en moyenne par axe, 24 s au pire. Le diagnostic (`scripts/diagnostic-transports-reel.cjs`) échantillonne maintenant les horaires locaux comme l'application (20 premiers + 20 répartis) au lieu des 40 premiers départs.

### Suite (soir, 20 h 45) — classement et trajets impossibles

- **`rank`** : les trajets exploitables (réalisables **ou** en horaire programmé) passent avant les incomplets, puis le critère (prix, compromis, durée) ; le réalisable ne passe devant le programmé qu'à égalité. Avant, « Plus rapide » pouvait désigner 30 min de marche alors qu'un bus programmé de 12 min existait (Lyon Part-Dieu → Bellecour). Le statut affiché sur la carte ne change pas.
- **`view`** : les trajets dont la seule issue est « départ avant la fin de la mission précédente » ne sont plus affichés (impossibles, pas « non confirmés ») ; `view().hidden.tooEarly` en donne le nombre, repris dans une note de la fiche et dans `hiddenTooEarly` du diagnostic.

Diagnostic réel après ces deux changements (14/11, 19:37 UTC, `04d2081`) : 881 trajets affichés, dont **837 exploitables (95 %)** — 164 réalisables + 673 en horaire programmé ; 132 trajets impossibles masqués ; 840 avec marches calculées ; 254 avec prix vérifié ; 178 requêtes piétonnes, 0 échec ; aucun moteur en erreur ; 9 s en moyenne par axe, 26 s au pire. Lyon Part-Dieu → Bellecour : « Plus rapide » = TCL C13 à 2,10 € (horaire programmé), « Moins cher » = marche.

### Publication sans retouche (21 h)

Quand l'application est servie par le site déployé (`https://…github.io/…`), les fournisseurs `local_*` du hub et `CP_NATIONAL_GTFS_RESOURCES` (`index.html`) lisent d'abord `data/gtfs/` **du site lui-même** — la copie que les tâches hebdomadaires de la branche publiée rafraîchissent —, puis la branche Transports, puis `main` en secours. Hors site déployé (tests, diagnostic serveur), l'ordre est inchangé. Le panneau « horaires aux arrêts » faisait déjà ainsi. À faire à la publication, par Laurent uniquement : fusionner la branche dans `main` ; les tâches `build-sibra-data`, `build-regional-gtfs` et `build-national-gtfs-aura` tourneront alors sur `main` et alimenteront le site.

### `main` fusionnée dans la branche (21 h 15, commit `94dbd6b`)

`main` avait 15 commits d'avance (V278, V279, V299, horaires SNCF/Y51). Ils sont maintenant dans `feature/transports-aura-suisse` ; seul conflit : `sw.js` (liste de fichiers de la branche conservée, cache `v46`). **ChatGPT : fais `git pull` avant ton prochain commit.** La branche contient donc tout `main` : la publication sera une simple avance rapide de `main`, à déclencher par Laurent. Diagnostic réel relancé sur l'état fusionné : vert.

### « Tous les prix sont obligatoires » — recherche des voies légitimes (14/11, 22 h 30)

Laurent exige tous les prix. Vérifié en réel par `sonde-tarifs.yml` (résultat dans `docs/SONDE-TARIFS-TER.md`) :
- **Point d'accès national (transport.data.gouv.fr)** : sur 819 jeux, 6 mentionnent des tarifs (carburants, Rémi, Cap Cotentin, vélos) — **aucun** pour SNCF, FlixBus, BlaBlaCar Bus ni un réseau AURA, malgré l'obligation réglementaire de publication.
- **Export NeTEx SNCF** (31,7 Mo) : aucun cadre tarifaire. **GTFS SNCF** : pas de `fare_attributes.txt`. Tranches FlixBus et BlaBlaCar Bus : idem.
- Conclusion : **aucune donnée ouverte ne donne ces prix** ; ChatGPT, inutile de rechercher à nouveau de ce côté.

Voies restantes, toutes soumises à une demande d'accès par Laurent (aucune n'est activable par code seul) :
1. **BlaBlaCar Bus** : API officielle, clé gratuite sur inscription (bus-api.blablacar.com).
2. **CFF** : service de prix OJP Fare (bêta) d'opentransportdata.swiss, clé gratuite.
3. **FlixBus** : « intégration dynamique » (API officielle) sur demande par courriel à l'équipe distribution, ou programme d'affiliation Awin.
4. **SNCF (TER compris), FlixBus et BlaBlaCar Bus en une seule fois** : API d'un distributeur agréé (ex. Tictactrip, accès sur demande auprès de leur service commercial ; coût inconnu — Laurent décide, aucune dépense sans son accord).

### Décisions de Laurent sur les prix manquants (14/11, 22 h)

Demande : « tous les moteurs donnent des trajets et tous les tarifs apparaissent ». Les moteurs répondent tous (0 erreur au diagnostic réel). Pour les prix, Laurent a tranché :
- **FlixBus** : rester sur des sources officielles. L'adresse publique non documentée du site FlixBus (prix du jour sans clé) **n'est pas utilisée**. FlixBus reste « Prix à confirmer ».
- **BlaBlaCar Bus** et **CFF hors Genève** : Laurent crée les deux clés gratuites (API officielle BlaBlaCar Bus ; service de prix « OJP Fare » d'opentransportdata.swiss). Intégration par Claude dès réception, clés placées en secrets du dépôt (jamais dans le code de l'application).
- **TER** : aucun montant estimé. « Prix à confirmer » tant qu'aucun prix exact n'est accessible (le barème kilométrique des CGV TER AURA ne donne pas le prix d'un billet sans la distance tarifaire officielle).

### Rapport de tests réels et couverture par opérateur (21 h 50)

`docs/RAPPORT-MOTEURS-TRANSPORTS-2026-11-14.md` : statut de chaque moteur, couverture tarifaire par opérateur (portions avec/sans prix officiel au diagnostic réel), résultats par parcours, liste des blocages externes. **ChatGPT : le tableau « Couverture tarifaire par opérateur » te donne l'ordre de priorité des tarifs manquants** (SNCF 435 portions, Cars Région Haute-Savoie 96, FlixBus 57, BlaBlaCar Bus 48, Ondéa 38, Star't 32, Cars Région Isère 24, CFF 24, TPG 20). Tests Y51 réparés (date fixe sortie de la validité de l'export) : il reste 12 échecs, tous péages.

### Note de validation tarifaire de ChatGPT du 14/11 — contrôle côté code (21 h 40)

Les trois règles de la note sont respectées par `fareFor` sur la branche : 271/272/274 (Cars Région Haute-Savoie) → aucun prix ; Ondéa 419 → aucun prix ; Star't 142 et L → prix seulement pour les couples d'arrêts prouvés (`startInterzoneFare`). **Un écart trouvé et corrigé, de mon fait** : le billet unireso zone 10 (3,00 CHF) que j'ai ajouté ce matin se serait appliqué à un car 271/272/274 entre deux arrêts genevois si l'opérateur renvoyé était « TPG ». Ces trois lignes en sont maintenant exclues (`zone10Fare`), avec assertions CI. Le fichier `transport-fare-applicability-guard.cjs` cité dans la note n'existe pas sur la branche.

### Tests : rectification (21 h 30, commit `87a63fc`)

J'avais écrit que les 16 tests en échec étaient tous ceux du module péages : c'était faux pour 4 d'entre eux. Détail exact : 12 péages (grilles APRR/AREA/SANEF, fichiers de travail absents de mon environnement) ; 2 `transport-y51-fares` (données Y51 rafraîchies automatiquement, attentes du test périmées — non corrigé) ; 1 cache hors ligne Android (`transport-national-gtfs-journeys.js` absent de `sw.js` — corrigé) ; 1 inventaire de couverture (champ `tarif` de J'y bus/TAM/TCL en texte libre, **erreur de ma part** — corrigé : seules valeurs admises `vérifiés`, `partiels`, `manquants`). Reste 14 échecs : 12 péages + 2 Y51.

### Test navigateur (Chrome, émulation Pixel 7, vraies archives GTFS, marches simulées car Internet fermé dans le bac à sable)

Fiches rendues sans erreur JavaScript ; J+31 (15/12/2026) : SNCF 20, FlixBus 20, BlaBlaCar Bus 8 trajets sur Lyon → Grenoble ; SNCF 20, FlixBus 10, BlaBlaCar Bus 3 sur Annecy → Genève. Pas de test sur téléphone Android réel (impossible d'ici).

## SESSION CLAUDE DU 14/11/2026 (matin) — détail complet pour ChatGPT

Tout est sur `feature/transports-aura-suisse`, rien sur `main`. Chaque point ci-dessous a été vérifié par un passage réel de `diagnostic-transports.yml` (GitHub Actions, Internet réel), pas seulement hors ligne. Dernier diagnostic réel pris en compte : `docs/diagnostic-serveur.json` du 14/11/2026 10:57 UTC (run `43587627272`).

### Chiffres réels avant / après (diagnostic serveur)

| | 13/11 soir | 14/11 10:57 UTC |
|---|---|---|
| Axes mesurés | 15 | 23 |
| Trajets trouvés | 506 | 1 079 |
| Trajets avec marches calculées | 247 (48,8 %) | 579 (53,7 %) |
| Trajets « réalisables » | 103 | 160 |
| Échecs du routeur piéton | 2 (bloquants) | 0 |

Le pourcentage de trajets tarifés affiché baisse (50,2 % → 28,5 %) uniquement parce que les moteurs nationaux SNCF / FlixBus / BlaBlaCar Bus sont maintenant mesurés (ils ne l'étaient pas) et n'ont pas de prix accessible : 808 portions SNCF, 122 FlixBus, 121 BlaBlaCar Bus sans prix. Ce n'est pas une régression des tarifs locaux.

### 1. Corrections de code (à ne pas refaire)

1. **Tarif GTFS officiel dans les fiches mission** — `transport-mission-hub.js`, nouvelle fonction exportée `attachGTFSFares(feed,rows)`, appelée dans les fournisseurs `local_*` de `makeProviders` et dans `scripts/diagnostic-transports-reel.cjs`. Avant : seul `transport-gtfs-worker.js` attachait `gtfsFare` ; les fiches mission perdaient le prix publié dans le GTFS (TCL : 70 trajets, 0 tarifé). `transport-gtfs-fares.js` est maintenant chargé dans `index.html` (hors worker). Commit `71136c9`.
2. **Filtre des détours inutiles** — `walkDetour(j,task)` dans `transport-mission-hub.js`, appliqué dans `createSession → add()` : un trajet dont (marche d'accès + marche de sortie à vol d'oiseau) ≥ distance directe est écarté avant le quota de marches ; le nombre écarté par moteur est exposé dans `view().discarded`. Rien n'est écarté si les GPS d'arrêt manquent. Commit `70265b1`. **Ne touche pas** au rayon de 3 000 m de tes fournisseurs `local_*` ni à leur limite de 30.
3. **Routeur piéton** — `transport-walking.js`, deux défauts prouvés en réel : (a) le compteur d'échecs était cumulatif sur toute la vie du routeur (2 incidents = plus aucune marche) → désormais échecs consécutifs, remis à zéro à chaque succès ; (b) une réponse HTTP 200 refusée par nos contrôles (ex. point « Bourg-en-Bresse gare » non raccordable à moins de 50 m) comptait comme panne du service → désormais `pairUnavailable` (statut `route_unavailable` pour ce seul couple de points). Pannes réseau, délais et 5xx restent des pannes. Commits `da3a595`, `9c53289`. Effet : 0 marche sur 6 axes → marches calculées partout sauf Bourg-en-Bresse (point de départ à corriger, voir § 4).
4. **SIBRA était en panne depuis le 11/11** — l'archive épinglée `…/20261001-085638/gtfs-sibra.zip` renvoie 404 (SIBRA a publié une nouvelle version le 12/11, validité 12/11 → 27/12/2026). `build-sibra-data.yml` résout maintenant l'archive courante via l'API data.gouv.fr et lit la validité dans le flux ; `data/sibra/sibra-2026-11-14 … 11-20.json` régénérés sur la branche. SIBRA ajouté au relais serveur (`scripts/build_regional_gtfs.py`, entrée `sibra-annecy` avec clé `dataset`) → `data/gtfs/sibra-annecy.zip` ; `transport-gtfs-agenda.js` lit cette copie d'abord, data.gouv.fr en secours. Commits `9351106`, `9c53289`, `a41acc7`. **Non fait (interdit sans accord de Laurent)** : la tâche planifiée tourne sur `main`, où le workflow est toujours cassé ; `sibra-prepare-official.yml` (SHA256 épinglé de l'ancienne archive) et `data/sibra/gtfs-sibra-manifest.json` (validité « jusqu'au 20/12 ») ne sont pas mis à jour.

### 2. Tarifs ajoutés ou confirmés

- **TCL (Lyon)** : 2,10 € (zones 1+2, correspondance 60 min) via les Fares V1 du GTFS officiel relayé ; conforme au guide tarifaire tcl.fr de mai 2026. 73 lignes sur 76 ; F1, F2, 7601 ont deux tarifs officiels dans le flux → volontairement sans prix. Aucune entrée dans `transport-fare-grids.js` (le tarif GTFS passe avant les grilles dans `priceOf`). Réel : 42 trajets tarifés sur 55 sur l'axe `lyon-intra`.
- **unireso Tout Genève (zone 10)** : 3,00 CHF, 60 min, 2e classe prix entier — `zone10Fare(leg)` dans `transport-fare-grids.js` (commit `58624c7`). Sources : unireso.com/titres-de-transport et dépliant unireso « dès le 14 décembre 2025 ». Appliqué seulement si les deux arrêts sont prouvés dans le canton : trains dont les deux gares sont dans `ZONE10_STATIONS` (opérateur SBB/CFF/SNCF) ; bus/tram d'opérateur `TPG` dont les deux noms d'arrêt officiels commencent par une localité de `ZONE10_LOCALITIES`. Tout arrêt français ou inconnu → pas de prix. Validité bornée au 12/12/2026. Réel : Archamps → Genève 14 trajets tarifés sur 18, Saint-Julien → Genève 10 sur 70 (le reste est transfrontalier = Léman Pass, toujours désactivé).
- **J'y bus / TAM** : statuts de `transport-coverage.js` resynchronisés (ils disaient encore « manquants »).

### 3. Diagnostic réel étendu

- `scripts/diagnostic-transports-reel.cjs` injecte maintenant `nationalGTFSResources` (les trois tranches `data/gtfs/national-*-aura.zip`) : tes moteurs nationaux SNCF / BlaBlaCar Bus / FlixBus sont mesurés en réel et fonctionnent (ex. Annecy → Genève : 20 SNCF GTFS, 11 BlaBlaCar Bus, 20 FlixBus).
- 8 axes ajoutés dans `AXES_COUVERTURE` : `lyon-intra`, `geneve-lausanne`, `annemasse-geneve`, `stjulien-geneve`, `archamps-geneve`, `chambery-stjulien`, `annecy-chambery`, `lyon-grenoble`.
- Quota de marches du diagnostic porté à 800 ; `discarded` ajouté par axe.
- Nouveaux tests CI dans `diagnostic-transports.yml` : étape « Vérifier le tarif GTFS officiel embarqué TCL » (archive réelle → `local_tcl.run` → `priceOf`, plus `walkDetour`), et assertions zone 10 dans l'étape des tarifs locaux.

### 4. Constaté en réel, NON corrigé (à trancher / à prendre)

- **Bus locaux jamais « réalisables »** : `fromGTFS` ajoute toujours « horaire GTFS local non confirmé en temps réel » (ton assertion CI « Unconfirmed local GTFS cannot be labelled Réalisable »). Conséquence réelle : Rumilly intra 51 trajets tarifés, 28 marches, 0 réalisable ; Ambérieu intra 76 / 32 / 0. Ces petits réseaux n'ont pas de GTFS-RT : ils ne seront donc jamais réalisables. Décision produit à prendre avec Laurent — je n'y ai pas touché.
- **Bourg-en-Bresse → Ambérieu** : 0 marche, le point de départ `{46.1993, 5.2148}` est refusé par le routeur piéton (itinéraire à plus de 50 m). Coordonnée d'axe à corriger dans `transport-coverage.js`.
- **Lyon → Grenoble** : 0 FlixBus / BlaBlaCar Bus, leurs arrêts lyonnais (Gerland, Perrache) sont à plus de 3 km de Part-Dieu (rayon de `national_*`).
- **Détours longue distance** : BlaBlaCar Bus Annecy → Saint-Étienne → Genève, FlixBus Annecy → Lyon → Genève ressortent comme candidats ; non filtrés (`walkDetour` ne juge que les marches).

### 5. Blocages externes établis (ne pas chercher de nouveau)

- **TER Auvergne-Rhône-Alpes** : le jeu officiel SNCF « Tarifs TER Auvergne-Rhône-Alpes » (prix par origine-destination) a été retiré : `tarifs-ter-aura` et `tarifs-ter-par-od` renvoient 404 sur ressources.data.sncf.com, ainsi que les 4 ressources de la fiche data.gouv.fr `6778b24e2e9a63f76e133b55` (sonde réelle `docs/SONDE-TARIFS-TER.md`, script `scripts/sonde_tarifs_ter.py`). Restent seulement des fourchettes Intercités et TGV INOUI/OUIGO (min/max, jamais un prix exact). Prix exact SNCF = accès distribution commercial.
- **FlixBus** : horaires GTFS officiels en place ; aucun prix dans le flux, pas d'API tarifaire publique.
- **BlaBlaCar Bus** : l'API officielle `bus-api.blablacar.com` (v3) annonce un accès gratuit sur inscription (clé API) et un service de tarifs. **Accès à créer par Laurent** ; rien de codé tant que la clé n'existe pas.
- **Suisse (CFF hors zone 10)** : opentransportdata.swiss publie un service de prix « OJP Fare » (bêta) avec clé gratuite sur inscription. **Accès à créer par Laurent**.
- **TripGo** : inchangé (désactivé par défaut, billets = contrat entreprise).

## Conflit TAM — résolu dans les deux sens, plus de désaccord

Ce matin, un désaccord existait sur la source TAM (`storage.googleapis.com/is-wp-170-prod/.../Livret_TAM_2026.pdf`), jugée invérifiable à l'époque, ce qui m'avait conduit à retirer temporairement le prix TAM et à adapter le test CI pour vérifier son absence.

**Depuis, ChatGPT a réintroduit TAM = 1,10 € avec cette même source (commits `04fd0d0`, `170bf99`, `51515da`), et une recherche indépendante de mon côté a retrouvé le même montant sur une deuxième source, différente et clairement attribuable** : `https://philibert-transport.fr/wp-content/uploads/2017/08/TAM-TARIFS-2026.pdf`, hébergée sur le site de Cars Philibert — l'exploitant réel du réseau TAM, confirmé via `transbus.org/reseaux/01500.html`. J'ai mis à jour la source citée dans `transport-fare-grids.js` pour utiliser ce lien opérateur (plus solide qu'un bucket GCS sans attribution), en gardant le même montant déjà validé par ChatGPT. **TAM = 1,10 € est donc maintenant doublement confirmé. Rien à refaire sur ce point.**

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

Quatre nouveaux flux urbains ont été ajoutés localement au collecteur, au registre des fournisseurs `local_*` et aux tests de trajet réel : Zoom Grand Chalon, MonRéZO Le Creusot–Montceau, Léo Auxerre et Tanéo Nevers. Une seconde sélection officielle à calendriers actifs a également été câblée pour Grand Sénonais (Intercom), Grandole Mobilités, Côte&Bus Beaune et moova Vesoul. Ces huit ajouts sont **en attente de collecte CI et de tests de trajets** ; ils ne sont ni comptés comme raccordés opérationnels ni comme déployés. La carte publique reste donc inchangée jusqu'à une intégration et un déploiement effectifs.

La vérification locale de ce poste ne possède pas les archives ZIP des réseaux récemment ajoutés. Les 10 archives déjà présentes passent encore par le moteur de mission ; l'exécution locale forcée sur l'ensemble des 18 cas échoue uniquement sur les 8 absences de fichiers, ce qui confirme que la garde ne masque pas ces manques. Les tests Python hors ligne du collecteur passent (6/6). Aucun tarif n'est déclaré vérifié dans cette tranche.
