# Relais de lecture du flux opérateur

## Résultat et limites

Le relais `server/transport-realtime-relay.cjs` résout localement le blocage CORS du flux public BlaBlaCar Bus. Un Chromium a réellement lu la réponse officielle à travers deux origines HTTP locales distinctes : **4 389 ms au premier appel, 12 ms au second**, une seule requête à l'opérateur et 388 courses dans la réponse du 31 octobre 2026 à 08:25:15 UTC. Le certificat HTTPS opérateur a été vérifié normalement ; aucun contournement TLS et aucune simulation réseau dans ce contrôle précis. Rapport : `validation-transport-relay-live-2026-10-31.json`.

Ce résultat ne constitue pas un déploiement distant ni une validation sur téléphone Android. L'application publique conserve son accès direct tant qu'une URL de relais autorisé n'est pas configurée. Aucun serveur, compte, service payant ou nouvelle ressource Cloud n'a été activé. Les coûts d'un hébergement distant restent à vérifier avant toute activation ; aucune gratuité n'est présumée à partir du seul réglage des instances.

## Périmètre du serveur

Le serveur lit **uniquement** `https://open-data.bus.blablacar.com/api/siri-lite/estimated-timetable`. Il ne reçoit ni clé TripGo, ni adresse, ni coordonnée de mission. Les cookies et en-têtes d'authentification des appelants ne sont jamais transmis à l'opérateur. Il n'accepte aucune URL en paramètre, refuse les paramètres de requête et les redirections amont, et n'expose aucune méthode d'écriture.

Routes :

| Route | Fonction |
|---|---|
| `GET /transport-realtime/blablacar` | Flux public validé, sans modification des dates du producteur |
| `HEAD /transport-realtime/blablacar` | Même contrôle de disponibilité, sans corps |
| `GET /health` | Processus démarré ; ne consulte pas le fournisseur et ne certifie pas son état |
| `OPTIONS` | Précontrôle CORS pour les origines autorisées |

Les origines du navigateur sont explicitement autorisées par `TRANSPORT_ALLOWED_ORIGINS`, séparées par des virgules. Une origine inconnue est refusée ; aucun `*` ni identifiant de session n'est nécessaire. L'absence d'origine permet les clients HTTP et les contrôles locaux : cette liste CORS n'est pas une authentification du service public.

Le relais mutualise les téléchargements et garde le flux en mémoire au plus 15 secondes, toujours dans la validité du producteur. Il refuse une source expirée ou future au-delà de la tolérance du contrôleur ; il ne remplace jamais sa date par l'heure de réception. Une erreur ne sert pas une ancienne preuve expirée et suspend les nouvelles requêtes amont pendant 30 secondes. Limites : huit secondes de téléchargement, 2,5 Mo, contrôles SIRI existants et 120 lectures par minute et par processus, réponses en `no-store`. Ces bornes ne constituent pas une garantie de coût d'hébergement.

## Exécution locale

Node 24 est prévu par le conteneur ; aucun paquet npm de production n'est requis.

```sh
TRANSPORT_ALLOWED_ORIGINS=https://at374.github.io PORT=8080 node server/transport-realtime-relay.cjs
```

La liste doit correspondre à l'origine effective de l'application. L'origine de la WebView Android doit encore être vérifiée sur l'appareil ; une origine `null` n'est pas autorisée par défaut.

Pour construire et exécuter le conteneur **localement**, sans publication :

```sh
docker build -f server/Dockerfile.transport-realtime -t convoyage-transport-relay:test .
docker run --rm -p 8080:8080 -e TRANSPORT_ALLOWED_ORIGINS=https://at374.github.io convoyage-transport-relay:test
```

Le contexte de construction ne conserve que les fichiers nécessaires. Le conteneur utilise un utilisateur non privilégié et respecte `PORT`. Ces commandes ne créent ni registre distant ni déploiement. Le workflow dédié construit l'image et contrôle `/health`, sans appeler l'opérateur.

## Branchement de l'application

Après vérification d'une URL d'hébergement autorisée, définir **avant `app.js`** :

```js
window.CP_BLABLACAR_REALTIME_URL = 'https://relais.example.invalid/transport-realtime/blablacar';
```

L'exemple est volontairement non fonctionnel ; aucune URL distante n'est activée dans le dépôt. HTTPS est obligatoire, sauf pour une boucle locale de développement. Les URL avec identifiants, paramètres, fragments ou autre chemin sont refusées. Une configuration invalide ne bloque pas SNCF, GTFS, TripGo ou les autres résultats. Le délai client passe à dix secondes pour laisser au relais ses huit secondes de traitement.

La réponse garde l'horodatage et la validité du fournisseur. Le contrôleur vérifie toujours la course, les arrêts, les heures absolues, les prévisions, les annulations et l'expiration avant d'afficher une observation. Le relais n'attribue aucun tarif ni aucune confirmation d'accès physique.

## Validation

- Sept tests HTTP supplémentaires : origines/méthodes/chemins, refus des URL arbitraires, mutualisation, absence de transmission des clés/cookies, refus des sources expirées/invalides/trop grandes, délai et limitation de requêtes, véritable client via le relais local.
- **171 tests JavaScript et 2 tests Python réussis localement.**
- Parcours Agenda Chromium Pixel 7 : vraie requête HTTP vers le relais sur une autre origine locale, CORS appliqué par le navigateur, flux amont enregistré, observation puis expiration. Aucun appel du relais n'est simulé par Playwright ; seule sa source opérateur est remplacée dans ce test reproductible.
- Contrôle réel séparé : navigateur → relais local → flux officiel HTTPS actuel, sans simulation de l'amont, validation TLS active et aucune clé/cookie reçu par le relais.
- Aucun appareil Android testé. Le conteneur n'a pas été construit dans l'environnement local, où Docker est indisponible ; son résultat de construction est à consulter dans GitHub Actions.
