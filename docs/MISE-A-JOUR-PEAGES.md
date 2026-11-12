# Mettre à jour les péages (Convoyage Ultra)

Un seul outil : `python3 tools/maj-peages.py` (depuis la racine du dépôt).

1. **Contrôler** : `python3 tools/maj-peages.py check` — barrières sans tarif, tarifs orphelins, classe 1 > classe 2, OUV sans barrière, et la liste des gares sans position dont des prix officiels dorment (≈ 500 paires).
2. **Nouveaux tarifs / révision annuelle (1er février)** : remplir un CSV `type;a;b;c1;c2;km;source;date`
   - `paire;TULLE EST;MANSAC TERRASSON;12,40;18,20;96;ASF 2026;2026-06-01`
   - `barriere;aprr-area-ouvert-boisse-syst-me-ouvert;;2,40;3,90;;AREA 2026;2026-02-01`
   puis `python3 tools/maj-peages.py import fichier.csv` (ajoute les absents) ou `... --maj` (remplace aussi les prix changés).
3. **Position d'une gare** (active les paires qui dorment) : `python3 tools/maj-peages.py gare "NOM" lat lon`.
4. Le script bascule tout seul le cache de `sw.js` (les téléphones rechargent) et relance le contrôle.
5. Ensuite : `node --test tests/*.test.cjs`, commit, publication.

Règles : un prix exact importé remplace toute estimation ; les estimations (≈) ne sont jamais stockées dans les tarifs officiels ; une gare de type « barrière à tarif fixe sans paire » doit être déclarée dans `OUV` (routes-ui.js) ET avoir une barrière dont l'id finit par le même slug.

## Points « sans tarif » (UNK) — ajouté le 12 nov. 2026
- `UNK` (routes-ui.js) liste des points de péage officiels dont le tarif manque : un trajet qui passe à moins de 0,5 km d'un de ces points n'a pas de prix exact (le prix reste en ≈, avec la partie vérifiée affichée).
- Un point UNK ne bloque plus si une gare tarifée reconnue sur le tracé est à moins de 1 km de lui (V294).
- Pour rattacher un point à une gare déjà dans `peages-aprr.json`, ajouter dans `peages-overlay.json` > `gares` une entrée `{"nom": "<gare>", "points": [...], "ajout": [[lat, lon]]}` (V295). Pour un tarif trouvé : l'ajouter (paire ou barrière), puis retirer le point de `UNK`.
- Ne jamais retirer un point UNK sans tarif officiel ni gare tarifée au même endroit.
