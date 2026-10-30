# Raccordement GTFS à l’Agenda

`index.html` charge `transport-gtfs-worker-client.js` et `transport-gtfs-agenda.js` avant l’application. L’indexeur, le chargeur ZIP et le module horaire restent dans le worker, hors du thread d’interface. Le cache de l’interface comprend ces dépendances. Cette version est uniquement sur la branche de développement, sans fusion ni déploiement.

## Parcours

Dans la fiche, le bouton bleu Transports ouvre les détails existants et une section « Cars Région Haute-Savoie — horaires aux arrêts ». Le module utilise le flux officiel Oùra déjà employé par le workflow Y51 du dépôt, sans clé ni domaine à enregistrer. Un test HTTP avec `Origin: https://at374.github.io` a reçu `Access-Control-Allow-Origin: https://at374.github.io` ; cela ne valide pas tous les navigateurs ou autres origines.

Une enveloppe géographique indicative (45,4 à 46,5 N ; 5,7 à 7,1 E) sélectionne le réseau lorsque les deux points d’au moins un trajet s’y trouvent. Cette sélection ne prouve pas une couverture du trajet. Un seul réseau et un seul worker sont conservés par fiche. Les autres calculateurs et les résultats Sibra, SNCF ou suisses existants restent consultables.

- **Aller** : point de domicile enregistré vers coordonnées GPS/adresse du départ ; arrivée aux arrêts avant la prise en charge moins 30 min. Le point de domicile n’est pas une certification de l’adresse exacte.
- **Retour** : coordonnées de livraison vers domicile, départ après la fin de livraison retenue dans la fiche.
- **Jonction** : livraison vers prise en charge de la prochaine mission, après livraison et avant prise en charge moins 30 min.

Une fenêtre sans borne de départ commence 24 h avant la prise en charge. Une fenêtre sans borne d’arrivée termine 24 h après livraison. Une fenêtre plus longue est limitée à 48 h. Le jour de service précédent et chaque jour civil de la fenêtre, dans le fuseau du réseau, sont interrogés. Ce périmètre est affiché ; les courses de jours de service plus anciens avec de très grandes valeurs GTFS ne constituent pas une couverture garantie.

Une lecture du flux sert aux trois recherches. Les téléchargements GTFS demandent une revalidation HTTP (`cache: no-cache`), sans identifiants ni données des missions. Le bilan affiche la date de téléchargement ; la date de mise à jour du producteur n’est pas inventée. Les doublons sont retirés et cinq propositions au maximum sont montrées par trajet. Une recherche tronquée est signalée ; les résultats Aller sont affichés du départ le plus tardif au plus ancien parmi les candidats récupérés. Aucun classement par prix n’est déduit d’un tarif inconnu.

Les arrêts portent leurs coordonnées et leur description GTFS éventuelle. Chaque arrêt peut être ouvert sur la carte à ses coordonnées. La description n’est pas présentée comme une adresse postale vérifiée. Les distances d’accès sont à vol d’oiseau, aucun temps de marche n’est inventé. Les prix restent inconnus et tous les résultats portent « Transport non confirmé — vérifiez vous-même ».

## Cycle de vie

Fermeture par croix, fond de dialogue ou Échap, masquage du panneau, changement de mission et actualisation terminent le worker et rejettent ses opérations en attente. Un observateur couvre aussi le retrait du panneau et le masquage de la fiche. Les anciennes réponses ne repeuplent pas la nouvelle section.

Le géocodage des deux adresses est parallèle et les requêtes identiques en cours sont mutualisées. Chaque coordonnée reçue actualise uniquement la section GTFS de la fiche encore visible, sans effacer la saisie de livraison prévue ni les autres blocs de transports. Le géocodage de la prochaine mission peut déclencher la Jonction de la même manière. Un échec d’adresse ou de trajet ne bloque pas les autres recherches.

## Validation et limites

Huit tests supplémentaires couvrent la sélection des sources, les fenêtres et jours voisins, le chargement partagé, les réponses tardives après fermeture, les erreurs indépendantes, le texte des résultats, le géocodage concurrent et l’appel réel de l’Agenda vers le module.

Le 30 octobre 2026, l’archive officielle de 10 260 404 octets a été retéléchargée. Test de bout en bout : archive officielle → véritable script worker dans un thread Node séparé → module Agenda avec DOM simulé. Les 1 641 arrêts sont chargés et les propositions Y51 du 2 novembre sont affichées avec leurs indicateurs non confirmés. Le test utilise des coordonnées d’arrêts officiels, pas une mission réelle de l’utilisateur.

Le test visuel navigateur/Android reste à faire. Chromium n’est pas disponible dans l’environnement de test et son téléchargement n’a pas abouti. Aucune validation Android n’est revendiquée. Restent aussi les correspondances et la fédération des réseaux, les chemins piétons réels, les prix, les preuves de circulation et la persistance hors ligne. Aucun changement Supabase, authentification ou synchronisation ; aucune action sur une plateforme de convoyage.
