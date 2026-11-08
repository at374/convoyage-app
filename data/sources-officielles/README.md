# Sources tarifaires 2026 — vérification reproductible

Les tests de comparaison détaillée ne doivent pas utiliser de fichiers dans /tmp d'une ancienne session.

Déposer les grilles officielles (fichiers de travail non encore versionnés) dans ce dossier, en conservant les noms et formats d'origine :

- `Tarifs_Cofiroute_Arcour.txt` : grille Cofiroute/Arcour, séparateur point-virgule. Utilisée par `tests/peages-chantier-cofiroute-cloture.test.cjs`.
- `Tarifs_ESCOTA.txt` : grille ESCOTA, séparateur point-virgule. Utilisée par `tests/peages-escota-grille-complete-cloture.test.cjs`.

Alternativement, définir `COFIROUTE_TARIFS_PATH` et `ESCOTA_TARIFS_PATH` avec les chemins absolus des fichiers disponibles sur la machine de test.

**État au 8 novembre 2026 :** ces fichiers ne sont pas présents dans le dépôt. En leur absence, les tests de comparaison de prix sont explicitement ignorés ; les contrôles géographiques indépendants continuent à s'exécuter. Les résultats historiques d'audits ne prouvent pas une comparaison CI actuelle.

Pour certifier une grille, conserver aussi son URL officielle, sa date d'application, son empreinte SHA-256 et le résultat d'une comparaison complète avec les prix de la base. Ne pas modifier les tarifs du moteur à partir d'un alias de gare non démontré.

## Référence éditeur vérifiée

Page officielle VINCI Autoroutes : https://www.vinci-autoroutes.com/fr/conseils/autoroute-mode-demploi/tarifs-peage-vinci-autoroutes/

Cette page distingue explicitement les **grilles ASF classes 1 et 2 applicables au 1er juin 2026** des **guides Cofiroute et ESCOTA applicables au 1er février 2026**, et liste les fichiers internes TXT ASF, ESCOTA, A86, Cofiroute/Arcour et Arcos. Ne pas attribuer automatiquement la date des grilles ASF aux fichiers d'autres concessionnaires.

**Important :** la présence d'un lien ou d'une grille sur le site ne signifie pas que son contenu a été téléchargé, archivé ou confronté à la base. La comparaison reste ignorée tant que la source correspondante est absente du runner. Les guides PDF ne sont pas interchangeables avec les fichiers TXT de relations tarifaires.
