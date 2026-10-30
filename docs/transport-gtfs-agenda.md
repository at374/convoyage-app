# Raccordement GTFS à l’Agenda

`index.html` charge `transport-gtfs-worker-client.js` et `transport-gtfs-agenda.js` avant l’application. L’indexeur, le chargeur ZIP et le module horaire restent dans le worker, hors du thread d’interface. Le cache de l’interface comprend ces dépendances. Cette version est uniquement sur la branche de développement, sans fusion ni déploiement.

## Parcours

Dans la fiche, le bouton bleu Transports ouvre les détails existants et une section « Cars Région Haute-Savoie — horaires aux arrêts ». Le module utilise le flux officiel Oùra déjà employé par le workflow Y51 du dépôt, sans clé ni domaine à enregistrer. Un test HTTP avec `Origin: https://at374.github.io` a reçu `Access-Control-Allow-Origin: https://at374.github.io` ; cela ne valide pas tous les navigateurs ou autres origines.

Une enveloppe géographique indicative (45,4 à 46,5 N ; 5,7 à 7,1 E) sélectionne le réseau lorsque les deux points d’au moins un trajet s’y trouvent. Cette sélection ne prouve pas une couverture du trajet. Deux réseaux au maximum et un seul worker sont conservés par fiche ; Sibra est ajouté lorsqu’un point du trajet se trouve dans son enveloppe de sélection. Les autres calculateurs et les résultats Sibra, SNCF ou suisses existants restent consultables.

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

Le test visuel navigateur/Android reste à faire. Chromium n’est pas disponible dans l’environnement de test et son téléchargement n’a pas abouti. Aucune validation Android n’est revendiquée. Restent aussi les correspondances entre arrêts distincts et la fédération des réseaux, les chemins piétons réels, les prix, les preuves de circulation et la persistance hors ligne. Aucun changement Supabase, authentification ou synchronisation ; aucune action sur une plateforme de convoyage.

## Correspondance au même arrêt

Le worker expose désormais `missionJourneys`, qui réunit trajets directs et trajets avec une correspondance au même identifiant d’arrêt. Les deux véhicules doivent être des courses distinctes, actives le même jour de service GTFS. Les heures supérieures à 24 h restent possibles. Les changements entre deux jours de service différents, les marches entre quais/arrêts distincts et les enchaînements de véhicules liés ne sont pas déduits.

Pour les correspondances internes à un réseau, la recherche conserve seulement les premières branches depuis les arrêts proches de l’origine et les secondes branches vers les arrêts proches de la destination. Les départs du second véhicule sont indexés par arrêt et triés ; une recherche binaire trouve le début de la fenêtre de correspondance. Le minimum par défaut est de 5 min et l’intervalle maximal est de 120 min. Les règles `transfers.txt` applicables à l’arrêt ou à sa station parente, aux routes et aux courses sont examinées. Les interdictions sont retenues et les minima GTFS de type 2 sont respectés à la seconde près. En cas de règles générales/spécifiques contradictoires, la recherche applique toutes les interdictions et le plus grand minimum : comportement conservateur pouvant omettre une correspondance autorisée par une règle plus spécifique. La priorité complète des règles n’est pas implémentée.

Les transferts liés de type 4/5 ne sont pas proposés. Les montées ou descentes interdites (`pickup_type`/`drop_off_type` = 1), conditionnelles (2/3) ou non reconnues sont exclues, également dans la recherche directe. Aucun appel ou réservation n’est supposé acquis. Les horaires intermédiaires ne deviennent pas une preuve de circulation.

Budgets par recherche de jour de service : 50 000 branches conservées, 100 000 couples examinés, 5 000 correspondances produites au maximum. Si un budget est atteint, `searchTruncated` et `truncated` sont vrais ; l’Agenda signale l’affichage incomplet, même si le filtrage horaire ne conserve aucun résultat. Ces limites bornent les structures conservées et l’assemblage des couples, pas chaque opération du parcours CSV ou des horaires. Le délai du worker reste une borne supplémentaire par opération.

Les deux branches sont converties dans le fuseau de l’agence puis filtrées par la fenêtre de mission. Les bornes s’appliquent au premier départ et à l’arrivée finale ; les temps de liaison aux adresses ne sont pas inventés. Le résultat reste `transferVerified:false`, `accessVerified:false`, `serviceConfirmed:false`, `priceEUR:null`. L’Agenda affiche les deux lignes, les horaires de chaque branche, l’arrêt de changement (ouvrable sur carte) et l’intervalle théorique.

Validation : dix tests dédiés couvrent les règles et leurs restrictions, station parente, montées/descentes, calendriers, budget incomplet, comparaison avec une recherche exhaustive indépendante, conversion après minuit et précision à la seconde. Un test du véritable script worker et deux tests d’affichage Agenda vérifient le parcours à deux branches et la conservation des arrêts de changement alternatifs pour le même couple de courses.

Sur l’archive officielle téléchargée le 30 octobre (10 260 404 octets, 1 641 arrêts, 344 courses actives au 2 novembre), un test archive → véritable script worker en thread Node → Agenda avec DOM simulé retrouve une correspondance Y02 → Y04, Lycée J. Monnet, intervalle théorique 14 min, 06 h 05 → 07 h 45 le 2 novembre en heure de Paris. Aucun budget n’est atteint dans cet exemple. C’est un test entre coordonnées d’arrêts, pas une validation de mission réelle, d’accès piéton ou de circulation. Aucun test Android n’est revendiqué.

