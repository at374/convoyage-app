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

## Sources complémentaires officielles vérifiées le 9 novembre 2026

- Répertoire régional GTFS/NeTEx/GTFS-RT : https://transport.data.gouv.fr/datasets/region/84?format=GTFS&modes%5B%5D=bus&type=public-transit
- Partenaires Oùra : https://www.oura.com/la-demarche-oura/
- Réseaux vendant des titres sur Oùra (la présence d'une boutique ne constitue pas une API tarifaire) : https://www.oura.com/foire-aux-questions/faq-boutique-en-ligne/
- Détail et calendrier de l'agrégat : https://transport.data.gouv.fr/resources/78904

### Nouveaux points de contrôle
- **Cars Région Loire** : jeu de données interurbain individuel GTFS et NeTEx au PAN. À recenser distinctement des Cars Région Express et des cars de l'Isère.
- **TCL Lyon** : jeu de données indépendant GTFS et NeTEx, également SIRI Lite ; l'agrégat Oùra ne suffit pas à garantir son intégration.
- **STAS Saint-Étienne** : GTFS, NeTEx, GTFS-RT ; contrôler les horaires et le temps réel indépendamment.
- **T2C Clermont-Ferrand** : GTFS et GTFS-RT, jeu urbain individuel créé en octobre 2026.
- **Citéa Valence-Romans** : GTFS et GTFS-RT, distinct du réseau interurbain Drôme.
- **Sibra Grand Annecy** : jeu GTFS individuel.
- **Synchro Chambéry** : jeu GTFS et GTFS-RT individuel ; source candidate déclarée dans le code, non validée en production.
- **Rubis Bourg-en-Bresse** : deux jeux référencés au PAN, dont un avec GTFS-RT ; éviter doublons.
- **TPG Genevois** : officiellement partenaire Oùra et vendeur de titres Oùra, mais le tarif transfrontalier doit être calculé selon le produit et les zones réelles.

### Règle d'exhaustivité
Confronter systématiquement **trois ensembles** : 1) agrégat Oùra (44 réseaux annoncés), 2) répertoire des partenaires et de la billettique Oùra, 3) jeux individuels du Point d'accès national. Les écarts sont une **liste de réseaux à rechercher**, pas une preuve d'absence de service. Ne pas confondre nombre de réseaux, lignes, exploitants et trajets réellement validés.

## Vérification croisée du 9 novembre 2026 — écart entre partenaires et agrégat

L'agrégat officiel https://transport.data.gouv.fr/datasets/agregat-oura annonce **44 réseaux** ; la page officielle https://www.oura.com/la-demarche-oura/ annonce **54 réseaux dans la communauté Oùra**. Une autre FAQ Oùra mentionne **55 réseaux partenaires** (https://www.oura.com/ufaq/quels-sont-les-partenaires-du-projet-oura/). Ces chiffres correspondent à des périmètres et pages différents : **ne pas les additionner, ni déduire un nombre exact de réseaux manquants** sans rapprochement des identifiants et dates.

### Correction de calendrier
La ressource GTFS agrégée actuellement affichée à https://transport.data.gouv.fr/resources/78904 couvre **Cars Région Ain du 27 octobre 2026 au 31 août 2027**. La date « 15 novembre 2026 » inscrite dans l'audit précédent est **obsolète pour cet agrégat** et ne doit pas servir à bloquer les itinéraires. Les périodes restent à valider au niveau des calendriers des courses et de la version téléchargée.

### Priorité d'inventaire
Comparer les réseaux par identité réelle, en distinguant marques, AOM, exploitants, offres scolaires, transport à la demande et lignes touristiques. Réconcilier chaque écart avec le catalogue PAN. Aucun nombre de lignes/arrêts de l'agrégat ne doit être compté comme intégré avant validation dans l'application.

## Contrôle tarifaire ciblé — Ondéa / J’ybus (9 novembre 2026)

