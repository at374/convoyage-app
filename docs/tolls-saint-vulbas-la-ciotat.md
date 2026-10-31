# Péages Saint-Vulbas → La Ciotat — vérification du 31 octobre 2026

## Corrections

- Le péage La Boisse à système ouvert appartient à l'A432. Son ancien nuage de points contenait aussi un point de La Côtière sur l'A42. L'overlay et le chargeur (direct et worker) ne conservent pour le système ouvert que les deux points A0432 explicites du fichier ministériel `data/gares-peage-officiel.json`: 45.82868,5.03099 et 45.82879,5.03123. Les gares fermées LA BOISSE et LA COTIERE ne sont pas fusionnées.
- Les variantes d'accents, casse et ponctuation des gares sont résolues uniquement si elles désignent une entrée unique. Les qualifications d'autoroute et de sortie sont conservées. Les noms ambigus sont refusés, les correspondances exactes et prix déjà chargés restent prioritaires.
- Dans les données actuelles: 593 gares chargées, 20 036 lignes overlay; 10 895 lignes raccordables auparavant, 14 595 après correction. 265 libellés supplémentaires reconnus, **65 clés tarifaires nouvelles**; les autres lignes récupérées correspondent à des prix déjà présents. 306 libellés demeurent sans correspondance suffisamment sûre.
- Les 54 points de vigilance existants portent maintenant leur nom ministériel. L'affichage distingue les tarifs de barrières connus des autres raccordements manquants. Une barrière connue ne permet plus d'afficher un total si un de ces points reste à vérifier, même sans gare fermée reconnue.

## Recherche des sources officielles

Sources consultées/téléchargées le 31 octobre 2026:

- APRR, systèmes ouverts au 1er février 2026: https://voyage.aprr.fr/sites/default/files/2026-02/2026-%20Syst%C3%A8mes%20Ouverts%20APRR-AREA.pdf — La Boisse A432, 2,40 € classe 1 et 3,90 € classe 2, tarifs déjà présents et inchangés.
- Grilles APRR: https://voyage.aprr.fr/tarifs-de-peage
- VINCI: https://www.vinci-autoroutes.com/fr/conseils/autoroute-mode-demploi/tarifs-peage-vinci-autoroutes/
- Grille ASF: https://public-content.vinci-autoroutes.com/PDF/Tarifs-peage-asf/Tarifs_ASF.txt
- Grille ESCOTA: https://public-content.vinci-autoroutes.com/PDF/Tarifs-peage-Escota/Tarifs_ESCOTA.txt

Les grilles ASF et ESCOTA contiennent bien des tarifs sur le corridor A7/A8/A52/A50. Leur présence ne prouve pas quelles entrées/sorties tarifaires s'appliquent à un tracé donné. Cette modification n'ajoute aucun montant inventé, ne somme pas ces sections en un total non vérifié et ne supprime aucun blocage géographique pour obtenir artificiellement un prix.

## Reproduction et limites

`tests/fixtures/tolls-saint-vulbas-la-ciotat-2026-10-31.json` conserve une réponse publique Valhalla avec coordonnées des centres communaux: 393,699 km. Ce n'est pas le trajet de 387,8 km de la capture: les adresses/GPS exacts et la classe du véhicule ne figurent pas dans celle-ci.

Le tracé public ne doit pas déclencher La Boisse système ouvert. Plusieurs points tarifaires méridionaux restent proches du tracé, dont La Barque BPV et La Ciotat BPV; **proximité ne signifie pas franchissement**. Le total exact reste indisponible. Le raccordement directionnel des sections et la couverture nationale des 306 autres libellés restent à traiter. La méthode existante de reconnaissance géométrique des gares n'est pas une preuve de passage sur une bretelle adjacente.

## Validation

- `node --test tests/*.test.cjs`: 30 tests Node réussis, dont 6 nouveaux tests péages; certains fichiers historiques contiennent des assertions groupées.
- `python -m unittest discover -s tests -p 'test_*.py'`: 2 tests réussis.
- `node --check routes-ui.js` et `git diff --check`: réussis.
- `node tests/browser/tolls-mobile.cjs` avec Playwright/Chromium: Pixel 7 émulé, véritable Blob worker puis secours direct; noms visibles, aucun faux La Boisse, aucun total partiel, aucune erreur JavaScript, aucun débordement horizontal.
- Test navigateur isolé du composant réel avec fixture enregistrée et fichiers locaux; ni mission de production, ni authentification, ni disponibilité en direct. Aucun test sur téléphone Android physique et aucun déploiement.

