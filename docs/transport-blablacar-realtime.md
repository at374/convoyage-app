# Vérification opérateur BlaBlaCar Bus dans l'Agenda

## Raccordement

`transport-blablacar-realtime.js` interroge le flux public SIRI-LITE de BlaBlaCar Bus lorsqu'une proposition TripGo fournit les identifiants nécessaires. Aucune clé ni coordonnée de mission n'est envoyée à cette source : une même réponse publique sert aux propositions du panneau.

La comparaison exige le numéro de service, les codes des arrêts de montée et descente et leurs **horaires théoriques absolus**. Un libellé de ville ou un identifiant réutilisé un autre jour ne suffit pas. Les heures absolues permettent aussi un passage de minuit sans assimiler automatiquement date civile et journée d'exploitation. Les versions contradictoires de même date de production sont déclarées ambiguës.

Une prévision n'est exploitable que si la source et sa version sont récentes, réussies et encore valides. `NO_REPORT`, l'absence d'heure attendue et les annulations sont distingués. Le délai de validité du producteur est respecté ; une source future de plus de 30 secondes ou vieille de plus de trois minutes n'établit pas une preuve actuelle. Les horaires et arrêts doivent toujours correspondre à la course recherchée.

Le module distingue **prévision opérateur** et **circulation observée**. Cette dernière exige notamment un départ réel déjà enregistré à un arrêt précédent de la même course, sans annulation signalée sur la course ou les arrêts utilisés. `serviceConfirmed` décrit cette observation actuelle uniquement ; il ne certifie ni le trajet complet, ni l'accès physique, ni le prix. L'interface conserve séparément les perturbations éventuelles parmi les preuves manquantes : observer le véhicule n'établit pas l'absence de toute perturbation.

## Heure à l'adresse et minimum de cinq minutes

Pour une proposition comprenant un seul car et des marches avant/après, les prévisions opérateur sont combinées aux durées piétonnes déjà fournies. Le module contrôle le départ accessible après la mission et l'arrivée après la marche finale. La limite d'arrivée transmise par l'Agenda inclut déjà les cinq minutes avant prise en charge ; elle n'est pas soustraite deux fois. Exactement 5:00 est accepté, 4:59 est rejeté. Pour plusieurs véhicules ou un parcours incomplet, le résultat reste partiel : aucune correspondance n'est réinventée.

Une annulation est mise en évidence et le trajet est signalé comme à exclure avant actualisation. L'observation périme à `validUntil` : son affichage devient expiré et la circulation revient parmi les preuves manquantes. Le minuteur est annulé à la fermeture ou au remplacement de la section.

## Preuve enregistrée

Les deux fixtures conservent, sans modification des données de la course retenue, une réponse réelle TripGo du **31 octobre 2026** et la course publique SIRI `51981:2026-10-31`. À l'instant historique de test **07:49:30 UTC**, la source est encore valide : départ réel précédemment observé à Chamonix à 07:09:37 UTC, montée prévue à Annecy à 09:15 UTC, arrivée théorique à Grenoble à 10:40 UTC, prévision à 10:42 UTC.

La marche de sortie de 154 secondes donne une arrivée estimée au point demandé à **10:44:34 UTC**, affichée prudemment **11 h 45, heure de Paris**. Le contrôle d'une mission fictive à 11:49:34 accepte les cinq minutes restantes ; une seconde supplémentaire de retard fait rejeter la marge. La même course du 2 novembre ne récupère pas l'observation du 31 octobre.

Ce sont des relectures de données enregistrées et des missions fictives. Elles ne constituent pas une confirmation actuelle de ces transports. Le rapport `validation-blablacar-realtime-2026-10-31.json` distingue le contrôle HTTP réel, le rejeu et le navigateur mobile.

## Limite d'accès actuelle

Le flux officiel a de nouveau répondu HTTP 200 le 31 octobre à 08:05:51 UTC. Il était âgé de 0,66 seconde à réception, valide pendant une minute, et contenait 388 courses. **Aucun en-tête autorisant l'origine GitHub Pages n'a été retourné.** La lecture directe depuis un navigateur reste donc bloquée par CORS. Le client essaie la vérification et signale l'indisponibilité sans effacer les autres propositions ; aucun relais non autorisé n'est utilisé.

Le catalogue du PAN référence le même flux, sans URL de proxy. La documentation officielle du proxy PAN réserve ce mécanisme au protobuf GTFS-RT, pas au JSON SIRI-LITE. Aucun serveur n'est créé ou déployé dans ce lot. La validation positive de l'interface utilise une réponse réseau simulée reproduisant le flux enregistré ; elle n'est pas présentée comme un accès temps réel fonctionnel sur Android.

## Bornes et tests

- Téléchargements partagés entre consommateurs, annulés lorsque le dernier disparaît ; délai de huit secondes.
- Réponse lue par flux, maximum 2,5 Mo, 5 000 courses et 50 000 passages. Cache au maximum 30 secondes et jamais utilisé pour confirmer une donnée expirée ; erreurs et sources périmées retenues 30 secondes pour éviter des relances répétées.
- Dix tests dédiés : rapprochement exact, autre date/arrêt/course/heure, validité, annulation, absence de signal, prévision seule, retard après marche, versions ambiguës, partage/annulation, expiration du cache et limites de taille.
- **164 tests JavaScript et 2 tests Python réussis localement.** Le navigateur Chromium mobile rejoue la source indisponible, l'observation opérateur du bon jour, la marche finale et l'expiration automatique. Aucun appareil Android testé.

Sources :
- https://open-data.bus.blablacar.com/api/siri-lite/estimated-timetable
- https://www.data.gouv.fr/datasets/blablacar-bus-horaires-theoriques-et-temps-reel-du-reseau-europeen
- https://normes.transport.data.gouv.fr/normes/siri/profil-france/
- https://doc.transport.data.gouv.fr/type-donnees/operateurs-de-transport-regulier-de-personnes/administration-des-donnees-transport-collectif/publier-des-donnees-temps-reel/serveur-proxy-gtfs-rt
