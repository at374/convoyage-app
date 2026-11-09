# Inventaire initial des réseaux AURA et frontières — 2026-11-09

Sources :
- https://transport.data.gouv.fr/datasets/agregat-oura (44 réseaux déclarés)
- https://www.oura.com/la-demarche-oura/ (partenaires)
- https://www.oura.com/ufaq/quels-sont-les-reseaux-de-transports-qui-peuvent-delivrer-un-titre-sur-carte-oura/ (billettique)
- https://transport.data.gouv.fr/datasets/region/84?licence=odc-odbl&locale=fr&modes%5B%5D=bus (autres jeux de données)

## 44 réseaux annoncés dans l'agrégat Oùra
Ondéa (Aix-les-Bains); TRA Mobilité (Albertville); TAM (Ambérieu-en-Bugey); TAC (Annemasse); CoqueliGO (Annonay); Tout’enbus (Aubenas); Trans’Cab (Aurillac); Mobi’Vals (Valserhône); Proxim iTi (Bonneville); Rubis (Bourg-en-Bresse); Ruban (Bourgoin-Jallieu); Cars Région Ain; Cars Région Allier; Cars Région Ardèche; Cars Région Cantal; Cars Région Drôme; Cars Région Haute-Loire; Cars Région Puy-de-Dôme; Cars Région Haute-Savoie; Cars Région Isère; Cars Région Savoie; Cars Région Express; Synchro (Chambéry); Chamonix Bus; EVA’D (Évian); TPR / Le 37 (Péage-de-Roussillon); Mobilité en Velay (Le Puy); Colibri (Miribel); Montélibus (Montélimar); Maelis (Montluçon); TICO 3CM (Montluel); Aléo (Moulins); Duobus (Oyonnax); T’CAP (Privas); RLV Mobilités (Riom); STAR (Roanne); J’ybus (Rumilly); ARCHE Agglo Le Bus (Tain-Tournon); SMTUT (Thiers); STAR’T (Thonon); Saônibus (Trévoux); Mobivie (Vichy); L’va (Vienne).

## Réseaux et services supplémentaires à traiter séparément
TER Auvergne-Rhône-Alpes; Cars Région Loire (non énuméré dans la liste des 44, mais publié au PAN et partenaire Oùra); Sibra Grand Annecy; TCL Lyon; T2C Clermont-Ferrand; STAS Saint-Étienne; M Réso Grenoble; M Réso Grésivaudan / TouGo; M Réso Voiron / Pays Voironnais; Citéa Valence-Romans; réseaux TPG Genève, Léman Express, SNCF grandes lignes, FlixBus, BlaBlaCar Bus, covoiturage et transports à la demande.

**Attention :** réseau commercial, autorité organisatrice, opérateur sous-traitant et jeu GTFS ne sont pas synonymes. Les listes Oùra ne garantissent pas l'exhaustivité des petites lignes ni des exploitants. Le GTFS ne garantit pas un tarif. Chaque source exige vérification du fichier, des dates de service, des arrêts, des correspondances, de l'accès piéton, des tarifs et des réservations TAD.

## Suivi à implémenter
Pour chaque réseau : identifiant, département(s), communes, URL source officielle, URL GTFS/NeTEx, date de fraîcheur, statut de téléchargement, nombre de lignes et arrêts vérifiés, tarif officiel et période, TAD/réservation, temps réel, intégration application, tests Android. Ne pas afficher « couvert » sur la seule base de la présence d'une URL.

## Contrôle croisé avec le répertoire officiel des lignes Oùra (9 novembre 2026)

Source primaire : https://sim.oura.com/fr/schedules . Cette page officielle recense des réseaux **au-delà des 44** du GTFS agrégé, notamment :
- **ARVi Mobilité — Cluses** (Haute-Savoie)
- **TPG — Saint-Julien-en-Genevois** (liaisons transfrontalières)
- **Cars Région Loire** (à distinguer de la liste historique des 44, mais présent dans la ressource GTFS agrégée récente)
- **Cars Région Savoie lignes touristiques**
- **Cars Région Transaltitude**
- **La Navette — Vic-le-Comte**
- **Pays Voironnais Mobilité**
- **M Réso Grésivaudan**, **M Réso Grenoble**
- **Sibra Annecy**, **TCL Lyon**, **T2C Clermont-Ferrand**, **STAS Saint-Étienne**, **Citéa Valence-Romans**
- **TER Auvergne-Rhône-Alpes**

**Correction de périmètre :** la liste des 44 réseaux sur la page descriptive n'est pas une liste exhaustive des réseaux réellement référencés par Oùra. Le calendrier de la ressource agrégée du 9 novembre mentionne aussi Cars Région Loire. Ne pas déduire l'absence de données à partir de la seule description du jeu de données.

Le PAN annonce pour la ressource GTFS agrégée environ **1 910 lignes** et **30 609 arrêts** : ce sont des totaux de la ressource, non des lignes et arrêts vérifiés dans Convoyage Ultra.
Source : https://transport.data.gouv.fr/resources/78904 .

### Priorités d'intégration complémentaires
1. Cluses / vallée de l'Arve : ARVi Mobilité, Proxim iTi, TER et Cars Région.
2. Saint-Julien-en-Genevois / Archamps : TPG et Cars Région Haute-Savoie ; vérifier réellement les arrêts, zones tarifaires et correspondances transfrontalières.
3. Isère : Pays Voironnais Mobilité, M Réso Grenoble/Grésivaudan et lignes Transaltitude.
4. Savoie : Synchro, Ondéa, Cars Région Savoie et lignes touristiques.
5. Clermont-Ferrand / Puy-de-Dôme : T2C, La Navette et Cars Région.

Les informations d'opérateur, horaires, prix et réservation restent à confirmer réseau par réseau avant d'afficher une mission comme réalisable.
