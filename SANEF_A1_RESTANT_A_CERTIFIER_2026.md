# SANEF A1 — périmètre de validation avant activation (2026)

Date de référence des grilles : **1er février 2026**.

## État des données

- **122 relations** dans `sanef-a1-modulation-2026.json`, réparties en 29 ARSY, 30 CHEVRIÈRES, 31 SENLIS et 32 CHAMANT.
- **366 montants classe 1** (normal, vert, rouge) rapprochés des lignes de la grille modulée. Le registre CSV documente cette comparaison, **sans certifier la correspondance physique des gares**.
- **122 montants classe 2 normaux** également rapprochés des lignes de la grille générale SANEF (page 3) : **488 montants comparés, sans écart numérique relevé**. Ce rapprochement ne certifie ni l'identité des gares, ni le sens, ni les exceptions calendaires.
- **33 alias de gares** documentaires, dont **33 avec référence officielle enregistrée** (A1, A2, A26 et A29), **0 sans référence documentaire** ; **aucune correspondance GPS certifiée**.
- La règle horaire et le sens de circulation doivent encore être vérifiés pour chaque usage réel, notamment les exceptions calendaires.

- **488 contrôles individuels en attente** dans `sanef-a1-certification-montants-2026.csv` : un enregistrement par relation et par montant (classe 1 normal/vert/rouge, classe 2 normal). Les pages, lignes, colonnes, sens et identités GPS restent non confirmés ; aucun montant n'est certifié par ce nouveau registre.

## Nouvelle preuve officielle — Setques (A26)

