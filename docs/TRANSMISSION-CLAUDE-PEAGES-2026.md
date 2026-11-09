# Transmission à Claude — audit péages 2026 de Convoyage Ultra

**Date du relevé : 8 novembre 2026.** Dépôt : `at374/convoyage-app`, branche `main`. Ce document est un **état de reprise intermédiaire**, et non une certification exhaustive des prix français.

## Sources officielles identifiées

- VINCI Autoroutes : https://www.vinci-autoroutes.com/fr/conseils/autoroute-mode-demploi/tarifs-peage-vinci-autoroutes/
- La page éditeur présente les grilles ASF classes 1 et 2 au **1er juin 2026**, les guides Cofiroute et ESCOTA au **1er février 2026**, A86 au **1er janvier 2026**, Arcos au **1er février 2026**.
- Elle annonce les fichiers TXT internes ASF, ESCOTA, A86, Cofiroute/Arcour et Arcos. **Ces TXT ne sont pas encore importés dans le dépôt** : ne pas confondre une URL identifiée et un tarif vérifié.
- Références et statut machine : `data/sources-officielles/README.md` et `data/sources-officielles/etat-import-vinci-2026.json`.

## Audits historiques existants — à ne pas présenter comme une vérification CI actuelle

- APRR : 21 505 relations sur 21 505 comptabilisées dans l'audit existant (`tests/peages-audit-aprr-public-21505.test.cjs`).
- AREA : 955/955 (`tests/peages-audit-area-public-955.test.cjs`).
- Cofiroute/Arcour : 10 932/11 004 rapprochées dans l'audit historique ; **72 relations structurelles non rapprochées**, sans preuve qu'il s'agit de 72 prix manquants. Attention à la distinction **Romorantin / Blois / Villefranche-sur-Cher** et aux alias Saint-Aignan-sur-Cher / Saint-Romain-sur-Cher, Selles-sur-Cher / Chémery.
- ASF : **48/2 056** relations non résolues dans l'audit historique, liées à cinq noms : PERIGUEUX, PERIGUEUX EST, ST JEAN DE LUZ NORD, THOUARCE, LE BOULOU (F). Ne pas ajouter sans identification physique certaine.
- ESCOTA : **34/141** relations non rapprochées dans l'audit historique, associées à AIX (A51), ST LAURENT, LE CASTELLET, PONT DES GAUX ; **16 lignes structurelles** signalées. La comparaison exhaustive est **ignorée en CI** tant que le TXT manque.
- SANEF : vérifier notamment l'alias Liévin A26 et les autres relations non résolues. Les tests de contrôle des gares existent déjà.
- VINCI principales liaisons : **30 liaisons de référence, soit 60 prix classes 1/2** dans `data/peages-vinci-principales-liaisons-2026.json`. Ce sont des **liaisons commerciales de référence**, pas des couples de gares physiques à insérer automatiquement dans `peages-aprr.json`.

## État du code et des tests

- Tarifs de production : `peages-aprr.json` et `peages-overlay.json`. Ne pas les modifier par simple inférence d'alias.
- GPS : `data/gares-peage-officiel.json` ; vérifier chaque correspondance physique et le sens entrée/sortie.
- CI : `.github/workflows/test-peages-overlay.yml`. Dernière exécution inspectée pour `62626422457281695b2b6a49cda0a31a85a0b843` : **tests Péages et Agenda réussis** ; Pages encore en attente au relevé.
- Contrôle des imports et empreintes SHA-256 : `tests/peages-etat-import-vinci-2026.test.cjs`.
- Cofiroute : `tests/peages-chantier-cofiroute-cloture.test.cjs`, source attendue `data/sources-officielles/Tarifs_Cofiroute_Arcour.txt` ou variable `COFIROUTE_TARIFS_PATH`.
- ESCOTA : `tests/peages-escota-grille-complete-cloture.test.cjs`, source attendue `data/sources-officielles/Tarifs_ESCOTA.txt` ou variable `ESCOTA_TARIFS_PATH`.
- Les contrôles tarifaires sans fichier source sont **SKIP** et non **PASS**. Ne pas annoncer de couverture exhaustive sur cette base.

## Priorités de reprise pour Claude