La branche péages est indépendante de la PR transports #170 et part de `main` b6043b5742a56eca42bcc3e25b4d4af62c7d6246, qui contient des corrections péages plus récentes.

## Suite — raccordement des gares ministérielles

`scripts/connect-toll-stations.cjs --write` raccorde les tarifs existants au fichier ministériel local, sans appel réseau. Les noms doivent coïncider après normalisation, ne représenter qu'un seul libellé tarifaire et les points doivent être valides et regroupés dans un rayon de 1 km du premier point. Les homonymes distants et coordonnées invalides sont refusés. Les gares existantes, prix et points de vigilance ne sont jamais supprimés. Chaque ajout conserve la source, les noms officiels et identifiants routiers; `crossingConfirmed: false` rappelle que la position ne prouve pas un passage.

13 gares ajoutées: Auriol, Bourges, Cagnes Est, Carnoules, Cassis, Fontenay-sur-Loing, Fréjus Est, Gignac, Monts-Sorigny, Saint-Hilaire-les-Andrésis, Saint-Jean-d'Angély, Savigny-sur-Clairis, Tours Nord. Le rapprochement est idempotent sur les données présentes. Il utilise la version ministérielle déjà dans le dépôt, qui n'est pas un contrôle en temps réel des ouvrages.

Après ajout: **18 844 clés tarifaires chargeables**, contre 18 314 au premier commit de cette PR, soit **530 nouvelles clés sans doublons**. 15 129 lignes overlay raccordables contre 14 595; la différence de 534 lignes comprend des doublons et ne doit pas être annoncée comme 534 relations distinctes. Les libellés non résolus passent de 306 à **293**. Cagnes Est possède encore un tarif dont l'autre extrémité manque: une gare localisée ne garantit pas que toutes ses relations soient calculables.

Validation locale après ajout: **32 tests Node**, **2 tests Python**, Chromium mobile avec vrai worker puis secours direct, tous réussis. Les tests comparent également toutes les nouvelles coordonnées au fichier ministériel, vérifient les rejets d'homonymes distants, l'idempotence et le maintien du refus d'un total partiel vers La Ciotat. Aucun nouveau test sur téléphone Android physique ni déploiement.

## Suite — variantes de noms contrôlées sur les routes officielles

`data/toll-station-aliases.json` décrit sept correspondances explicites et leurs identifiants routiers ministériels: Belleville-sur-Saône A6, Bonneville Est et Ouest A40, Dijon-Arc-sur-Tille A31, Nuits-Saint-Georges A31, L'Isle-sur-le-Doubs A36, Saint-Denis-lès-Sens A19. Aucun élargissement générique de « St », « S/ », « Est » ou « Ouest » n'est appliqué. Tous les noms attendus doivent exister sur la route spécifiée avant tout ajout.

Les points sont ceux du ministère et conservent leur provenance. Les entrées/sorties d'une même gare peuvent être groupées; les barrières pleine voie et échangeurs de La Ciotat ne sont pas fusionnés. Leurs noms identiques dans OSM ne suffisent pas à prouver une équivalence tarifaire.

Résultat: **18 949 clés tarifaires chargeables**, soit **105** de plus après le raccordement initial des 13 gares; **286** libellés restent sans localisation. Les 20 gares ajoutées depuis le premier commit de la PR ne signifient pas 20 prix complets disponibles sur tous leurs trajets. Les tarifs Bonneville Est/Ouest → Scientrier, notamment, restent bloqués par l'extrémité Scientrier non localisée.

Validation locale finale de cette étape: **34 tests Node**, 2 Python, Chromium mobile (vrai worker puis secours), syntaxe et diff réussis. Les tests refusent les alias sur mauvaise route ou sans tous leurs noms officiels, distinguent Bonneville Est/Ouest et conservent l'incertitude Scientrier.
