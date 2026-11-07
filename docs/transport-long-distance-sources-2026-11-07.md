# Cars longue distance — sources vérifiées France

Contrôle du 7 novembre 2026. Aucun prix n’est ajouté par ce document.

## BlaBlaCar Bus

Le Point d’Accès National publie le GTFS officiel du réseau européen BlaBlaCar Bus, actualisé quotidiennement. Au contrôle : ressource du 6 novembre 2026, valable du 6 novembre 2026 au 6 janvier 2027, taille 206,73 Ko. Le GTFS fournit horaires, arrêts et courses, mais aucune table tarifaire ; il ne peut donc pas établir un prix de billet.

- Dataset : https://transport.data.gouv.fr/datasets/blablacar-bus-horaires-theoriques-et-temps-reel-du-reseau-europeen
- Ressource GTFS : https://transport.data.gouv.fr/resources/52605
- Temps réel SIRI-Lite : même dataset

Le chargeur GTFS de Convoyage Ultra a chargé la ressource réelle pour le 7 novembre 2026. Elle est raccordée dans la PR #207 seulement pour les trajets à partir de 75 km à vol d’oiseau, afin de ne pas prendre la place d’un réseau local.

## FlixBus / FlixTrain

Le GTFS officiel est à jour au contrôle et couvre du 4 novembre 2026 au 4 mai 2027 ; il comprend FlixBus et FlixTrain, avec un flux GTFS-RT. L’archive pèse toutefois 29,5 Mo, au-dessus de la limite de téléchargement Android du chargeur GTFS (20 MiB). Son chargement direct est donc volontairement refusé.

- Dataset : https://transport.data.gouv.fr/datasets/flixbus-horaires-theoriques-du-reseau-europeen-1/
- Ressource GTFS : https://transport.data.gouv.fr/resources/11681
- Temps réel : https://transport.data.gouv.fr/resources/84253

FlixBus reste interrogeable par TripGo lorsqu’une clé locale est fournie, mais tout montant de cette réponse est un devis/estimation à actualiser ; il ne devient jamais un tarif officiel quotidien. Le GTFS-RT FlixBus présente en outre des incohérences de références d’arrêts signalées par le PAN : il ne doit pas seul confirmer une circulation.

Aucun déploiement, fusion, achat, compte externe ou modification de Supabase/auth/synchronisation n’est effectué.
