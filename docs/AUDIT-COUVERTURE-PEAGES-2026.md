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
