# Audit automatique des péages — état mesurable au 8 novembre 2026

## Indicateur historique, NON national

| Réseau | Lignes source historiques | Rapprochées | À clarifier |
| --- | ---: | ---: | ---: |
| APRR | 21505 | 21505 | 0 |
| AREA | 955 | 955 | 0 |
| Cofiroute/Arcour | 11004 | 10932 | 72 |
| ASF | 2056 | 2008 | 48 |
| ESCOTA | 141 | 91 | 50 |
| **Somme non dédoublonnée** | **35661** | **35491** | **170** |

**170 / 35661 = 0,4767 % de lignes à clarifier sur ces audits historiques.**
**Ce n'est ni le pourcentage des prix manquants ni celui du territoire national restant à couvrir.**

Attention : les 16 lignes structurelles ESCOTA et les 72 cas structurels Cofiroute ne sont pas nécessairement des prix manquants. Les lignes APRR/AREA peuvent se recouper avec d'autres sources et ne sont pas des montants uniques par classe et direction.

## État des sources et dates

- APRR / AREA : audits historiques fondés sur grilles officielles applicables au 01/02/2026.
- ASF : guide VINCI annoncé au 01/06/2026.
- ESCOTA et Cofiroute/Arcour : guide annoncé au 01/02/2026.
- A86 : tarif conditionnel par jour, badge, sens et plage horaire ; guide au 01/01/2026.
- Arcos : tarif conditionnel par trajet, classe et plage horaire ; guide au 01/02/2026.
- Fichiers officiels VINCI téléchargés dans les artefacts GitHub Actions mais registre `data/sources-officielles/etat-import-vinci-2026.json` encore à `not_imported`.

## Calcul national — état

`national_total_expected = null`
`certified_2026_unique_amounts = null`
`remaining_national_percentage = null`

Ces trois valeurs sont volontairement indéterminées. Pour un vrai pourcentage national, construire une clé canonique (concessionnaire, entrée physique, sortie physique, sens, classe, date de validité, et conditions horaires/badge pour A86/Arcos), puis comparer les tarifs certifiés aux relations attendues issues de **toutes** les grilles officielles.

## Exécution automatisée

- Script : `scripts/audit-couverture-peages-2026.cjs`
- Workflow : `.github/workflows/audit-couverture-peages-2026.yml`
- Le workflow génère un artefact JSON à chaque exécution réussie.
- **Aucune exécution n'a encore été vérifiée dans cette reprise.** L'API disponible pour les runs d'un commit ne retourne que les runs déclenchés par PR : un tableau vide ne prouve pas l'absence de runs déclenchés par push.

## Prochaines vérifications prioritaires

1. Vérifier l'exécution réelle du workflow et lire son artefact JSON.
2. Résoudre les 72 lignes Cofiroute, 48 ASF, 50 ESCOTA sans inventer de gares.
3. Comparer chaque prix de classe 1/2 avec la grille officielle de la bonne période.
4. Étendre à SANEF, SAPN, ATMB, ADELAC, ALIS, A79, A86, Arcos et autres ouvrages.
5. Dédupliquer au niveau national avant d'annoncer un pourcentage national.

Références : `docs/TRANSMISSION-CLAUDE-PEAGES-2026.md`, ticket #209, tests historiques du dépôt. Aucun tarif de production modifié.


## Rapprochement direct base principale ↔ overlay (8 novembre 2026)

Contrôle réalisé en mémoire sur les deux fichiers réellement récupérés de la branche `feature/transport-ranking-safe`, sans modifier les tarifs. Clé : deux noms de gares triés, accents et ponctuation retirés. Comparaison stricte des deux classes ; **les dates et le sens ne sont pas pris en compte**, ce qui limite la portée.