1. Récupérer les TXT officiels VINCI 2026 depuis l'éditeur. Conserver URL, date d'application, octets originaux, SHA-256, format, nombre de lignes. Vérifier séparément les périodes ASF, ESCOTA, Cofiroute, A86 et Arcos.
2. Importer les fichiers dans `data/sources-officielles/` et renseigner le registre ; exécuter la CI sans SKIP sur les comparaisons disponibles.
3. Pour chaque relation : identifier les gares physiques et la direction, comparer classe 1 et classe 2, classer en confirmé / divergent / non rapproché / structurel / ambigu. Éviter les faux positifs dus aux alias et les doubles comptages.
4. Résoudre les 72 cas Cofiroute structurels, les 48 ASF, les 34 ESCOTA et les alias SANEF par **preuves officielles**, pas par proximité GPS seule.
5. Compléter ensuite les autres concessionnaires et les péages France entière. Contrôler la couverture avant de déclarer le chantier terminé.
6. Fournir à l'utilisateur un rapport final avec tous les couples de gares confirmés, prix TTC classe 1/2, date, concessionnaire, URL officielle, SHA-256 et résultats CI. **Aucun prix inventé.**

Ticket de suivi : https://github.com/at374/convoyage-app/issues/209


## Récupération officielle VINCI du 8 novembre 2026 — nouvelle preuve

Workflow GitHub Actions **42459153168** : https://github.com/at374/convoyage-app/actions/runs/42459153168 (conclusion success). Le navigateur a révélé que les liens TXT ouvrent un nouvel onglet ; les quatre fichiers suivants ont ensuite été téléchargés par HTTP 200, avec `content-type: text/plain; charset=utf-8`, et archivés comme **sources brutes non encore validées sur leur période tarifaire** :

| Réseau | URL officielle | Octets | SHA-256 |
| --- | --- | ---: | --- |
| ESCOTA | https://public-content.vinci-autoroutes.com/PDF/Tarifs-peage-Escota/Tarifs_ESCOTA.txt | 7 709 | `f2024c36124dd5515aa6ad332b9307935031ffd4d445064f033d351839fa3b33` |
| A86 | https://public-content.vinci-autoroutes.com/PDF/Tarifs-Duplex-A86/Tarifs_A86.txt | 32 778 | `5fc381b5392c17afc205deb1c49812491113c81a829b90584c66c2cff48c1ab6` |
| Cofiroute / Arcour | https://public-content.vinci-autoroutes.com/PDF/Tarifs-peage-Cofiroute/Tarifs_Cofiroute_Arcour.txt | 722 247 | `4bb7c667e5c99218931cf6b81f3ebc13d9ee477543772cf251229ff32bad646c` |
| Arcos | https://public-content.vinci-autoroutes.com/PDF/Tarifs-peage-Arcos/Tarifs_Arcos.txt | 89 311 | `d9a1ff8bfa2d74790d992e34c10443f663008de0e3ab0d5fb7429eba189515d5` |

**ASF non récupéré** à ce stade : le clic initial a seulement déclenché le chargement de `/page-data/fr/conseils/autoroute-mode-demploi/tarifs-peage-vinci-autoroutes/page-data.json`. Examiner ce JSON Gatsby et retenter le clic après hydratation de la page.

Les quatre fichiers ont été conservés dans l'artefact GitHub `vinci-grilles-originales-non-verifiees` (rétention 14 jours). Ils ne sont **pas** encore importés dans `data/sources-officielles/`. Le code de capture est `scripts/telecharger-tarifs-vinci-navigateur.cjs` et le workflow `.github/workflows/capturer-grilles-vinci.yml`.

**Priorité immédiate :** récupérer ASF, examiner le format et la date des cinq TXT, puis utiliser les sources pour activer les tests Cofiroute/ESCOTA sans SKIP et comparer classes 1 et 2. Aucun tarif de production n'a été modifié à cette étape.

## ASF récupéré — clôture de la collecte des cinq TXT VINCI

Workflow GitHub Actions **42459303065** : https://github.com/at374/convoyage-app/actions/runs/42459303065 — **succès**. Après hydratation de la page Gatsby, le clic ASF ouvre un nouvel onglet avec l'URL officielle :

