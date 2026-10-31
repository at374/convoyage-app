# SNCF : reprise après géocodage dans l'Agenda

## Problème et correction

Le catalogue SNCF publié contient deux gares portant exactement le nom « Grenoble », avec des identifiants distincts. La recherche sans coordonnées refuse de choisir arbitrairement. L'ancien bloc SNCF ne réévaluait pas la recherche lorsque les coordonnées arrivaient après l'ouverture des Transports.

Aller, Jonction et Retour SNCF utilisent désormais les mêmes sections actualisables que le calculateur régional. Chaque section compare ses communes, coordonnées, horaires et limite d'arrivée. Une coordonnée nouvelle relance seulement les recherches concernées ; un libellé sans effet ne relance rien. Le domicile est relu au moment du calcul. Les requêtes précédentes sont annulées et leurs anciennes réponses ignorées, y compris après masquage de la fiche.

Pour la Jonction, `latestArrival` est transmis au moteur avec la marge déjà déduite. Les branches arrivant après cette limite sont exclues avant la limite de résultats. La régression contient douze départs précoces arrivant trop tard et un départ plus tardif qui arrive dans la fenêtre : celui-ci n'est plus perdu par la limitation initiale.

Les téléchargements d'un même jour restent mutualisés. Annuler un consommateur préserve les autres ; la dernière annulation coupe le téléchargement. Une réponse arrivant après annulation n'alimente pas le cache. Le manifeste est toujours relu avec `no-cache` ; les index restent liés aux empreintes annoncées et le délai réseau de huit secondes est conservé. Adresses et coordonnées ne sont pas envoyées à un calculateur SNCF : elles servent au choix local des gares.

## Résultats datés

Rejeu des fichiers officiels SNCF déjà publiés dans le dépôt, version producteur **2026-10-29**, archive SHA-256 `c5c122aebd4aba12f40efad01669885a163b54c09bada701395f36ab246cebd3`. Les empreintes des fichiers journaliers ont été revérifiées. Ce lot n'a pas téléchargé une nouvelle archive ni étendu les dates publiées.

Le **2 novembre 2026**, pour une arrivée en gare avant 15 h 30, le moteur retourne notamment **K21 Annecy 13 h 43 → Grenoble 15 h 26**, direct. Une prise en charge fictive à 16 h laisse 34 minutes entre l'arrivée en gare et la mission ; cela ne valide pas la marche jusqu'à l'adresse. Le sens Grenoble–Annecy retrouve aussi des propositions avec correspondance. Les résultats et requêtes complets sont dans `validation-sncf-annecy-grenoble-2026-10-31.json`.

Deux mesures locales isolées : 46 ms pour l'Aller, 88 ms pour le sens inverse, après chargement et validation des fichiers. Ce ne sont ni des délais de téléchargement ni une mesure de performance sur Android.

Un appel réel au calculateur public Mobilités M pour Annecy–Grenoble le même jour retourne `GEOCODE_FROM_NOT_FOUND` ; le sens inverse retourne `GEOCODE_TO_NOT_FOUND`. Son périmètre n'est donc pas élargi par supposition. Le raccordement SNCF reste distinct du calculateur local Mobilités M.

## Tests et portée

- **148 tests JavaScript et 2 tests Python réussis localement**, dont sept nouvelles régressions de limite d'arrivée, mutualisation/annulation, géocodage et rendu SNCF.
- Le vrai navigateur Chromium 156, en émulation Pixel 7, charge l'Agenda et affiche les propositions Annecy–Grenoble après géocodage. Capture : `mobile-annecy-grenoble.png` dans les artefacts du workflow mobile. Rapport : `validation-transport-mobile-sncf-2026-10-31.json`.
- Ce scénario navigateur utilise un extrait enregistré de deux courses et dix-huit gares provenant du fichier officiel : les horaires et coordonnées sont conservés, les indices des gares sont remappés. L'empreinte du fichier parent et le manifeste de l'extrait figurent dans `tests/fixtures/sncf-annecy-grenoble-2026-11-02.json`. La date de l'application est fixée et l'extrait reste indépendant du renouvellement quotidien des calendriers. Il ne représente pas une offre exhaustive.

Les missions et le géocodage du navigateur sont fictifs, toutes les requêtes externes sont simulées. Le rejeu des données officielles ne prouve pas la circulation actuelle. Les prix, les accès physiques et les cheminements en gare restent non vérifiés ; aucun badge « Réalisable ». Aucun appareil Android testé. Les jours publiés, le nombre de correspondances et les limites actuelles du moteur ne sont pas étendus par cette correction. La couverture AURA/nationale complète, les petites lignes supplémentaires et les tarifs restent à poursuivre.
