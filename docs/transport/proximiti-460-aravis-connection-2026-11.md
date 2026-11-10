# Liaison Aravis ↔ Proxim iTi — ligne 460

Vérification documentaire : 2026-11-10.

Source officielle mairie de La Clusaz : https://www.laclusaz.org/transports-en-commun/

La commune signale une connexion entre les lignes régulières Y62/Y63 et le réseau Proxim iTi, via la ligne **460** au départ ou à l'arrivée de **Saint-Jean-de-Sixt**. Cette ligne fonctionne **sur réservation**.

Réseau Proxim iTi : https://www.proximiti.fr/

## À vérifier avant tout raccordement automatique

1. Identifier le `stop_id` GTFS exact et les coordonnées des arrêts utilisés par chaque réseau.
2. Vérifier les horaires, jours de circulation, contraintes et délais de réservation de la ligne 460 auprès de l'exploitant.
3. Vérifier l'itinéraire piéton réel entre les deux arrêts et le temps de correspondance.
4. Obtenir les tarifs officiels applicables à la date du voyage et à chaque titre.
5. Ne jamais déclarer la correspondance **réalisable** sans réservation/transport confirmé ; afficher **Transport non confirmé — vérifiez vous-même** tant que les preuves manquent.

Cette note est un élément de recensement et **n'ajoute aucun horaire, prix, trajet confirmé ou bouton** à l'application. Aucun changement de synchronisation des missions, d'authentification ou de Supabase.

## Contrôle complémentaire — 10 novembre 2026

Sources opérateur :
- https://www.proximiti.fr/vos-deplacements/horaires-a-telecharger/
- https://www.proximiti.fr/nos-solutions/bus/
- https://www.proximiti.fr/lignes-de-bus-changements-importants-au-24-aout/
- https://www.ccvt.fr/vie-pratique/mobilites-transport/lignes-regulieres

**Ligne 460 :** réservation au moins **2 heures avant** le départ, via Bus CheckIn ou au 04 50 62 29 39. Vérifier la confirmation et les arrêts réellement desservis. Le réseau annonce des modifications au 24 août 2026 : ne pas reprendre automatiquement une ancienne grille.

**Ligne 461 :** ligne distincte **sans réservation** selon la CCVT. Les horaires et jours de circulation doivent néanmoins être vérifiés pour la date choisie.