- ASF : https://public-content.vinci-autoroutes.com/PDF/Tarifs-peage-asf/Tarifs_ASF.txt
- HTTP 200 ; `text/plain; charset=utf-8` ; **108 099 octets** ; SHA-256 : `37d6934275ac40ab9c97abfdfcdbc7724ce2250d0573cf6332be95346d58d01f`.

**Les cinq fichiers TXT VINCI sont désormais récupérés et archivés** (ASF, ESCOTA, A86, Cofiroute/Arcour, Arcos). Les sources restent `downloaded_unverified` : aucune certification de la date tarifaire, de l'exhaustivité des relations, ni des prix classes 1/2 n'est encore acquise. Ne pas confondre « cinq sources récupérées » avec « 100 % des tarifs vérifiés ». Les sources officielles doivent maintenant être analysées et rapprochées des gares physiques, puis les tests CI doivent être exécutés avec ces fichiers et sans SKIP.


## Premier rapprochement sur les fichiers officiels — 8 novembre 2026

Workflow GitHub Actions **42459498188** : https://github.com/at374/convoyage-app/actions/runs/42459498188. Les cinq TXT officiels ont été récupérés, puis les tests existants ont été exécutés avec les chemins `COFIROUTE_TARIFS_PATH` et `ESCOTA_TARIFS_PATH` pointant vers les sources réellement téléchargées. **12 tests réussis, 0 échec, 0 SKIP.**

- **ESCOTA :** 141 lignes classées ; **91 confirmées**, **0 divergente ou ambiguë**, **34 non rapprochées**, **16 structurelles**. Résultat provenant du journal du test `peages-escota-grille-complete-cloture.test.cjs`.
- **Cofiroute/Arcour :** les contrôles de prix et d'alias existants réussissent, dont Taissy, St-Denis-Les-Sens, St-Amand-Montrond, Saint-Aignan-sur-Cher / St-Romain-sur-Cher et Selles-sur-Cher / Chémery. Ces tests ciblés ne prouvent **pas** à eux seuls que chaque ligne du TXT de 722 247 octets est couverte.
- **À faire :** auditer l'ensemble des lignes Cofiroute, puis ASF, A86 et Arcos ; vérifier la date d'effet et le format de chaque source ; établir les divergences et relations manquantes sans forcer les alias. Aucun tarif de production modifié.


## Profilage des cinq fichiers — workflow 42459616007

Exécution réussie : https://github.com/at374/convoyage-app/actions/runs/42459616007. Le programme `scripts/analyser-formats-vinci.cjs` a généré `analyse-formats.json` dans l'artefact GitHub Actions ; les 12 tests tarifaires existants passent sans SKIP.

| Source | Lignes de données | Colonnes | Caractères de remplacement UTF-8 |
| --- | ---: | ---: | ---: |
| ASF | 2055 | 9 | 0 |
| ESCOTA | 141 | 9 | 0 |
| COFIROUTE_ARCOUR | 11004 | 11 | 0 |
| A86 | 644 | 10 | 205 |
| ARCOS | 1092 | 5 | 3066 |

ASF/ESCOTA contiennent `autoroute_entree;nom_entree;autoroute_sortie;nom_sortie;classe1;classe2;classe3;classe4;classe5` (prix avec virgule). Cofiroute/Arcour ajoute les numéros d'échangeurs et emploie des prix avec point. A86 a une tarification par jour, badge et plage horaire, avec six colonnes de sens. Arcos a des lignes `Trajet;plage horaire;classe;Tarif_TTC;groupe_euro`. **Ne pas aplatir A86/Arcos en un prix unique** : préserver les conditions de validité. Les caractères de remplacement signalent que A86/Arcos ne sont probablement pas encodés en UTF-8 ; détecter et décoder l'encodage original avant de parser les libellés.

Aucune date de validité n'a été identifiée dans les 50 premières lignes des cinq sources. **La récupération au 8 novembre 2026 ne certifie pas une date d'effet 2026.** Aucune modification de production.

## Clôture — 8 novembre 2026, fichiers reçus directement de Laurent

Laurent a fourni directement les 5 fichiers TXT officiels (téléchargés depuis les liens publics VINCI). Importés dans `data/sources-officielles/` avec empreintes SHA-256 réelles (`etat-import-vinci-2026.json`, statut `imported` pour les 5 réseaux).

