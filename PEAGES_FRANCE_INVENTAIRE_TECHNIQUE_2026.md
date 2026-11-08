# Inventaire technique des péages France — état du 8 novembre 2026

## Comptages observés directement dans les fichiers du dépôt

| Fichier | Contenu | Nombre brut |
|---|---|---:|
| `peages-overlay.json` | `paires` (entrées de l'overlay, non certifiées ici) | 20 445 |
| `peages-overlay.json` | `tarifs` (entrées, structure distincte des relations) | 119 |
| `peages-overlay.json` | `gares` (entrées) | 76 |
| `peages-overlay.json` | `barrieres` (entrées) | 37 |
| `peages-aprr.json` | `g` (entrées de gare) | 540 |
| `data/gares-peage-officiel.json` | `d` (enregistrements géographiques officiels, doublons possibles) | 1 266 |
| `data/osm-peages-france.json` | `d` (enregistrements géographiques OSM, doublons possibles) | 3 012 |
| `sanef-a1-modulation-2026.json` | relations du lot A1 expérimental | 122 |
| `sanef-a1-cellules-pdf-controlees-2026.csv` | cellules PDF consignées | 21 |

**Ces nombres sont des volumes de structures différentes, pas des relations uniques certifiées.** En particulier, les 20 445 entrées `paires` ne doivent pas être présentées comme 20 445 tarifs officiels 2026 vérifiés, ni additionnées aux 16 918 relations historiques. Les 1 266 et 3 012 enregistrements géographiques ne sont pas des tarifs.

## Méthode indispensable pour établir le vrai reste à trouver en France

1. Extraire les relations origine/destination/sens/classe de chaque source et normaliser les identités GPS, sans confondre gares, barrières, portiques et relations.
2. Dédupliquer les relations réellement identiques, sans fusionner arbitrairement deux gares portant un nom voisin.
3. Rattacher à chaque relation les montants TTC 2026 des deux classes, le concessionnaire, la date d'effet, la page/ligne/colonne officielle et le sens.
4. Distinguer `absent`, `présent_non_certifié`, `certifié`, et `conflit_de_sources`.
5. Comparer l'inventaire des relations officiellement possibles à l'inventaire vérifié. **Avant cette étape, le nombre national restant est inconnu.**

Le lot SANEF A1 reste expérimental : 21/488 cellules documentées et 0/488 montants intégralement certifiés, avec 0/33 identités GPS certifiées. Aucune activation de facturation ni déploiement mobile.