- SANEF décrit directement [la gare de péage de Setques](https://www.autoroutes.sanef.com/fr/mon-voyage/peage-de-setques), implantée au **kilomètre 32 de l'A26**. La [grille générale SANEF 2026](https://www.autoroutes.sanef.com/sites/default/files/2026-01/2026_02-Grille-Sanef.pdf) désigne une entrée « CALAIS (péage de Setques) ».
- Ces deux documents établissent la désignation documentaire de la gare et sa localisation kilométrique générale, **pas** des coordonnées GPS exactes ni une identité de nœud géographique certifiée pour l'application. La ligne `SETQUES (CALAIS)` du registre est désormais classée **NOM_KM_OFFICIELS_RELEVES_ALIAS_A_CONFIRMER** : la preuve documentaire est conservée, la correspondance GPS reste non certifiée.
- L'appellation des gares dans la grille modulée ne doit pas être assimilée automatiquement aux gares physiques de la grille générale sans contrôle du trajet et du sens.

## Nouvelle source officielle — A26, section nord

Le [règlement d'exploitation SANEF de décembre 2025](https://www.autoroutes.sanef.com/sites/default/files/2025-12/reglement-exploitation-Sanef-12-2025-Version-K-2.pdf) répertorie notamment les installations suivantes sur l'A26 : **Saint-Omer n°3 (PR 32+359)**, **Aire-sur-la-Lys n°4 (PR 40+589)**, **Lillers n°5 (PR 61+674)** et **Béthune n°6 (PR 73+609)**. Il distingue également la **barrière pleine voie Calais (PR 32+715)** de la gare de diffuseur Saint-Omer. Cette distinction interdit d'assimiler automatiquement la barrière de Setques à l'échangeur n°3.

Ces données sont des **preuves documentaires de noms, numéros et points de repère**, non des coordonnées GPS et non une certification des alias `L AUDOMAROIS`, `THEROUANNE`, `LILLERS` et `LE BETHUNOIS`. Le registre d'alias contient maintenant ces quatre références documentaires, sans certifier les correspondances physiques ; les références de page doivent rester vérifiables.

## Couverture documentaire complète — certification physique encore ouverte

- **A29/A26 Somme** : Amiens Est (Jules Verne), Villers-Bretonneux n°52, Gare TGV n°53 (Santerre), Athies n°54.
- **A2/A1 nord** : Hordain, Cambrai n°14 (Fontaine Notre Dame), Lille/Dourges (Fresnes), Arras Est A1 n°15 (L'Arrageois), Bapaume n°14.
- **A1 Somme/Oise** : Albert n°13.1 (Maurepas), Péronne/Vallée de la Somme n°13, Roye n°12, Ressons n°11.

Les noms entre parenthèses sont des alias documentaires internes, **pas des identités géographiques certifiées**. Ne renseigner numéro, PR, coordonnées ou page de PDF qu'après consultation directe d'une source probante.

## Protocole de certification indépendant (bloquant)

Pour chaque alias de gare, recueillir une preuve **géographique indépendante** (nom officiel, autoroute, sens, numéro de sortie ou type de barrière, coordonnées GPS de l'installation et source datée). Un point de repère kilométrique PR ne remplace pas des coordonnées GPS. En cas de plusieurs barrières ou bretelles proches, identifier le **nœud précis utilisé par l'application** et vérifier que la relation tarifaire concerne ce nœud.

Pour chaque relation tarifaire, contrôler **séparément les quatre montants** : classe 1 normal, vert et rouge dans la grille modulée, puis classe 2 normal dans la grille générale. Conserver pour chacun **URL officielle, date d'effet, numéro de page PDF, ligne et colonne, sens de circulation et résultat de la comparaison**. Les 122 lignes actuelles ne fournissent qu'un rapprochement documentaire groupé : leur statut ne vaut pas certification individuelle des 488 montants.

Bloquer explicitement la certification des correspondances **Athies n°54 / Amiens n°54** et **Dourges / Fresnes** tant que l'équivalence des installations n'est pas établie par une preuve vérifiable. Le statut `experimental_not_activated` et le prix normal de facturation restent inchangés.

## Travaux encore indispensables

1. **Auditer indépendamment** les 122 prix classe 2 déjà rapprochés de la grille SANEF standard, en conservant les références exactes de page, ligne et colonne pour chaque gare.
2. Confirmer **chaque alias** avec le nom de gare, son numéro d'échangeur et la localisation exacte ; lever les ambiguïtés avant tout rapprochement automatisé.
3. Vérifier le **sens d'application** de la modulation pour chaque relation et les conditions officielles de jours fériés / reports.
4. Maintenir un résultat **vert** des **12 suites SANEF A1** sur le dernier commit de la branche ; ce contrôle logiciel ne remplace pas une certification des sources.
5. Réaliser un contrôle fonctionnel de bout en bout sur Android **avant tout déploiement**, après validation explicite.

## État des validations techniques (8 novembre 2026)

- Dernière validation complète observée : commit `e1b472d`, [GitHub Actions SANEF A1 — succès](https://github.com/at374/convoyage-app/actions/runs/42485743848), avec le registre des 488 montants individuels. Les échecs de tests antérieurs liés aux formulations du statut GPS ont été corrigés.
- Les tests de robustesse protègent la simulation contre les calendriers non attestés, les alias non reconnus, les données de relations malformées et les montants invalides.
- **Ne pas confondre tests réussis et certification indépendante des 33 gares ou des 488 montants.**

## Interdictions d'activation

Le sélecteur SANEF A1 reste **expérimental**, fournit seulement un aperçu, et conserve systématiquement le tarif normal pour la facturation. **Aucune correspondance de gare, aucun montant classe 2 et aucun tarif modulé ne doivent être annoncés comme intégralement certifiés** à ce stade.

Sources officielles à vérifier :
- [SANEF — grille modulée A1 au 01/02/2026](https://www.autoroutes.sanef.com/sites/default/files/2026-02/grille-modulee-01022026.pdf)
- [SANEF — grille générale au 01/02/2026](https://www.autoroutes.sanef.com/sites/default/files/2026-01/2026_02-Grille-Sanef.pdf)

Le fichier `sanef-a1-certification-relations-2026.csv` est un **registre de travail**, pas un justificatif de certification finale.