**Ondéa Aix-les-Bains :** le guide tarifaire officiel publié pour juillet 2024 indiquait 1,60 € à bord et 1,50 € dématérialisé, mais une information de presse datée du 27 mai 2026 annonce une hausse au 1er juillet 2026, notamment 1,70 € pour le ticket unitaire. **Ne pas coder les anciens 1,60 € comme tarif courant.** Rechercher la grille officielle entrée en vigueur en juillet 2026, son canal de vente et les éventuels titres OndéSynchro.
- Ancien guide officiel : https://files.ondeagrandlac.fr/s3fs-public/documents/Ondea-GuideTarifs%20%C3%A0%20partir%20du%201er%20Juillet%202024.pdf
- Signalement de hausse 2026 (source secondaire, à corroborer officiellement) : https://www.odsradio.com/news/locales/109241/aix-les-bains-les-tarifs-des-bus-ondea-revus-a-la-hausse-des-juillet

**J’ybus Rumilly :** le document officiel de conditions tarifaires 2024 indique 1,00 € le ticket unitaire, mais la brochure officielle plus récente de novembre 2025 détaille surtout les abonnements et renvoie à la gamme complète. **Ne pas déclarer 1,00 € comme tarif 2026 sans grille actuelle confirmée**. Vérifier séparément les lignes interurbaines J4/J5 et le transport sur réservation.
- Anciennes conditions : https://www.jybus.fr/sites/jybus/files/cgv_2024_tarifs_combines_.pdf
- Brochure novembre 2025 : https://www.jybus.fr/sites/jybus/files/jybus_brochure_billettiqueoura_nov2025_web_compressed.pdf
- Ligne J4 officielle : https://www.jybus.fr/ligne-j4

La présence de tarifs historiques ne satisfait pas l'exigence « tous les prix vérifiés pour la date de la mission ». Afficher « tarif à confirmer » plutôt qu'un montant obsolète.

## Sources officielles supplémentaires retrouvées — 9 novembre 2026

**Ondéa (Grand Lac)** : une délibération de Grand Lac du **19 mai 2026** fixe les tarifs applicables **à compter du 1er juillet 2026**. Cette source primaire doit primer sur le guide 2024 et les annonces de presse. PDF à extraire et contrôler avant toute activation d'un montant : https://grand-lac.fr/mon-agglo/gouvernance/actes-administratifs/actes-administratifs-grand-lac/conseil-communautaire/conseils-communautaires-2024/conseil-communautaire-du-30-janvier-2024/deliberations-2-2-1-1-1/deliberation-n43-tarifs-du-reseau-de-transports-urbains-ondea-a-compter-du-1er-juillet-2026-55584 . Le guide 2024 est **historique**, non probant pour novembre 2026.

**J’ybus Rumilly** : la brochure officielle de **novembre 2025**, tarifs en vigueur au **1er septembre 2025**, confirme des abonnements mensuels **14 € adulte**, **9 € jeune/senior**, annuels **135 € adulte** et **90 € jeune/senior**. Elle indique l'intégration des titres J’ybus (1 voyage, 10 voyages et abonnements) à la carte Oùra, mais ne donne pas dans l'extrait vérifié le montant courant du ticket unitaire. Source : https://www.jybus.fr/sites/jybus/files/jybus_brochure_billettiqueoura_nov2025_web_compressed.pdf . Ne pas extrapoler le tarif 2024 à novembre 2026.

**J’ybus ligne 3** : le site officiel indique une **réservation jusqu'à 2 heures avant le départ**. L'itinéraire doit être identifié comme **transport à la demande non confirmé sans réservation** ; une ligne GTFS ne constitue pas une place réservée. Source : https://www.jybus.fr/ .

**Cars Région Savoie** : le portail officiel sépare **S01–S07 périurbaines** et **S10–S83 touristiques**, avec des pages tarifaires distinctes et des titres M-Ticket via Oùra. Ne jamais appliquer un tarif unique à l'ensemble de ces lignes. Source : https://www.laregionvoustransporte.fr/cars-region/cars-region-de-la-savoie/infos-et-services-cars-region-de-la-savoie/titres-et-tarifs-de-savoie/ .

**Règle de publication** : un montant de billet n'entre dans les prix vérifiés de l'application que lorsque son produit, sa date d'effet, sa zone et ses lignes éligibles sont documentés ; les abonnements ne doivent pas être transformés en trajet gratuit sans validation de leur éligibilité.
