# Contrôle des sources tarifaires GTFS

Le script `scripts/audit_gtfs_fare_sources.py` transforme l’inventaire national en contrôles reproductibles d’archives. Il reconnaît les tables tarifaires GTFS v1/v2 et des tables de zones, réseaux et catégories. Il conserve l’URL source, le SHA-256 des octets reçus, les colonnes, nombres de lignes et devises observées. Il ne certifie aucun prix et ne raccorde aucun nouveau tarif à l’application.

## Résultats du 6 novembre 2026

| Source | Contrôle réel | Conclusion limitée au fichier reçu |
|---|---|---|
| Sibra | Archive de 2 485 042 octets inspectée | Aucun fichier tarifaire reconnu ; utiliser les grilles officielles Sibra pour les prix |
| BlaBlaCar Bus | Archive de 213 600 octets inspectée | Aucun fichier tarifaire reconnu ; inventaire commercial distinct nécessaire pour les offres de vente |
| FlixBus / FlixTrain | Archive de 30 929 609 octets inspectée lors du second passage | Aucun fichier tarifaire reconnu ; le GTFS ne fournit pas ici le prix de vente |
| Agrégat Oùra AURA | Archive de 111 191 931 octets inspectée avec une limite de 128 MiB | Aucun fichier tarifaire GTFS reconnu dans cette archive |

Ces résultats portent uniquement sur les ressources et empreintes du rapport `validation-fare-sources-2026-11-06.json` et de son complément `validation-oura-fare-source-2026-11-06.json`. Ils ne démontrent pas l’absence d’autres publications tarifaires. Les calendriers et la circulation n’ont pas été validés par ce contrôle. Les anciens extraits horaires Sibra du dépôt ne sont pas remplacés par ce script.

## Utilisation

Python 3.12, bibliothèque standard uniquement :

```sh
python scripts/audit_gtfs_fare_sources.py docs/transport-pan-inventory-2026-11-05.json --network Sibra --output /tmp/sibra-fares.json
python scripts/audit_gtfs_fare_sources.py docs/transport-pan-inventory-2026-11-05.json --network FlixBus --max-download-mib 100 --output /tmp/flix-fares.json
python -m unittest discover -s tests -p test_gtfs_fare_source_audit.py -v
```

Les titres sont recherchés par sous-chaîne, sans distinction de casse ; plusieurs `--network` forment une union. Les ressources sont dédupliquées par URL et traitées séquentiellement. Le rapport précise les ressources omises par la limite. Par défaut : cinq ressources et 20 MiB par téléchargement ; maximum configurable : 50 ressources et 200 MiB. Les tables tarifaires décompressées sont limitées à 8 MiB chacune et 100 000 lignes. Aucune extraction sur disque et aucune clé requise.

Le rapport est écrit après chaque ressource pour préserver les résultats partiels. `inspection_failed` doit rester distinct de `no_price_table`. Les colonnes présentes ne valident ni les montants ni les règles tarifaires ; un prix complet doit encore intégrer validité, correspondances, abonnements et devise.

## Validation et suite

Cinq tests locaux réussis : archive sans prix, GTFS v2 en sous-dossier avec BOM et devise CHF, doublons ambigus, schéma incomplet et limite de décompression. Le workflow `Test fare source audit` exécute ces tests sans accès réseau.

Le chargeur de l’application conserve désormais les tables GTFS v2 de produits, règles, supports, catégories, zones, réseaux et périodes lorsqu’elles sont publiées. Leur contenu reste non vérifié et ne produit pas automatiquement de prix. Les limites de décompression s’appliquent aussi à ces tables. Les modes qui désactivent la conservation des tables sources continuent de les libérer.

Validation supplémentaire : 45 tests JavaScript (chargeur, worker, tarifs) réussis, dont conservation de sources v2 en CHF sans prix certifié et refus d’une table tarifaire trop volumineuse.

Restent notamment le rapprochement réseau par réseau avec les grilles officielles, les données tarifaires suisses et la vérification des accès partenaires pour les prix variables. Cet outil ne promet pas l’exhaustivité des trajets ou tarifs et ne change pas encore les résultats sur Android.
