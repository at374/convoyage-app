# Isère — inventaire réel GTFS et priorités de vérification tarifaire

Source : artefact GitHub Actions `isere-gtfs-stop-inventory`, run [45250034654](https://github.com/at374/convoyage-app/actions/runs/45250034654), issu du ZIP `data/gtfs/cars-region-isere.zip`.

## Résultat contrôlé

- 6 459 identifiants dans `stops.txt` ; 6 459 identifiants distincts utilisés dans `stop_times.txt` ; **0 identifiant orphelin**.
- 55 470 occurrences de passages d'arrêts dans `stop_times.txt`.
- Les 100 arrêts les plus fréquents cumulent 11 274 passages (20,3 % des occurrences). Cette priorité statistique **n'est pas une preuve de zone tarifaire**.
- **0 affectation de zone officielle créée**. Aucun prix supplémentaire ne peut être annoncé.

## Exemples d'identifiants à examiner en priorité

| Identifiant GTFS exact | Nom GTFS | Passages |
|---|---|---:|
| `FR:38185:ZE:79996:ISERE` | Gare Routière | 494 |
| `FR:38053:ZE:84715:ISERE` | Place de la République | 259 |
| `FR:38053:ZE:84545:ISERE` | La Grive A43 | 255 |
| `FR:69388:ZE:83557:ISERE` | Grange Blanche | 225 |
| `FR:69388:ZE:83560:ISERE` | Mermoz-Pinel | 225 |

## Procédure d'intégration sans inférence

1. Obtenir une table officielle des zones et son millésime, avec la relation exacte entre identifiant d'arrêt et zone ; conserver URL et preuve de provenance.
2. Vérifier **chaque** identifiant contre `stops.txt` du ZIP effectivement utilisé ; une commune ou un nom homonyme ne suffit pas.
3. Rejeter l'import complet si un identifiant est inconnu, si une zone est invalide, si la provenance n'est pas officielle ou si la période tarifaire ne correspond pas.
4. Pour une course, examiner la séquence complète des arrêts et zones traversés, pas seulement le départ et l'arrivée.
5. Rejouer le diagnostic des 27 axes et comparer à la référence **379 / 965 itinéraires entièrement tarifés** (instantané du 23 novembre 2026).

Attention : les noms tels que « Gare Routière », « Grange Blanche » et « Mermoz-Pinel » ne sont pas uniques. Les identifiants GTFS exacts doivent être préservés.