- `peages-aprr.json` : 540 gares, 16 918 lignes, 16 918 relations uniques, 33 836 montants, 0 ligne malformée, 0 doublon, 0 prix contradictoire interne.
- `peages-overlay.json` : 20 445 paires, 37 barrières, 119 tarifs de barrière (98 `PROUVE`, 21 `CROISE`, toutes classes confondues).
- 13 194 paires overlay ont une clé de noms présente dans la base principale.
- Parmi celles-ci, 13 189 ont des prix classes 1/2 identiques ; **5 divergent**.
- 7 251 paires overlay n'ont pas de clé de noms exacte correspondante ; cela **ne prouve pas** 7 251 prix manquants.

Les cinq divergences sont toutes depuis `BEUZEVILLE N°28` :

| Destination | Overlay C1/C2 | Base principale C1/C2 |
| --- | --- | --- |
| POISSY / ORGEVAL N°7 à MANTES-SUD N°12 | 11,60 / 18,50 € | 12,10 / 18,80 € |
| CHAUFOUR N°15 à GAILLON N°17 | 8,60 / 13,60 € | 9,10 / 13,90 € |
| BOURNEVILLE N°26 | 4,10 / 6,50 € | 4,60 / 6,80 € |
| HEUDEBOUVILLE N°18 | 6,60 / 10,40 € | 7,10 / 10,70 € |
| BOURG-ACHARD N°25 | 4,10 / 6,50 € | 4,60 / 6,80 € |

**À vérifier :** concessionnaire, dates tarifaires et sens avant toute correction. L'écart uniforme de +0,50 € classe 1 / +0,30 € classe 2 entre base principale et overlay peut signaler des versions de tarif différentes ; aucune conclusion causale à ce stade.

La comparaison de noms simplifiée n'est pas une certification officielle et peut fusionner à tort des homonymes. Aucun tarif de production modifié.


## Contrôle officiel SAPN A13 — Beuzeville (8 novembre 2026)

Source officielle : https://www.autoroutes.sanef.com/sites/default/files/2026-01/2026_02-Grille-SAPN.pdf

Grille **TTC applicable au 01/02/2026**, classe 1 page 1, tableau « AUTOROUTES A13 - A29 SUD ». Arrêté de référence : https://www.legifrance.gouv.fr/loda/id/JORFTEXT000053417647/

| Relation depuis BEUZEVILLE N°28 | SAPN officiel classe 1 | Base principale classe 1 | Overlay classe 1 |
| --- | ---: | ---: | ---: |
| POISSY / ORGEVAL N°7 à MANTES-SUD N°12 | 12,10 € | 12,10 € | 11,60 € |
| CHAUFOUR N°15 à GAILLON N°17 | 9,10 € | 9,10 € | 8,60 € |
| BOURNEVILLE N°26 | 4,60 € | 4,60 € | 4,10 € |
| HEUDEBOUVILLE N°18 | 7,10 € | 7,10 € | 6,60 € |
| BOURG-ACHARD N°25 | 4,60 € | 4,60 € | 4,10 € |

**Résultat : 5/5 valeurs classe 1 de la base principale correspondent à la grille officielle SAPN 2026 ; 5/5 valeurs classe 1 de l'overlay sont inférieures de 0,50 €.**

**Classe 2 : vérification indépendante de chaque cellule encore nécessaire** (le texte extrait de la page 2 ne reproduit pas toutes les cellules de la matrice). Les montants classe 2 de la base principale sont 18,80 / 13,90 / 6,80 / 10,70 / 6,80 €, ceux de l'overlay 18,50 / 13,60 / 6,50 / 10,40 / 6,50 € dans le même ordre ; ne pas considérer les premiers comme certifiés avant vérification de la page 2.

**Décision :** aucune mutation des tarifs de production ; consigner les cinq écarts comme `CLASSE_1_OVERLAY_DIVERGENT_OFFICIEL_2026`, puis certifier la classe 2 avant correction conjointe. Les valeurs peuvent relever de dates différentes ; préserver l'historique tarifaire si c'est le cas.
