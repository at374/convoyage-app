# TripGo : transports interurbains et preuves disponibles

## Fonctionnement dans l'Agenda

`transport-tripgo.js` complète les calculateurs existants pour Aller, Jonction et Retour. Chaque recherche démarre indépendamment après l'arrivée des coordonnées précises. La prise en charge conserve le minimum de **5 minutes au point GPS exact, marche finale comprise**. Les réponses sont liées aux coordonnées et à l'heure demandées ; un résultat antérieur au départ demandé ou après la limite d'arrivée est exclu, même si TripGo le renvoie dans son groupe de propositions.

La clé privée s'enregistre dans le panneau Transports **sur l'appareil seulement**, dans `localStorage`, avec un champ masqué et un bouton de retrait. Elle n'est incluse ni dans une URL ni dans le dépôt, les missions, Supabase ou ses réglages. Elle est transmise uniquement à `https://api.tripgo.com/v1/routing.json` par l'en-tête `X-TripGo-Key`. L'application ne crée aucun compte, abonnement ou service payant. Sans clé enregistrée, les autres moteurs restent disponibles. La clé fournie dans la conversation n'est pas intégrée au code public : elle devra être enregistrée sur l'appareil lors de la validation de cette version.

Les trois recherches sont parallèles. Une réponse validée reste en cache mémoire 60 secondes ; « Actualiser maintenant » force une nouvelle requête. Le cache est limité à 32 entrées. Les requêtes sont annulées lorsque leurs coordonnées changent, que la clé est retirée ou que la fiche est fermée/remplacée. Délai maximal : 15 secondes, réponse lue par flux et limitée à 2 Mo, limites de groupes/courses/segments. Le fournisseur peut rester lent : les essais réels ne sont pas instantanés. Les autres moteurs affichent leurs résultats indépendamment.

## Vérifications réelles du 31 octobre

Le contrôle de santé authentifié a réussi. La liste des régions publiée par TripGo annonce notamment Albertville, Chambéry, Grenoble, Lyon, Saint-Étienne, Genève et Vaud ; cela ne prouve pas une couverture exhaustive de l'AURA ou de la France.

Avec des coordonnées publiques près des gares d'Annecy et de Grenoble, pour le **2 novembre 2026 après 10 h**, une réponse réelle a fourni des groupes comprenant FlixBus et BlaBlaCar Bus, avec approche et sortie à pied. Le rejeu enregistré conserve trois des sept propositions afin de vérifier aussi l'exclusion d'un départ déjà passé :

- BlaBlaCar Bus : parcours avec marches **10 h 14 min 18 s → 11 h 42 min 34 s** ;
- FlixBus 1789 : parcours avec marches **12 h 07 min 50 s → 14 h 07 min 34 s**.

Une autre requête réelle demandant une arrivée avant 15 h 55 retrouve notamment K21 Annecy → Grenoble, avec sa sortie à pied. Les résultats sont dans `validation-tripgo-2026-10-31.json`. Latences observées isolément : 9,36 s pour le premier appel HTTP, 5,75 s pour la recherche par arrivée et 12,289 s pour un appel Chromium via le proxy de l'environnement. Aucune extrapolation de ces mesures à Android.

Le précontrôle CORS accepte GET et `X-TripGo-Key`. La réponse réelle avec origine GitHub Pages autorise `*`. Un Chromium a pu lire la réponse réelle ; ce diagnostic local a nécessité le proxy de l'environnement et l'ignorance des erreurs de certificat pour isoler CORS. Aucun contournement TLS n'est ajouté au produit ; ce diagnostic n'est ni une validation du TLS de production ni un test Android.

## Ce que les réponses prouvent et ce qui manque

Les modèles et références de segments sont réunis avant validation. Les temps doivent se suivre, être cohérents avec le départ et l'arrivée du trajet et respecter la fenêtre de mission. Les coordonnées d'extrémité sont comparées au point demandé ; les écarts supérieurs à 50 m sont exclus et ceux au-delà de 10 m restent à vérifier. Les transports privés/scolaires et les bateaux ne sont pas acceptés par cet adaptateur. Les alertes fournies sont conservées et affichées.

Les essais ont fourni des horaires et des marches calculées, **aucun tarif de bus ni signal temps réel confirmant la circulation**. `availability: AVAILABLE` n'est pas assimilé à une réservation ou à une confirmation opérationnelle. Les coûts nuls des segments piétons ne deviennent jamais le prix du bus. `priceEUR` reste inconnu, les indicateurs de circulation et d'accès réel restent non confirmés. Un raccordement géométrique de quelques mètres ne certifie pas l'ouverture d'une entrée ou son accès physique.

Chaque proposition indique donc ses preuves manquantes : circulation/perturbations à la date du trajet, accès physique au point GPS exact et prix. Ces données devront être recherchées dans les sources opérateurs appropriées ; elles ne sont pas fabriquées pour supprimer le statut. Le module n'établit pas une couverture exhaustive ni la disponibilité de BlaBlaCar covoiturage ; les réponses observées concernent **BlaBlaCar Bus**.

## Tests

Six tests dédiés couvrent les modèles/références, faux rapprochements de requête, horaires déjà passés, limites de mission, écarts GPS, modes, clés en en-tête seulement, cache, annulation, alertes, dates impossibles et limites de réponse. L'Agenda réel est aussi exécuté dans Chromium mobile avec une clé fictive : saisie, activation, géocodage tardif, rendu BlaBlaCar Bus/FlixBus, preuves manquantes et retrait de la clé. Les requêtes externes de ce parcours sont simulées ; les réponses TripGo enregistrées proviennent des appels réels ci-dessus.

Validation locale : **154 tests JavaScript et 2 tests Python réussis**, plus le parcours navigateur. Aucun appareil Android testé. La PR reste en brouillon, sans fusion ni déploiement. Références techniques : https://developer.tripgo.com/ et https://developer.tripgo.com/faq/ .