## Sibra et Cars Région : liaisons indicatives entre réseaux

Le panneau ajoute Sibra lorsque l’origine ou la destination se trouve dans l’enveloppe indicative du Grand Annecy (45,7 à 46,1 N ; 5,9 à 6,5 E) et que le trajet est sélectionné pour le réseau principal. Cette enveloppe ne constitue pas une déclaration de couverture. Le tableau `CP_GTFS_AGENDA_RESOURCES` permet toujours de remplacer les sources ou de désactiver la section ; un tableau contenant uniquement la source principale ne charge pas Sibra.

Avant le téléchargement Sibra, le worker relit le catalogue PAN avec revalidation HTTP, recherche le dataset `5bd9843e634f413220f7f04a` et choisit sa ressource GTFS HTTPS dont la date de mise à jour renseignée est la plus récente. L’identifiant 80100 sert de préférence seulement en cas de dates identiques. Le champ PAN `updated` est désormais reconnu ; le lien affiché est l’URL réellement sélectionnée. Le 30 octobre, le catalogue indiquait toujours l’archive du 1er octobre, valable jusqu’au 20 décembre. Le catalogue et l’archive statique Sibra ont répondu avec `Access-Control-Allow-Origin: *` aux tests HTTP ; cela ne constitue pas une validation Android.

`client.loadNetworks(resources, {indexServiceDates})` charge au maximum deux réseaux, séquentiellement, avec une liste explicite d’au plus sept jours de service. L’Agenda calcule cette union à partir des fenêtres des trois trajets. L’index retient seulement les courses des services actifs à ces dates. Après indexation, le worker conserve les textes d’agence, calendriers, transferts et métadonnées nécessaires, et libère les autres textes CSV. Les passages volontairement exclus sont comptés dans `skippedStopTimes`, distinctement des références rejetées. Une recherche hors du périmètre indexé produit une erreur explicite. Un réseau sans course pour ces dates est un résultat vide, pas une permission de réutiliser un ancien calendrier.

Si une source échoue, les autres résultats restent consultables et le panneau indique la recherche partielle. L’échec ou le délai global du worker peut néanmoins arrêter l’opération complète. Les données des missions restent dans la page et le worker ; seuls les téléchargements publics et le catalogue sont sollicités, sans identifiants.

Les identifiants de courses et d’arrêts restent propres à chaque réseau : des chaînes identiques dans deux flux ne sont pas fusionnées. Le moteur cherche les branches d’un premier réseau vers un arrêt situé à **150 m à vol d’oiseau au maximum** d’un arrêt de montée du second, dans les deux sens. Les bornes de mission sont comparées en timestamps absolus et un intervalle indicatif de 5 à 120 min filtre les candidats. Chaque paire utilise le même jour de service explicite ; les enchaînements entre jours de service différents restent à traiter.

Ce rapprochement n’est **pas un itinéraire piéton vérifié** : `walkingDurationSeconds:null`, `transferVerified:false`, `accessVerified:false`, `serviceConfirmed:false`, `priceEUR:null`. La distance ne devient jamais un temps de marche. Les règles `transfers.txt` internes à un flux ne sont pas présentées comme des règles officielles entre les deux réseaux ; cette liaison ne prouve aucun accès physique ou droit de passage. Les restrictions de montée/descente de chaque branche restent appliquées. Le panneau affiche les deux noms d’arrêts, leurs deux liens cartographiques, les réseaux, lignes, horaires et l’intervalle théorique.

Budgets de la fédération par jour : 20 000 branches retenues par réseau, 1 000 recherches d’arrêts de jonction, 50 000 couples examinés et 2 000 liaisons produites. Les dépassements remontent via `searchTruncated` et `truncated`. Les budgets des recherches internes à un réseau restent distincts ; le délai global du client demeure de 45 s par opération.

Validation du 30 octobre : le parcours archives officielles + instantané du catalogue → véritable script worker en thread Node → Agenda avec DOM simulé retrouve Sibra **ligne 1 → Y51**, POISY COLLEGE → École Saint-François, le 2 novembre, départ 05 h 40 et arrivée 07 h 38 heure de Paris. Changement GARE QUAI SUD → Gare Routière, séparation à vol d’oiseau 129 m, intervalle théorique 13 min. Aucun temps de marche ni circulation réelle n’est confirmé. Ce test entre coordonnées d’arrêts ne valide pas une mission réelle de l’utilisateur.

Mesure mémoire isolée sur la même archive Sibra, dans deux processus Node : index complet 550 167 passages / 18 597 courses / pic RSS 350 Mio ; index du 1er au 3 novembre 60 275 passages / 2 034 courses / pic RSS 203 Mio. Les textes sources conservés passent de 40 371 050 à 3 007 octets. Une seule mesure par mode, aucune extrapolation à Android ni garantie pour d’autres réseaux. Les données chiffrées et SHA-256 sont conservées dans `validation-gtfs-federation-2026-10-30.json`.
