# SANEF A1 — état de validation des 122 relations (2026)

Date du constat : 8 novembre 2026. **Document d'audit ; aucune activation en facturation.**

## Sources officielles à contrôler
- Classe 1, normal/vert/rouge : https://www.autoroutes.sanef.com/sites/default/files/2026-02/grille-modulee-01022026.pdf (page PDF 1, selon le rapport local).
- Classe 2, normal : https://www.autoroutes.sanef.com/sites/default/files/2026-01/2026_02-Grille-Sanef.pdf (page PDF 3, index 2, selon le rapport local).

## Contrôles documentaires disponibles
- 122 relations réparties sur ARSY (29), CHEVRIERES (30), SENLIS (31), CHAMANT (32).
- Classe 1 : 366 montants, comparaison ordonnée aux 12 groupes de montants de la grille modulée, **0 écart rapporté**.
- Classe 2 : 122 montants, comparaison ordonnée aux lignes 156–159 de la grille normale, **0 écart rapporté**.
- Total : 488 montants rapprochés, **0 écart rapporté**.
- Les 244 tarifs normaux ont également été rapprochés de `peages-overlay.json` sans écart dans un contrôle ponctuel.

## Ce que ces chiffres ne prouvent pas
1. La correspondance indépendante entre **chaque colonne de la grille PDF** et la gare exacte du fichier de correspondances.
2. L'éligibilité géographique de chaque relation et le sens réel de circulation.
3. Les exceptions des jours fériés et les heures réelles de passage aux gares.
4. Une certification pour la facturation ou une validation sur Android.
5. La réussite des sept suites de tests **sur le dernier commit distant** (le workflow GitHub n'a pas encore été confirmé).

Les alias de gare restent marqués `correspondances_documentaires_non_certifiees` et les tarifs modulés `experimental_not_activated`. Ne pas remplacer les tarifs de facturation par ces données.

## Critères pour lever le statut expérimental
- Vérifier chaque relation gare-à-gare contre les en-têtes et colonnes du PDF officiel, dans les deux sens applicables.
- Confirmer les règles horaires et exceptions à partir des publications officielles.
- Exécuter `node run-sanef-a1-tests.cjs` sur le commit distant, puis vérifier le résultat GitHub Actions.
- Effectuer les essais de présentation sur navigateur et Android avant tout déploiement, avec validation explicite de l'utilisateur.

Ce document ne modifie aucun prix, aucune mission, aucune authentification, ni Supabase.
