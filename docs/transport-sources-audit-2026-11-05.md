# Sources de trajets et tarifs — audit du 5 novembre 2026

## Résultat et périmètre

Objectif produit : rechercher automatiquement Aller / Jonction / Retour aux adresses exactes, comparer les trajets et leur coût complet, carte et étapes, ouverture au bouton Transports dans l’application Android. Priorité AURA, Genève et liaisons vers l’Ain/Haute-Savoie, Suisse jusqu’à Lausanne, puis France entière. Inclure les petites lignes et les trams.

Une source documentée n’est pas une intégration opérationnelle. Cet audit recense des capacités et conditions d’accès. Aucun nouveau compte commercial, abonnement, clé, achat ou accès payant n’a été activé. Il ne prouve ni l’exhaustivité des trajets ni celle des tarifs dans l’application.

## Inventaire national réellement récupéré

Source : <https://transport.data.gouv.fr/api/datasets>, téléchargement JSON le 2026-11-05. Documentation : <https://doc.transport.data.gouv.fr/outils/outils-disponibles-sur-le-pan/api>.

- 816 jeux de données au total, tous modes et types confondus.
- 509 jeux contenant au moins une ressource déclarée GTFS ou NeTEx.
- 569 ressources GTFS et 184 ressources NeTEx ; 387 GTFS-RT, 87 SIRI et 21 SIRI Lite.
- L’inventaire JSON joint conserve les 510 jeux ayant au moins une ressource d’horaires ou de temps réel dans ces formats, leurs liens, identifiants et dates déclarées.

Ces nombres comptent des métadonnées, pas des réseaux distincts. Agrégats, versions et périmètres peuvent se recouper. La disponibilité déclarée n’est pas un test de téléchargement. Les calendriers, arrêts, correspondances, fichiers tarifaires et droits de réutilisation restent à contrôler par ressource. Aucun ZIP n’a été inspecté dans cette passe. L’absence de « tarif » dans le titre d’un jeu ne démontre pas l’absence de tarifs dans son archive.

Le module existant `transport-catalogue.js` découvre déjà ce catalogue : le réutiliser plutôt que créer un second moteur.

## Matrice des sources officielles

