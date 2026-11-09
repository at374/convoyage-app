# TCL Lyon — audit sources et tarifs (9 novembre 2026)

## État de raccordement
- `transport-gtfs-agenda.js` : aucun flux TCL configuré à cette date.
- `transport-fares.js` : aucune référence TCL configurée à cette date.
- **Ne pas prétendre que TCL est couvert dans les itinéraires de Convoyage Ultra.**
- L'offre TCL unifiée comprend les anciens réseaux Cars du Rhône et Libellule, avec zones tarifaires. Les lignes et numérotations ont évolué en 2025–2026.

## Sources officielles
- Tarification TCL, zones et catégories : https://www.tcl.fr/titres-et-tarifs/tarification-tcl
- Guide TCL 2026 : https://www.tcl.fr/sites/default/files/2026-01/TCL_Campagne_Unification_Guide_Tarifaire_Janvier_2026.pdf
- Grille SYTRAL, « Tarifs au 1er septembre 2026 » : https://sytral-mobilites.fr/UserFiles/File/nos-missions/tarification-billettique/cp-tarification-2024-1.pdf
- Réseau unifié et tarification : https://sytral-mobilites.fr/fr/tarification-et-billettique.html
- GTFS/NeTEx/SIRI Lite (PAN) : https://transport.data.gouv.fr/datasets/horaires-theoriques-du-reseau-transports-en-commun-lyonnais
- Producteur : https://www.data.gouv.fr/datasets/horaires-theoriques-du-reseau-transports-en-commun-lyonnais
- Changements de numérotation à la rentrée 2026 : https://www.tcl.fr/titres-et-tarifs/rentree-2026

## Prix publics : 1 voyage (grille SYTRAL au 1er septembre 2026)
| Catégorie | EUR |
|---|---:|
| Zones 1+2 | 2,10 |
| Toutes zones | 3,70 |
| Deux zones voisines sauf zone 1 | 1,60 |
| Toutes zones sauf zone 1 | 2,50 |
| Zones 1+2 à bord | 2,40 |

**Ces prix sont des barèmes par zones, pas des devis validés pour un trajet donné.** Ne jamais les affecter automatiquement à un itinéraire sans zones exactes, date de voyage, support et conditions de correspondance. Rhônexpress est distinct de la tarification TCL unifiée.

## Blocage de données et conditions d'intégration
Le PAN indique explicitement que le producteur exige une authentification sur data.grandlyon.com pour accéder aux données horaires. Le GTFS historique public n'est pas une source valable pour les voyages de novembre 2026. Ne pas coder d'URL de ZIP fictive, ni réutiliser un GTFS 2022.

Prochaines étapes : obtenir un flux TCL autorisé et à jour ; vérifier la validité du calendrier (60 jours annoncés), les arrêts, les trajets et la disponibilité des données temps réel ; calculer les zones réellement traversées avant d'afficher un prix ; tester les correspondances TER/Cars Région et les accès piétons ; ne pas fusionner ni déployer sans validation. Surveillance des modifications par la veille quotidienne existante.
