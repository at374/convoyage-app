# Inventaire opérationnel des calculateurs — France, AURA, Genève, Suisse

Contrôle des sources le 7 novembre 2026. « Disponible » signifie que la source peut informer une recherche ; cela ne signifie jamais une couverture exhaustive, un achat, ni un prix garanti.

| Périmètre | Source / calculateur | État dans Convoyage Ultra | Horaires / temps réel | Prix |
| --- | --- | --- | --- | --- |
| France | PAN, transport.data.gouv.fr | Catalogue et flux GTFS/NeTEx déjà exploités | métadonnées, horaires selon chaque producteur | aucun |
| France ferroviaire | SNCF GTFS/NeTEx + GTFS-RT | horaires théoriques raccordés ; temps réel non raccordé au verdict | GTFS théorique ; RT publié | aucun devis voyageur |
| AURA | Oùra | GTFS régionaux et réseaux ciblés raccordés | itinéraires partenaires, RT selon réseau | titres oùra à vérifier |
| AURA | Cars Région et Cars Région Express | lignes régulières sélectionnées raccordées | GTFS / documents | barèmes seulement quand ligne, date, produit prouvés |
| France / Europe | TripGo | raccordé, clé locale requise | selon fournisseurs retournés | montant reçu classé devis/estimation, jamais barème |
| France / Europe | BlaBlaCar Bus | via TripGo ; flux SIRI-Lite pour course identifiable | RT de course raccordable | devis frais requis |
| France / Europe | FlixBus | via TripGo si fournisseur retourné | horaires selon réponse | devis frais requis |
| Genève / frontière | tpg et Léman Pass | horaires suisses/TripGo ; lecteur tarifaire Léman Pass séparé | itinéraire et RT dans les sources partenaires | devis officiel ou grille datée seulement |
| Suisse jusqu’à Lausanne | CFF / données nationales suisses | recherche publique suisse raccordée | GTFS national via intermédiaire ; RT officiel exige clé | devis CFF frais requis |

## Sources officielles de référence

- PAN : https://transport.data.gouv.fr/api/datasets et https://doc.transport.data.gouv.fr/outils/outils-disponibles-sur-le-pan/api
- Oùra : https://www.oura.com/cgvu/
- SNCF : https://ressources.data.sncf.com/explore/dataset/horaires-sncf/
- tpg : https://www.tpg.ch/fr/voyager/plus-de-mobilite/app
- Léman Pass : https://www.lemanpass.com/tarifs/
- Suisse : https://opentransportdata.swiss/en/cookbook/timetable-cookbook/gtfs/

## Règles de présentation

1. Tous les résultats effectivement retournés restent visibles ; un résultat sans prix n'est pas supprimé.
2. Le prix ne devient « vérifié » que si la source donne une offre applicable à la relation, date, voyageur et produit.
3. BlaBlaCar, FlixBus, SNCF Connect, CFF et comparateurs peuvent varier selon disponibilité : chaque recherche doit demander un devis frais.
4. Les abonnements déclarés (Sibra, Oùra, Léman Pass) ne doivent réduire un total que lorsque leur zone, validité et conditions ont été démontrées.
5. Absence de résultat chez un fournisseur, panne CORS ou flux tronqué : statut « source indisponible ou couverture partielle », jamais « aucun transport ».

Aucun achat, compte, clé nouvelle, contact tiers, déploiement ou fusion n'est créé par cet inventaire. Authentification, Supabase et synchronisation des missions restent hors périmètre.
