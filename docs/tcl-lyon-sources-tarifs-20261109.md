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

## Vérification complémentaire des flux (9 novembre 2026)
- Le PAN confirme que le jeu TCL nécessite une authentification sur **data.grandlyon.com** et que les indicateurs de disponibilité/validation de certaines ressources sont indisponibles : https://transport.data.gouv.fr/datasets/horaires-theoriques-du-reseau-transports-en-commun-lyonnais
- La ressource GTFS historique du PAN couvre **14 avril au 12 juillet 2022** et affiche 0 % de disponibilité sur les dates vérifiées d'octobre–novembre 2026 : https://transport.data.gouv.fr/resources/65812 . **Ne jamais la considérer comme horaires actuels.**
- Le portail producteur confirme que les données sous licence Mobilité nécessitent une connexion pour accéder au jeu complet : https://support.grandlyon.com/data-grand-lyon/
- Une archive TCL importée par Transitland présente une plage de service **9 septembre 2026 – 7 janvier 2027**, avec **800 routes et 13 982 arrêts** ; il s'agit d'une **archive datée de septembre**, pas d'une preuve de disponibilité des trajets le 9 novembre : https://www.transit.land/feeds/f-u05-tcl~systral/versions/b2b95539fb8d78394378d970800fb94fde01613d
- Source d'origine historique indiquée par l'archive : `https://download.data.grandlyon.com/files/rdata/tcl_sytral.tcltheorique/GTFS_TCL.ZIP` ; **ne pas l'activer sans vérifier l'accès, les droits et le calendrier courant**.
- Le producteur précise que la fusion TCL/Libellule/Cars du Rhône a modifié les identifiants de lignes, l'organisation GTFS et les zones tarifaires des arrêts : https://data.grandlyon.com/portail/fr/actualites/reseau-tcl-unifie

**Conclusion opérationnelle :** une archive 2026 existe, mais le flux officiel actuel et son accès ne sont pas encore validés dans l'application. Ne pas attribuer un tarif TCL au seul identifiant de ligne : déterminer les zones réelles du trajet et appliquer les conditions du billet.

## Contrôle du 9 novembre 2026 — accès et fraîcheur des flux

- Le PAN confirme un **jeu de données TCL théorique de 60 jours** sous licence Mobilité, dont le téléchargement nécessite un compte sur data.grandlyon.com : https://transport.data.gouv.fr/datasets/horaires-theoriques-du-reseau-transports-en-commun-lyonnais
- La ressource GTFS historique du PAN est explicitement valable **du 14/04/2022 au 12/07/2022**, avec **0 % de disponibilité** dans le suivi récent. Son affichage d'une validation en 2026 ne rend **pas** son calendrier valable pour 2026 : https://transport.data.gouv.fr/resources/65812
- La ressource NeTEx historique est également signalée indisponible : https://transport.data.gouv.fr/resources/65813
- La documentation technique du producteur confirme l'utilisation de **HTTP Basic Auth sur HTTPS**, avec identifiants API distincts de la connexion GrandLyon Connect. **Ne pas stocker d'identifiants dans le dépôt, ni dans le JavaScript client** : https://rdata-grandlyon.readthedocs.io/fr/latest/authentification.html
- Mobility Database référence l'ancien flux `GTFS_TCL.ZIP` mais indique qu'il a été **remplacé par une autre URL producteur**. Rechercher cette nouvelle URL et valider son accès avant toute intégration : https://mobilitydatabase.org/feeds/gtfs/mdb-1020
- Une archive Transitland du **08/07/2026** indique **978 lignes et 14 274 arrêts**, mais son calendrier de service exploitable s'arrête au **05/11/2026**. Elle ne doit pas être utilisée pour des missions ultérieures : https://www.transit.land/data/feeds/f-u05-tcl~systral/versions/7ba48359965b5a65b4808379a11f7381c851f1cd

### Décision de sécurité

**TCL = source identifiée, raccordement non confirmé.** Ne pas activer l'ancien GTFS ni afficher ses horaires comme actuels. Un accès officiel autorisé et un calendrier validé sont indispensables. La veille quotidienne doit rechercher le remplacement de l'URL producteur, les évolutions de zones et les grilles tarifaires, et consigner séparément la date de publication, la date de vérification et les dates de service.

## Découverte complémentaire : SIRI Lite et archive GTFS plus récente (9 novembre 2026)

1. **SIRI Lite / Estimated Timetables** : le PAN suit la ressource `84026` et affiche **100 % de disponibilité le 09/11/2026**. Cette métrique vérifie une réponse technique (dont HTTP 401 ou 405 accepté), **pas** une interrogation authentifiée réussie ni des trajets exploitables. Source : https://transport.data.gouv.fr/resources/84026
2. **Transitland** référence une version TCL récupérée le **26/10/2026**, service déclaré **26/10/2026 au 23/02/2027**. Le portail précise **Basic Auth** pour la source producteur et mentionne une archive de versions successives. Cette version est une piste de contrôle des horaires, **pas une preuve que l'application peut télécharger le flux sans autorisation**. Source : https://www.transit.land/data/feeds/f-u05-tcl~systral
3. **Contrôle de cohérence** : les archives historiques du PAN et le SIRI Lite n'ont pas la même fraîcheur ni les mêmes modalités d'accès. Ne pas déduire la couverture TCL à partir du seul taux de disponibilité SIRI. Source : https://transport.data.gouv.fr/datasets/horaires-theoriques-du-reseau-transports-en-commun-lyonnais

### Critères d'activation TCL

- Accès légal et authentifié au GTFS actuel, sans secret embarqué dans le client Android ou déposé dans GitHub.
- Vérification du calendrier réel des courses et de la date de mise à jour, y compris jours fériés et modifications de service.
- Accès aux horaires SIRI Lite avec tests de requêtes valides, identifiants d'arrêts/lignes compatibles GTFS, gestion des erreurs et cache horodaté.
- Calcul des zones TCL et correspondances à partir de la grille officielle ; **aucun prix supposé à partir du seul numéro de ligne**.
- Itinéraires piétons, marge avant mission, comparaison des réseaux et tests Android avant toute annonce de raccordement.

## Vérification indépendante du 9 novembre : sémantique du taux SIRI et correspondances

- La ressource officielle SIRI Lite Estimated Timetables est documentée à https://transport.data.gouv.fr/resources/84026. Le PAN affiche 100 % de disponibilité du 10 octobre au 9 novembre, mais sa méthodologie **compte HTTP 401 (authentification requise) et HTTP 405 comme « disponible »**. Ce taux **ne démontre pas un accès aux horaires**.
- Une fiche tierce indique comme endpoint SIRI Lite `https://data.grandlyon.com/siri-lite/2.0/estimated-timetables.json` (https://scframework.org/source/SRC-ecaaceea-0a84-4e1c-9236-51d389f2a6cc). **Piste à vérifier avec le producteur, pas une URL GTFS et pas un flux déjà intégré.**
- Le producteur précise que, depuis l'unification TCL, l'identifiant `coursethéorique` des prochains passages correspond exactement au `trip_id` GTFS et que la zone tarifaire est ajoutée à la description des arrêts (https://data.grandlyon.com/portail/fr/actualites/reseau-tcl-unifie). **La jonction temps réel ↔ horaire théorique dépend donc d'un GTFS de la même version du réseau.**
- Ne jamais traiter une réponse SIRI `401`/`405` comme des données exploitables ; ne jamais injecter des identifiants de connexion dans les sources client ; ne jamais annoncer « transport confirmé » sur la seule base d'un statut HTTP.