**Tarif de référence :** Saint-Jean-de-Sixt Tourisme publie un ticket 1 h à 1,70 € pour la 460 (https://www.saintjeandesixt.com/infos-pratiques/mobilite/circuler-dans-les-aravis/). Cette information ne confirme pas un prix pour un trajet précis ; vérifier le barème opérateur en vigueur.

Aucun identifiant d'arrêt GTFS, temps de marche, horaire, prix de trajet ou réservation n'est confirmé par cette note.

## Barème officiel Proxim iTi — contrôle 2026-11-10

Source exploitant : https://www.proximiti.fr/tarifs-abonnements/lignes-regulieres-de-bus/

- Ticket unitaire : **1,70 €**, correspondances incluses pendant **1 h 30** sur les lignes régulières du réseau (tarif annoncé depuis le 1er septembre 2024, page opérateur mise à jour en septembre 2026).
- Pass 10 déplacements : **14 €** ; ce tarif ne doit pas être assimilé automatiquement à un prix unitaire payé pour une mission.
- Moins de 6 ans : gratuit, sous conditions d'âge et d'accompagnement ; ne pas appliquer au profil adulte.
- Les lignes 460/461 sont présentées comme lignes régulières par les sources officielles. Le barème est une référence réseau, pas une preuve d'achat, d'éligibilité à un titre ni de circulation du service demandé.

Source des horaires en vigueur : https://www.proximiti.fr/vos-deplacements/horaires-a-telecharger/ (modifications annoncées au 24 août 2026).

**Règle de raccordement :** n'afficher le ticket à 1,70 € comme tarif de référence que pour un trajet intégralement couvert par les conditions officielles du ticket. Si le trajet traverse plusieurs réseaux, ne jamais présumer une interopérabilité tarifaire. Ne jamais confondre ce barème avec une réservation confirmée sur la ligne 460.

## Rectification importante : arrêts systématiques et sur demande (10 novembre 2026)

La page officielle https://www.proximiti.fr/vos-deplacements/horaires-a-telecharger/ distingue les **arrêts systématiques** et les **arrêts sur demande** pour les lignes 460/461. Le délai de **2 heures** concerne l'enregistrement d'une demande d'arrêt sur la ligne 460, et ne prouve pas que chaque montée à un arrêt systématique exige une réservation. La formulation antérieure « ligne 460 sur réservation » est donc trop générale.

Règles d'intégration à retenir :

- Si arrêt de montée ou descente **sur demande** pour la ligne 460 : vérifier enregistrement au moins 2 h avant, et sa confirmation ; sans cela, trajet non confirmé.
- Si les deux arrêts sont **systématiques** : ne pas imposer automatiquement une réservation, mais vérifier la course, les jours de circulation et la desserte à l'heure demandée.
- Pour la ligne 461, ne pas déduire de « sans réservation » que **tous les arrêts** sont systématiques ; vérifier le type d'arrêt sur la fiche horaire.
- La grille officielle est https://www.proximiti.fr/wp-content/uploads/2025/12/horaire-46x-web.pdf, liée depuis la page horaires de l'opérateur. Les périodes vertes/oranges et les colonnes de course nécessitent une lecture structurée avant tout horaire en production.
- Ne jamais générer une correspondance « réalisable » sur la seule base du barème à 1,70 € ou d'une fiche horaire théorique.

Cette rectification prévaut sur les mentions simplifiées précédentes du présent dossier.

## Correction sur pièce : PDF horaire 460/461

Source primaire : https://www.proximiti.fr/wp-content/uploads/2025/12/horaire-46x-web.pdf (lien depuis la page horaires officielle, consultée le 10 novembre 2026).

Le PDF précise explicitement :
- **460** : enregistrement des arrêts sur demande jusqu'à **2 heures avant** le départ.
- **461** : enregistrement des arrêts sur demande jusqu'à **5 minutes avant** le départ.
- L'enregistrement est **obligatoire** pour les départs d'arrêts sur demande **ou** pour les connexions garanties sur demande ; il est seulement **recommandé** pour les autres trajets.

La mention antérieure « 461 sans réservation » doit donc être comprise uniquement pour les arrêts systématiques hors connexion garantie sur demande. Ne pas afficher la 461 comme systématiquement dispensée d'enregistrement.

**Priorité d'implémentation :** associer à chaque arrêt le caractère systématique / sur demande et, séparément, aux correspondances le caractère « garantie sur demande ». Si l'une de ces informations manque, conserver « Transport non confirmé — vérifiez vous-même ». Ne pas transformer ces délais en preuve de service disponible.

## Audit de cohérence des délais — 10 novembre 2026

Deux publications **du même exploitant** ne donnent pas une règle universelle identique :

- La [fiche horaire spécifique 460/461](https://www.proximiti.fr/wp-content/uploads/2025/12/horaire-46x-web.pdf) mentionne 2 h pour la 460 et 5 min pour la 461.
- La [page générale des horaires, actualisée le 29 septembre 2026](https://www.proximiti.fr/vos-deplacements/horaires-a-telecharger/) annonce 30 min pour les lignes ordinaires et 2 h pour 450/460/470. La [page générale Bus](https://www.proximiti.fr/nos-solutions/bus/) parle aussi d'une exception générale pour les lignes 4XX.

**Décision prudente :** ne pas transformer automatiquement le délai de 5 min de la fiche 461 en garantie opérationnelle de réservation pour une mission. Il faut vérifier dans Bus CheckIn la course, l'arrêt et l'heure limite effectivement proposée. À défaut de confirmation, le transport reste non confirmé. Les délais sont des informations documentaires, non des réservations.

La [CCVT](https://www.ccvt.fr/vie-pratique/mobilites-transport/lignes-regulieres) décrit la 461 comme sans réservation pour ses trajets habituels, mais la fiche opérateur exige un enregistrement pour les arrêts sur demande ou les connexions garanties sur demande. Le type d'arrêt prime sur une simplification à l'échelle de la ligne.
