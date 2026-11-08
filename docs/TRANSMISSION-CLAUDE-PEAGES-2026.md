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
