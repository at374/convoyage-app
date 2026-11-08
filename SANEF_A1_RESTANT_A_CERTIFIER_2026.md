# SANEF A1 — périmètre de validation avant activation (2026)

Date de référence des grilles : **1er février 2026**.

## État des données

- **122 relations** dans `sanef-a1-modulation-2026.json`, réparties en 29 ARSY, 30 CHEVRIÈRES, 31 SENLIS et 32 CHAMANT.
- **366 montants classe 1** (normal, vert, rouge) rapprochés des lignes de la grille modulée. Le registre CSV documente cette comparaison, **sans certifier la correspondance physique des gares**.
- **122 montants classe 2 normaux** également rapprochés des lignes de la grille générale SANEF (page 3) : **488 montants comparés, sans écart numérique relevé**. Ce rapprochement ne certifie ni l'identité des gares, ni le sens, ni les exceptions calendaires.
- **33 alias de gares** documentaires, non certifiés individuellement.
- La règle horaire et le sens de circulation doivent encore être vérifiés pour chaque usage réel, notamment les exceptions calendaires.

## Travaux encore indispensables

1. **Auditer indépendamment** les 122 prix classe 2 déjà rapprochés de la grille SANEF standard, en conservant les références exactes de page, ligne et colonne pour chaque gare.
2. Confirmer **chaque alias** avec le nom de gare, son numéro d'échangeur et la localisation exacte ; lever les ambiguïtés avant tout rapprochement automatisé.
3. Vérifier le **sens d'application** de la modulation pour chaque relation et les conditions officielles de jours fériés / reports.
4. Maintenir un résultat **vert** des **12 suites SANEF A1** sur le dernier commit de la branche ; ce contrôle logiciel ne remplace pas une certification des sources.
5. Réaliser un contrôle fonctionnel de bout en bout sur Android **avant tout déploiement**, après validation explicite.

## État des validations techniques (8 novembre 2026)

- Dernière validation complète observée : commit `4f1e61e5`, [GitHub Actions SANEF A1 — succès](https://github.com/at374/convoyage-app/actions/runs/42484356732).
- Les tests de robustesse protègent la simulation contre les calendriers non attestés, les alias non reconnus, les données de relations malformées et les montants invalides.
- **Ne pas confondre tests réussis et certification indépendante des 33 gares ou des 488 montants.**

## Interdictions d'activation

Le sélecteur SANEF A1 reste **expérimental**, fournit seulement un aperçu, et conserve systématiquement le tarif normal pour la facturation. **Aucune correspondance de gare, aucun montant classe 2 et aucun tarif modulé ne doivent être annoncés comme intégralement certifiés** à ce stade.

Sources officielles à vérifier :
- [SANEF — grille modulée A1 au 01/02/2026](https://www.autoroutes.sanef.com/sites/default/files/2026-02/grille-modulee-01022026.pdf)
- [SANEF — grille générale au 01/02/2026](https://www.autoroutes.sanef.com/sites/default/files/2026-01/2026_02-Grille-Sanef.pdf)

Le fichier `sanef-a1-certification-relations-2026.csv` est un **registre de travail**, pas un justificatif de certification finale.
