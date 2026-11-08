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

**Version corrigée après relecture des colonnes de la matrice triangulaire SAPN.** Une interprétation antérieure confondait les colonnes CHENARD et BEUZEVILLE ; elle a été retirée de ce document.

Source officielle primaire : https://www.autoroutes.sanef.com/sites/default/files/2026-01/2026_02-Grille-SAPN.pdf — page PDF 2 (classe 1), page PDF 3 (classe 2), grille A13/A29 SUD, applicable au **01/02/2026**. Vérification visuelle des deux pages de la matrice.

| Départ | Destination | SAPN officiel classe 1 | SAPN officiel classe 2 | Base principale C1/C2 | Overlay C1/C2 |
|---|---|---:|---:|---|---|
| BEUZEVILLE N°28 | POISSY / ORGEVAL N°7 à MANTES-SUD N°12 | 11,60 € | 18,50 € | 12,10 / 18,80 € | **11,60 / 18,50 €** |
| BEUZEVILLE N°28 | CHAUFOUR N°15 à GAILLON N°17 | 8,60 € | 13,60 € | 9,10 / 13,90 € | **8,60 / 13,60 €** |
| BEUZEVILLE N°28 | BOURNEVILLE N°26 | 4,10 € | 6,50 € | 4,60 / 6,80 € | **4,10 / 6,50 €** |
| BEUZEVILLE N°28 | HEUDEBOUVILLE N°18 | 6,60 € | 10,40 € | 7,10 / 10,70 € | **6,60 / 10,40 €** |
| BEUZEVILLE N°28 | BOURG-ACHARD N°25 | 4,10 € | 6,50 € | 4,60 / 6,80 € | **4,10 / 6,50 €** |

**Conclusion vérifiée : overlay = 10/10 prix conformes à la grille officielle SAPN 2026 ; base principale = 10/10 montants différents.** Écart uniforme base moins officiel : +0,50 € classe 1, +0,30 € classe 2.

Attention : ceci démontre une différence de version des prix sur ces cinq relations, pas nécessairement l'absence d'une règle tarifaire supplémentaire dans un autre contexte. Ne modifier aucune donnée de production avant contrôle de l'origine des montants, du sens et de la date.


## Sources officielles VINCI : dates de validité distinctes (8 novembre 2026)

Source primaire : https://www.vinci-autoroutes.com/fr/conseils/autoroute-mode-demploi/tarifs-peage-vinci-autoroutes/

| Réseau | Date affichée sur la page officielle | Documents disponibles |
|---|---|---|
| ASF | 01/06/2026 | Grilles classes 1 et 2, guide et fichier TXT |
| COFIROUTE / ARCOUR | 01/02/2026 | Guide et fichier TXT |
| ESCOTA | 01/02/2026 | Guide et fichier TXT |
| Duplex A86 | 01/01/2026 | Guide et fichier TXT |
| ARCOS A355 | 01/02/2026 | Guide et fichier TXT |

**Contrôle d'import obligatoire :** ne pas appliquer la date 01/02/2026 indistinctement aux cinq réseaux ; ne pas interpréter les tarifs A86 conditionnels comme des prix fixes. La présence d'un fichier officiel ne signifie pas que toutes ses lignes sont déjà intégrées ou certifiées dans l'application.