| Source | Trajets et circulation | Prix utilisables | Accès et contrôle restant |
|---|---|---|---|
| [PAN national](https://transport.data.gouv.fr/) | GTFS/NeTEx ; GTFS-RT/SIRI quand publiés | GTFS Fares / NeTEx tarifs si réellement présents | Public selon licence du producteur ; inspecter les archives et dates, vérifier chaque réseau |
| [Agrégat Oùra](https://transport.data.gouv.fr/datasets/agregat-oura) | Réseaux AURA ayant autorisé leur diffusion | Ne pas présumer qu’un horaire contient un tarif | Dédupliquer avec les flux des exploitants ; contrôler petites lignes et changements de calendrier |
| [Sibra](https://www.sibra.fr/voyages-occasionnels/) | Flux Sibra du PAN ; circulation à contrôler | Grille officielle, titres et abonnement selon périmètre | Vérifier la validité réelle de l’abonnement sur chaque portion ; ne pas l’étendre automatiquement aux cars régionaux |
| [SNCF horaires](https://data.sncf.com/explore/dataset/horaires-sncf/) | TGV, Intercités, TER ; données publiques et temps réel disponibles | Le flux horaire ne donne pas le prix de vente | Contrôler suppressions, desserte et correspondances |
| [API SNCF](https://numerique.sncf.com/faq/api/) | Recherche ferroviaire, horaires et itinéraires | Ne pas la présenter comme une API générale de prix de vente | Clé et quota ; distinguer de SNCF Connect commercial |
| [SNCF Connect affiliation](https://www.sncf-connect.com/outils/partenaire-affiliation) | Capacités selon contrat et produit API | Flux de prix et meilleurs prix selon origine/destination/date | Accès partenaire à obtenir ; aucune clé opérationnelle démontrée par cet audit |
| [Tarifs Intercités ouverts](https://ressources.data.sncf.com/explore/dataset/tarifs-intercites/) | Relations de la grille publiée | Bornes min/max de tarifs, selon classe et relation | Une fourchette n’est pas un devis pour un départ précis |
| [FlixBus partenariat](https://www.flixbus.fr/entreprise/partenaires/affiliation) | GTFS public ; intégration dynamique partenaire | Offre/prix de vente via accès commercial approprié | Ne pas confondre GTFS et inventaire commercial ; clé/contrat à vérifier |
| [BlaBlaCar Bus API](https://cdn.blablacar.pro/ims/api/blablacar-pro-ext-api.html) | Recherche d’inventaire par voyage et date | Prix et disponibilité dans les réponses commerciales | Jeton organisation partenaire ; lecture seule, aucun appel de réservation |
| [BlaBlaCar via TripGo](https://developer.tripgo.com/extensions/) | Extension de covoiturage, distincte de BlaBlaCar Bus | Prix des offres seulement si le fournisseur les transmet | Documentation : conditions BlaBlaCar, clé BlaBlaCar, puis activation dans les identifiants de l’application TripGo ; ne pas présumer l’activation de la clé actuelle |
| [TripGo](https://developer.tripgo.com/) | Itinéraires multimodaux selon zone et modes activés | `moneyCost` / `localCost` quand présents ; précision déclarée par le fournisseur | Clé et contrat ; distinguer estimation, prix communiqué et prix confirmé ; montant absent ≠ gratuit |
| [TPG](https://www.tpg.ch/fr/tarifs-titres-de-transport) | Réseau genevois et portions transfrontalières à vérifier dans les flux | Titres et grilles officiels | Ne pas appliquer un tarif genevois aux trajets transfrontaliers sans règle correspondante |
| [Léman Pass](https://www.lemanpass.com/faq/) | Combinaisons transfrontalières selon zones/réseaux | Grilles par zones, titres et compléments d’abonnement | Contrôler zones traversées, EUR/CHF, validité du titre existant et portions Ain/Haute-Savoie |
| [OJP Suisse](https://opentransportdata.swiss/en/cookbook/open-journey-planner-ojp-landing-page/) | Planificateur suisse ; données nationales et arrêts frontière à vérifier | Voir service tarifaire séparé | Clé, version et couverture à contrôler ; catalogue national suisse déjà prévu par le module existant |
| [OJP Fare](https://opentransportdata.swiss/en/cookbook/open-journey-planner-ojp-landing-page/ojp-fare/) | Complément d’un trajet suisse | Service décrit comme test/intégration, prix non contraignants, Suisse uniquement | Ne pas le classer comme prix de production confirmé ni comme couverture tarifaire transfrontalière complète |
| [Google Routes transit](https://developers.google.com/maps/documentation/routes/transit-route) | Recherche transport selon couverture | `transitFare` uniquement si le prix de toutes les portions est connu | Clé/projet/facturation ; aucune activation payante autorisée par cet audit ; estimation, pas disponibilité commerciale garantie |
| [Trainline Global API](https://tps.thetrainline.com/our-products/global-api/) | Offre ferroviaire multi-opérateurs selon contrat | Offres de vente et cartes de réduction selon produit | Candidat partenaire, accès non démontré ; vérifier France/Suisse/opérateurs exacts |
| [Omio B2B](https://www.omio.com/corporate/omio-b2b/) | Métarecherche multimodale | Prix et disponibilité des partenaires couverts | Contrat/API ; pas une garantie de couverture de tous les petits réseaux |
| [Distribusion](https://docs.distribusion.com/) | Distribution de transports terrestres selon partenaires | Inventaire et offres commerciales selon intégration | Accès partenaire et couverture à contrôler |
| [Tictactrip](https://developers.tictactrip.eu/) | Recherche train et car multi-opérateurs | Comparaison d’offres selon fournisseurs raccordés | Accord commercial et authentification ; ne pas annoncer une intégration existante |

## Comment obtenir les tarifs locaux

Les prix locaux doivent venir des exploitants/AOM, de fichiers tarifaires structurés ou de grilles officielles datées : Sibra, Oùra et réseaux régionaux, TCL, M réso, Synchro, Ondéa, TAC et autres réseaux découverts dans le catalogue. Cette liste est indicative : les 509 jeux horaires servent à établir la liste réseau par réseau.

[GTFS tarifs](https://doc.transport.data.gouv.fr/type-donnees/operateurs-de-transport-regulier-de-personnes/donnees-tarifaires-en-gtfs) : chercher les fichiers Fares réellement inclus et prendre en compte les règles, pas seulement un montant. [Profil NeTEx tarifs](https://normes.transport.data.gouv.fr/normes/netex/tarifs/) : exploiter les produits, zones et conditions publiés. Les formats ne garantissent pas que tous les exploitants publient leurs prix.

Les abonnements, correspondances gratuites, durées de validité, cartes de réduction, frais, devises et dates d’effet doivent faire partie du calcul. Une somme de billets unitaires peut surestimer le coût si un titre couvre plusieurs portions.

## Contrat de qualité pour l’application

Pour chaque résultat conserver : fournisseur, identifiant de l’offre si fourni, réception, trajet/date, montant, devise, précision du prix et conditions. Pour les données horaires conserver la validité du calendrier et l’état de circulation disponible. Une circulation théorique n’est pas une confirmation de fonctionnement en temps réel.

- Afficher un total connu seulement si toutes les portions payantes sont couvertes par un tarif compatible et sans double comptage.
- Si une portion manque : « Prix incomplet », détail des montants connus ; jamais 0 € par défaut.
- Distinguer « tarif officiel », « prix communiqué », « estimation » et « prix incomplet » ; ne pas convertir une estimation en tarif vérifié pour le classement.
- Ne pas classer un total partiel devant un total complet comme « moins cher ».
- Ne sommer que des monnaies identiques, ou afficher explicitement le taux, sa date et une estimation après conversion.
- Dédupliquer les mêmes services entre agrégat régional, opérateur et comparateur, sans supprimer leurs offres tarifaires distinctes.
- Refuser la mention « réalisable » sans preuve suffisante de desserte, adresses exactes et marge requise avant mission.
- Conserver la priorité utilisateur au prix et les trois choix : moins cher, compromis, plus rapide. Montrer les autres possibilités trouvées.

## Raccordement restant, sans confondre recherche et livraison

1. Pour chaque réseau de l’inventaire : licence, arrêt/adresse, calendrier, temps réel et présence de tarifs. Produire un état distinct « découvert / chargé / trajet testé / tarif testé ».
2. Inspecter d’abord les archives AURA et frontalières, extraire les règles tarifaires, puis tester les trajets d’un bout à l’autre avec correspondances.
3. Vérifier les modes et l’extension BlaBlaCar réellement activés sur TripGo, sans exposer les clés.
4. Comparer les accès commerciaux pour les prix SNCF/FlixBus/BlaBlaCar Bus/covoiturage ; un lien d’affiliation seul ne rapporte pas un prix dans l’application.
5. Choisir les accès nécessitant un contrat ou un coût seulement après connaissance des conditions ; aucun contact externe envoyé dans cet audit.
6. Tester sur Android la présentation, les offres sans prix, les devises, les abonnements et les correspondances. Une capture de carte avec tuiles simulées ne constitue pas une validation des fonds de carte en production.

La carte et la conservation des prix TripGo sont préparées séparément dans la PR #207. Cet inventaire documente les prochaines sources ; il ne les raccorde pas automatiquement et ne déploie rien sur le téléphone.