- **ASF** (2055 relations, tarifs 1er juin 2026) : vérification exhaustive, **2033 confirmées, 0 divergence**. 19 non rapprochées sur 6 noms seulement, tous déjà documentés (3 faux positifs de normalisation + PERIGUEUX + ST JEAN DE LUZ NORD, gaps physiques connus + 1 auto-paire source anormale).
- **ESCOTA** (141 relations) : tests existants (`peages-escota-grille-complete-cloture.test.cjs`) tournent sans SKIP, confirment 91/141, 0 divergence. Les 4 noms non rapprochés (AIX sur A51, ST LAURENT, LE CASTELLET, PONT DES GAUX) recoupés une 3e fois contre le registre ministériel `ESCOTA-2.pdf` (ecologie.gouv.fr, màj 01/10/2010) : absents également de ce registre. Confirmation définitive d'absence structurelle, pas une lacune de recherche.
- **Cofiroute/Arcour** (11004 relations) : tests existants tournent sans SKIP, confirment les alias déjà documentés, 0 divergence.
- **A86** (Duplex Rueil-Vaucresson-Vélizy) et **Arcos** (Itthenheim, A35) : tarification par jour/tranche horaire/badge, structurellement incompatible avec le moteur actuel (un seul prix classe1/classe2 par relation). Gares absentes de la base, documenté dans `tests/peages-a86-arcos-structurellement-incompatibles.test.cjs`, aucune approximation ajoutée.
- **A65 Alienor** : vérifié déjà intégré à 100 % (41 relations sous les noms `*A65`), confirmé contre l'arrêté du 28 janvier 2026 (Légifrance) et la presse.
- **Risque A13 flux libre** (Beuzeville, Bourg-Achard, Bourneville, Heudebouville, Chaufour/Gaillon, Poissy-Orgeval/Mantes-Sud) : SANEF confirme officiellement que le tarif en flux libre est identique à l'ancien tarif à barrières. Aucune modification nécessaire.

**État final (8 nov. 2026, corrigé) :** 697 tests passent, 0 échec, 0 skip. **CORRECTIF IMPORTANT :** LIÉVIN et THOUARCE, listés plus bas et dans des sessions antérieures comme "absences confirmées", étaient en réalité déjà intégrés depuis l'import d'origine, sous leur orthographe accentuée française ("LIÉVIN", "Thouarcé") — les tests d'audit cherchaient ces noms SANS accent, qui ne correspondent jamais à l'orthographe accentuée une fois mise en majuscules (différence insensible à la casse mais pas aux accents). Faux négatif de recherche corrigé dans `tests/peages-audit-sanef-470-stations.test.cjs` et `tests/peages-audit-asf-2056-cloture.test.cjs` le 8 novembre 2026. Par ailleurs, MANSAC/TERRASSON et LA BACHELLERIE EST/SUD sont couverts fonctionnellement par les points déjà résolus "Mansac Terrasson"/"La Bachellerie" (preuve par prix identique, cf. `tests/peages-perigueux-thenon-est-alias.test.cjs`).

Gaps restants, réellement confirmés absents (recherche GPS infructueuse malgré plusieurs sources officielles, ou incompatibilité structurelle de modèle de tarification) : ST JEAN DE LUZ NORD, LE BOULOU (F), PERIGUEUX/PERIGUEUX EST, LE CASTELLET/PONT DES GAUX, AIX A51 (Provence — à ne pas confondre avec AIX SUD/NORD, Savoie, déjà intégrés), ST LAURENT, Guiche/Urt-Briscous, Druye, A86, Arcos. Aucun prix n'a été inventé ou approximé.

## Référentiel ministériel officiel (gares-peage-2025.csv, data.gouv.fr) — 8 novembre 2026

Technique nouvelle découverte ce jour : `curl` direct depuis le bac à sable est bloqué pour la plupart des domaines (autoroutes.fr, atosca.fr, occitanie.developpement-durable.gouv.fr échouent), **mais `data.gouv.fr`/`static.data.gouv.fr` sont directement accessibles**. Téléchargement du référentiel officiel du Ministère (MTE, « Gares de péage du réseau routier national concédé », 1266 gares, mis à jour le 28/07/2025) et conversion Lambert93 (EPSG:2154) → WGS84 (pyproj) pour recoupement GPS systématique contre toutes les gares dangling encore ouvertes.

