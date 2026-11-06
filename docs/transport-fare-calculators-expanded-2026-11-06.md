# Calculateurs tarifaires — complément national et Suisse du 6 novembre 2026

## Critère de réussite produit

Pour chaque trajet trouvé : montant complet, devise, tarif et profil voyageur, date/heure de recherche, trajet exact et frais connus. Couvrir les petites lignes et les portions d’approche, jonction et retour. Les offres d’un même transporteur peuvent différer selon le vendeur et ses frais. Une source simplement listée n’est pas raccordée. Une couverture complète ne peut être déclarée tant qu’il reste des portions sans prix ou des réseaux non contrôlés.

L’audit principal `transport-sources-audit-2026-11-05.md` contient déjà TripGo, SNCF Connect, FlixBus, BlaBlaCar Bus/covoiturage, Trainline, Omio, Tictactrip, Distribusion, Google, TPG et Léman Pass. Ce complément ajoute les pistes suivantes sans prétendre qu’elles sont toutes accessibles automatiquement.

## Sources complémentaires réellement identifiées

| Calculateur/source | Rôle tarifaire documenté | Récupération automatique : état réel | Source officielle |
|---|---|---|---|
| CFF Swiss Mobility API / Affiliate | Horaires et offres via plateformes partenaires suisses | Portail développeur et accès à qualifier ; aucune clé ni couverture de vente démontrée ici | https://company.sbb.ch/fr/offres/services/swiss-mobility-solutions/api.html et https://company.sbb.ch/fr/offres/services/swiss-mobility-solutions/affiliate.html |
| OSDM Offline suisse | Sous-ensemble tarifaire publié, présenté comme bêta | Candidat de données structurées ; ce sous-ensemble ne couvre pas tous les tarifs suisses | https://data.opentransportdata.swiss/fr/dataset/osdm-offline |
| Busbud | Inventaire bus et train interurbain, disponibilités et prix | API de distribution partenaire ; accès à obtenir, distinct d’un simple lien d’affiliation | https://www.busbud.com/fr/distribution |
| Altibus | Cars, gares/aéroports et stations, notamment Savoie/Haute-Savoie | Tarifs dans le tunnel de recherche ; accès automatisé non démontré, frais propres aux offres à conserver | https://www.altibus.com/foire-aux-questions/ |
| Kombo | Comparaison et vente train/bus, offres et frais selon opérateur | Site public identifié ; pas d’API autorisée obtenue. Ses CGV demandent une autorisation écrite pour scraping/API directe | https://www.kombo.co/fr/cgv et https://www.kombo.co/fr/faq |
| FAIRTIQ | Calcul du bon tarif et plafonds sur réseaux partenaires après reconnaissance du déplacement | Ne pas présenter comme devis universel avant voyage ; couverture et accès tiers à vérifier | https://fairtiq.com/fr/comment-utiliser-fairtiq et https://fairtiq.com/fr/rayon-de-validite |
| CheckMyBus | Métarecherche d’offres bus, intégrations partenaires | Le service reçoit des prix de partenaires ; cela ne prouve pas l’accès de Convoyage Ultra à une API sortante. Devises et cache peuvent créer des écarts | https://www.checkmybus.fr/a-propos/qui-sommes-nous et https://www.checkmybus.fr/a-propos/methodologie |
| ComparaBUS | Comparaison bus/train/covoiturage | Site et programme partenaire identifiés ; protocole de prix et accès automatique non validés | https://www.comparabus.com/fr/faq/comparabus-comparateur-bus et https://www.comparabus.com/fr/devenir-partenaire |
| KelBillet | Comparaison train/bus/covoiturage, billets neufs et occasion | Site identifié ; aucun accès API/prix automatique validé. Ne pas mélanger revente et billet neuf sans conditions | https://kelbillet.com/ |
| Île-de-France Mobilités — titres et tarifs | Catalogue structuré des titres/prix locaux | Candidat public à parser avec règles et conditions ; un catalogue de titres n’est pas seul un prix de trajet complet | https://data.iledefrance-mobilites.fr/explore/dataset/titres-et-tarifs/table/ |

## Autres sources officielles à ajouter au rapprochement tarifaire

- Grilles Y62/Y63 à compter du 1er mars 2026 : https://www.alpbus-mobilites.fr/nouvelle-tarification-ligne-y6263. Le calcul utilise une matrice des communes puis des zones ; ne pas appliquer une somme ou une zone choisie approximativement.
- Haute-Savoie : https://www.laregionvoustransporte.fr/cars-region/cars-region-de-haute-savoie/infos-et-services-cars-region-de-haute-savoie/titres-et-tarifs-de-haute-savoie/.
- Savoie : https://www.laregionvoustransporte.fr/cars-region/cars-region-de-la-savoie/infos-et-services-cars-region-de-la-savoie/titres-et-tarifs-de-savoie/. Vérifier les exceptions de lignes et la date d’effet avant d’utiliser un tarif général.
- TAC Annemasse : https://www.tac-mobilites.fr/nos-tarifs/guide-des-tarifs.
- Ondéa Grand Lac : https://www.ondeagrandlac.fr/tarifs/choisir-son-titre.
- SNCF fourchettes TGV/OUIGO : https://ressources.data.sncf.com/explore/dataset/tarifs-tgv-inoui-ouigo/export/. Ce sont des bornes tarifaires, pas le prix disponible pour un train à une date précise.
- Le profil NeTEx France présente aussi des modèles tarifaires TER : https://normes.transport.data.gouv.fr/normes/netex/tarifs/. Une formule kilométrique nationale ne remplace pas les conditions et tarifs régionaux applicables.

## Contrôle technique Léman Pass et état de livraison

L’essai GET du calculateur avec l’en-tête `Origin: https://at374.github.io` a renvoyé une réponse HTTP 200 contenant les tarifs, sans en-tête `Access-Control-Allow-Origin` dans la réponse observée le 6 novembre 2026 à 05:30:54 UTC. Le navigateur de l’application ne peut donc pas lire directement cette réponse interorigine dans cette configuration. Un relais adapté ou une interface officiellement compatible est nécessaire ; ne pas activer un accès automatique Android présenté comme fonctionnel avant validation.

Le lecteur Léman Pass ajouté à la PR #208 est testé sur un résultat réel et traite séparément les prix EUR/CHF, classes et parcours. Il ne fait pas encore partie du parcours Android. Les autres sources de ce document sont des candidats documentés, sans nouvelle connexion annoncée.

## Contrôle de couverture à poursuivre

Croiser les sources de vente avec l’inventaire des 509 jeux horaires GTFS/NeTEx ; travailler par réseau et portion, pas seulement par nom de comparateur. Pour chaque portion, garder séparément source trouvée, accès autorisé/configuré, requête réussie, couverture tarifaire vérifiée, affichage Android testé. Plusieurs comparateurs peuvent dépendre du même inventaire et laisser les mêmes petites lignes sans tarif.

Les sources commerciales doivent retourner la bonne date, les arrêts, le profil voyageur, les frais et la disponibilité. Pour les réseaux locaux, valider zones, correspondances, validité des titres et abonnements. Ne jamais remplacer un prix manquant par zéro, une fourchette basse ou le tarif d’un autre parcours. Aucun partenaire n’a été contacté, aucun compte commercial ni service payant n’a été activé dans cette recherche.