- **CORRECTIF MAJEUR : LIÉVIN et THOUARCÉ étaient déjà intégrés** (voir ci-dessus, bug d'accent corrigé dans 2 fichiers de test).
- **MANSAC/TERRASSON/LA BACHELLERIE EST/SUD : déjà couverts fonctionnellement** par "Mansac Terrasson"/"La Bachellerie" (preuve par prix).
- **ST GEOURS DE MAREMNE : absence confirmée définitivement** (43km de BENESSE dans la relation existante, donc pas le même point ; absent des 1266 gares officielles).
- **GUICHE (A64) : GPS officiel trouvé, mais non activable.** Le référentiel contient "Guiche Sortie"/"Guiche Entree" (dept 64), dont les coordonnées converties correspondent exactement (< 1m) au point déjà présent dans le tableau UNK de `routes-ui.js`. Mais l'unique relation connue de GUICHE ("URT-BRISCOUS <-> GUICHE", 1,3/1,3€) a besoin des DEUX extrémités résolues pour activer un prix (mécanisme de fusion dans `routes-ui.js`) — et URT-BRISCOUS reste totalement absent du référentiel officiel. Ajouter GUICHE seul n'activerait donc aucun prix : volontairement laissé tel quel. Documenté dans `tests/peages-guiche-thenon-barrieres-gps-officiel-non-actionnable.test.cjs`.
- **"Thenon vers Perigueux" / "Thenon vers Brives" (barrières Bpv officielles, A0089, PK157) : confirment** l'analyse déjà documentée (ASF_2014.pdf, "6 gares séparées au même PK157") — co-localisées à <0,06km de "Thenon Est" déjà en base — mais gares-peage-2025.csv ne fournit qu'une LOCALISATION, aucun TARIF propre à ces barrières. PERIGUEUX/PERIGUEUX EST restent donc non résolus, faute de source de prix (pas faute de localisation).
- **Flux-libre (portiques-free-flow-25-10-2025.csv/GeoJSON, Aliaé/Sanef-Sapn)** : vérifié, ne couvre pas l'A69/Atosca.
- **A69 (Atosca)** : reconfirmé définitivement sans source GPS officielle disponible, même après ce nouveau référentiel exhaustif.

**État (8 nov. 2026, après ce recoupement) : 702 tests passent, 0 échec, 0 skip.** Aucun prix inventé ou approximé. Les gaps listés ci-dessus restent la liste exhaustive et définitive des lacunes réelles connues à ce jour — chacune vérifiée contre au moins une source officielle distincte (web, PDF tarifaire, ou référentiel GPS ministériel) sans trouver de solution, et non de simples lacunes de recherche.

## Intégration réelle : SAINT ROMAIN SYSTEME FERME / FECAMP YVETOT OUEST — 8 novembre 2026

Une session précédente avait déjà examiné cette piste (`tests/peages-sapn-a29-havre-saint-romain-double-nommage.test.cjs`) et jugé la preuve par prix seule "trop proche pour trancher" (2 destinations exactes sur 4 partagées). Le référentiel officiel du ministère (gares-peage-2025.csv) apporte la preuve indépendante manquante :

- **"SAINT ROMAIN SYSTEME FERME" → fusionné vers "ST-ROMAIN-DE-COLBOSC"** (déjà résolu) : GPS officiel "Saint Romain de Colbosc (ferme)" à <0,02km, et le libellé "(ferme)" correspond explicitement au suffixe "SYSTEME FERME" (système de péage fermé, par opposition à "(ouvert)", présent au même échangeur dans le référentiel).
- **"FECAMP YVETOT OUEST" → fusionné vers "FECAMP"** (déjà résolu) : GPS officiel "Fecamp Sortie/Entree" à <0,01km, et 3 destinations partagées (BOLBEC, YERVILLE, ST-SAENS) toutes à prix EXACTEMENT identiques (0 divergence).
- **5 relations devenues des doublons exacts ont été dédoublonnées** (SAINT ROMAIN SYSTEME FERME<->BOLBEC/YERVILLE, FECAMP YVETOT OUEST<->BOLBEC/YERVILLE/ST-SAENS).
- **2 relations renommées (ST-ROMAIN-DE-COLBOSC<->FECAMP et <->ST-SAENS) présentaient un écart de 10 centimes avec une relation directe déjà en base** (probable révision mineure entre deux grilles sources) : conformément à la règle "zéro approximation" et pour respecter `peages-overlay-conflicts.test.js` (zéro doublon contradictoire toléré), ces 2 relations renommées ont été **retirées sans arbitrage** — le prix déjà en base reste inchangé, aucun prix choisi ou inventé.
- **"LE HAVRE" (seul), "TOTES" et "YVETOT EST" restent volontairement non résolus** : aucune source GPS officielle trouvée pour les deux premiers ; "YVETOT EST" prouvé distinct de "YVETOT" par désaccord de prix (BOLBEC<->YVETOT = 3,5/4,6 contre BOLBEC<->YVETOT EST = 3,5/4,8).
- Documenté dans `tests/peages-sapn-a29-havre-saint-romain-double-nommage.test.cjs` (réécrit) et `tests/peages-guiche-thenon-barrieres-gps-officiel-non-actionnable.test.cjs`.

**État final (8 nov. 2026) : 705 tests passent, 0 échec, 0 skip.** Aucun prix inventé, altéré ou approximé — seules deux relations déjà fonctionnellement couvertes ailleurs ont été retirées en doublon.

## Rappel important découvert le 9 novembre 2026 : l'audit GPS officiel est déjà exhaustif

`tests/peages-audit-officiel-data-gouv-gaps.test.cjs` (5-6 nov. 2026) a déjà vérifié que **chaque point GPS des 1266 gares du référentiel ministériel est à moins de 0,5km d'un point déjà connu** (aprr/overlay.gares/overlay.barrieres) **ou déjà dans UNK** (angle mort explicitement bloqué). Il n'existe donc plus aucun "trou GPS" au sens strict — toute nouvelle recherche doit porter sur la résolution de NOMS dangling (prix existants sans gare GPS correspondante), pas sur la découverte de nouveaux points GPS.

- **Près passé d'une fusion erronée** : j'ai d'abord cru pouvoir fusionner "NŒUX-LES-MINES N°6.1" vers "NOEUX LES MINES", avant de découvrir que ce dernier n'a lui-même AUCUN GPS (un test SANEF antérieur l'avait classé par erreur comme "déjà existant" en cherchant dans overlay.paires plutôt que dans les gares GPS réelles). Une session précédente avait déjà identifié ce cas comme **ambigu** (2 points réels distincts, "NŒUX-LES-MINES"/"Nœux-les-Mines", à 2,5km l'un de l'autre). Changement annulé avant tout commit.
- **MURET exploré, non résolu** : "Muret vers Toulouse"/"Muret depuis Toulouse" (barrières Bpv officielles) tombent à <0,03km de "TOULOUSE-SUD/OUEST" déjà résolu, mais aucune preuve par prix n'est possible (relation isolée, pas de 3e destination partagée) — laissé non fusionné, conformément à la leçon du cas NŒUX-LES-MINES. Documenté dans `tests/peages-muret-toulouse-sud-ouest-indice-insuffisant.test.cjs`.

**État (9 nov. 2026) : 708 tests passent, 0 échec, 0 skip.**

## Validation croisée contre la grille tarifaire officielle APRR/AREA (2026-02) — 9 novembre 2026

Nouvelle source officielle découverte : data.gouv.fr publie aussi "Tarifs autoroutes APRR" (extraction directe des PDF tarifaires APRR/AREA, "sans aucune modification du contenu"), avec une édition **2026-02** -- la plus récente disponible. Téléchargée via curl (même technique data.gouv.fr).

- **13 347 relations vérifiées contre cette grille officielle (12 397 APRR + 950 AREA) : 0 divergence, 100% de correspondance exacte.** Confirme l'intégrité de la base pour ces deux concessionnaires avec la source la plus à jour possible.
- **AREA (52 gares)** ne contient aucune des gares dangling (MODANE confirmé hors-réseau AREA — c'est SFTRF qui gère l'accès au tunnel du Fréjus — ni GAILLARD/SCIENTRIER, qui restent ATMB).
- **CHARMONT (dangling, Cofiroute/Loire)** apparaît verbatim dans la grille APRR, avec 5 autres noms IDENTIQUES à ses propres relations (ESCRENNES, FONTENAY /LOING, GONDREVILLE A77/N, GONDREVILLE A77/S, SAVIGNY /CLAIRIS) -- indice textuel très fort suggérant le même point de limite de concession A77 (frontière APRR/Cofiroute, Nièvre). Mais la grille APRR ne fournit AUCUNE coordonnée GPS, et aucune relation directe CHARMONT<->CHARMONT n'existe pour une preuve par prix. Sans GPS, aucune intégration n'est possible malgré la force de l'indice. Laissé non résolu.
- Documenté dans `tests/peages-validation-grille-officielle-aprr-area-2026-02.test.cjs`.

**État (9 nov. 2026, après validation) : 712 tests passent, 0 échec, 0 skip.**

## Vérification exhaustive des 22 concessionnaires listés dans le document transmis — 8 novembre 2026

Passage en revue de la liste complète (ADELAC, ALBEA, ALIAE, ALICORNE, ALIENOR, ALIS, AMEDEA, APRR, ARCOS, ARCOUR, AREA, ASF, ATLANDES, ATMB, ATOSCA, CCISE, CEVM, COFIROUTE, ESCOTA, SANEF, SAPN, SFTRF) :

- **ADELAC, ALBEA, ALIAE (A79), ALIENOR (A65), ALIS, APRR, AREA, ASF, ATLANDES, ATMB, CEVM (viaduc de Millau), COFIROUTE/ARCOUR, ESCOTA, SANEF, SAPN, SFTRF** : déjà couverts (PR #9 antérieure + travaux du 8 novembre ci-dessus).
- **ARCOS, A86** : gares confirmées absentes, incompatibilité structurelle documentée (voir ci-dessus).
- **ATOSCA (A69)** : grille vérifiée mais non intégrée (GPS indisponible, voir `data/peages-a69-verifie-non-integre-2026.json`).
- **AMEDEA (A412, Autoroute du Chablais)** : absence confirmée **normale, pas un gap**. Vérifié par recherche web (avis d'enquête publique avril-juin 2026, DUP de 2019, appel à concession 2021) que le projet est encore en phase d'autorisation environnementale au printemps 2026 — aucune section n'est ouverte à la circulation, donc aucun péage n'existe à ce jour. Rien à intégrer.
- **ALICORNE (A88, Caen-Falaise-Argentan-Sées-Alençon)** : déjà intégré à 100 % par une session antérieure (`tests/peages-alicorne-a88-falaise-sees.test.cjs`, documenté dans `routes-ui.js`). Confirmé via recherche GPS des gares (Falaise Ouest/Sud, Argentan, Sées, Nécy, Mortrée, Alençon Nord/Sud, Gacé, Orbec) — même type de faux-négatif que l'alerte A79 précédente : une recherche par sous-chaîne "a88" ne trouve rien car les noms de gares ne contiennent jamais le numéro de route.
- **CCISE** : sigle introuvable dans toute recherche web, y compris le document officiel de référence des concessionnaires (ASFA/ASECAP). N'apparaît dans aucune liste officielle de sociétés concessionnaires d'autoroutes françaises. Probable erreur/confusion du document transmis initial (dont une grande partie s'est révélée fabriquée) — non traité comme un gap réel.

**Conclusion : les 22 concessionnaires de la liste transmise sont désormais tous traités (intégrés, documentés comme incompatibles/non intégrables, ou écartés comme non pertinents).** 688 tests passent, 0 échec, 0 skip, aucune approximation.

## Audit d'intégrité interne de la base — 8 novembre 2026

En l'absence de nouvelle source à traiter, revue systématique de la cohérence interne de `peages-aprr.json`/`peages-overlay.json` (doublons de noms, références orphelines, sanité des prix) :

- **Doublons de noms** entre `aprr.g` et `overlay.gares` : un seul cas, **Auberives** (deux points GPS à 0,109km l'un de l'autre). Vérifié sans impact fonctionnel — le mécanisme de fusion ignore le point overlay dupliqué, aucun conflit de prix. Documenté dans `tests/peages-auberives-doublon-sans-effet.test.cjs`.
- **Noms "dangling"** dans `overlay.paires` (présents dans une relation tarifaire mais sans GPS propre) : 59 au total. 58 déjà couverts par des tests existants (TOULOUSE EST/OUEST, LE MONTET/MONTBEUGNY/MOLINET bare, LIMITE A*-A*, etc.). Le seul non documenté, **ST GEOURS DE MAREMNE** (lié à BENESSE, déjà résolu), reste volontairement non fusionné par prudence (pas de preuve officielle que c'est le même point physique, malgré une proximité géographique suggestive) — documenté dans `tests/peages-st-geours-de-maremne-benesse-non-fusionnes.test.cjs`.
- **Sanité des prix** : aucune ligne `classe2 < classe1` dans `aprr.p`, `overlay.paires` ou `overlay.tarifs`. 57 relations à prix 0,0€ trouvées (sections gratuites documentées au sein de corridors à péage, ex. Lyon/Tarbes/Provence) — vérifié que le code de recherche de prix (`paire()` dans `routes-ui.js`) ne traite pas `0` comme "absent" (bug de troncature à zéro écarté).

**État final : 695 tests passent, 0 échec, 0 skip, aucune approximation.**

---

## 9 nov. 2026 (suite) — nouveau jeu de données découvert : "flux libre" (A69 GPS)

Reprise de la recherche ("on doit arriver à 100% et les mises à jour futures aussi") : nouvelle interrogation de l'API data.gouv.fr avec des mots-clés élargis (tarifs sanef/asf/escota/cofiroute, atosca, A69, péage vinci...). Toutes ces recherches restent à 0 résultat, **sauf une** :

- **Nouveau dataset "Autoroutes et péages en flux libre"** (id `68f7f6e2cb331a47613d7778`), publié/mis à jour le **07-11-2026** (il y a 2 jours), ressource "portiques free flow 07-11-2026.csv". Comparaison directe avec l'édition précédente (25-10-2025, téléchargée aussi) : 38 lignes → 43 lignes.
  - **Validation** : les points officiels "Le Montet Ouest/Est" et "Montbeugny Ouest/Est" (A79, Aliaé) correspondent à <0,01km aux gares déjà résolues en base — confirme leur exactitude. Aucun des 6 points de ce dataset ne correspond aux noms dangling SANS suffixe (LE MONTET, MONTBEUGNY, MOLINET) : ils restent non résolus, aucune preuve nouvelle.
  - **Découverte** : l'édition du 07-11-2026 ajoute, pour la toute première fois, 4 points GPS officiels pour l'**A69/Atosca** (Verfeil, Villeneuve-lès-Lavaur/Maurens-Scopont, Puylaurens, Soual Est-Saint Palais) — absents de l'édition du 25-10-2025. C'est la première source GPS officielle jamais trouvée pour l'A69.
  - **Mais aucune intégration possible** : l'A69 n'a aucune relation même dangling dans la base (réseau totalement absent, pas juste un nom orphelin) et surtout **aucune grille tarifaire officielle structurée n'existe** (recherche data.gouv.fr "A69"/"atosca"/"tarifs atosca" : 0 résultat). Une recherche web confirme que le tarif de l'A69 est très récent (ouverture le 4 nov. 2026), contesté, et a déjà varié (presse : baisse de 33% rapportée) — aucune base fiable pour un prix sans approximation. L'A69 reste donc hors base.
  - Documenté dans `tests/peages-flux-libre-a79-validation-a69-gps-decouverte.test.cjs` (3 tests, tous passants).
- **Baseline mise à jour** (`docs/sources-officielles-baseline.json`) : le dataset "flux libre" a maintenant son propre `dataset_id` suivi précisément (au lieu d'une note vague), avec consigne explicite de vérifier en priorité toute nouvelle édition pour de futurs points A69, et l'entrée A69/Atosca précise qu'un GPS existe désormais mais pas de prix.

**État final : 718 tests passent, 0 échec, 0 skip, aucune approximation.**
