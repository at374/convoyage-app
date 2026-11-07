# SNCF : reprise après géocodage dans l'Agenda

## Problème et correction

Le catalogue SNCF publié contient deux gares portant exactement le nom « Grenoble », avec des identifiants distincts. La recherche sans coordonnées refuse de choisir arbitrairement. L'ancien bloc SNCF ne réévaluait pas la recherche lorsque les coordonnées arrivaient après l'ouverture des Transports.

Aller, Jonction et Retour SNCF utilisent désormais les mêmes sections actualisables que le calculateur régional. Chaque section compare ses communes, coordonnées, horaires et limite d'arrivée. Une coordonnée nouvelle relance seulement les recherches concernées ; un libellé sans effet ne relance rien. Le domicile est relu au moment du calcul. Les requêtes précédentes sont annulées et leurs anciennes réponses ignorées, y compris après masquage de la fiche.

Pour la Jonction, `latestArrival` est transmis au moteur avec la marge déjà déduite. Les branches arrivant après cette limite sont exclues avant la limite de résultats. La régression contient douze départs précoces arrivant trop tard et un départ plus tardif qui arrive dans la fenêtre : celui-ci n'est plus perdu par la limitation initiale.

Les téléchargements d'un même jour restent mutualisés. Annuler un consommateur préserve les autres ; la dernière annulation coupe le téléchargement. Une réponse arrivant après annulation n'alimente pas le cache. Le manifeste est toujours relu avec `no-cache` ; les index restent liés aux empreintes annoncées et le délai réseau de huit secondes est conservé. Adresses et coordonnées ne sont pas envoyées à un calculateur SNCF : elles servent au choix local des gares.

## Résultats datés

Le manifeste publié dans le dépôt référence l'archive SNCF Voyageurs version producteur **2026-11-05**, empreinte SHA-256 `9652705b19a105822ba7d7f04d8e848980a169f880207afc5ddd199ebc5748ed`, générée le **6 novembre 2026 à 10:52:58 UTC**. Il contient des index journaliers vérifiés du **5 au 12 novembre 2026** (2 802 gares et 5 120 à 10 024 courses selon le jour). Une recherche hors de ces journées est explicitement indisponible : elle ne permet jamais de conclure qu'il n'existe aucun train.

Le flux national SNCF couvre théoriquement TER, Intercités et TGV sur sa fenêtre de publication, mais il ne remplace pas les données d'autorités organisatrices régionales ni les données Transilien. Le secours embarqué ne charge pas le GTFS national sur Android : il relit uniquement les index journaliers publiés, contrôlés par empreinte. Il ne consomme ni GTFS-RT ni SIRI ; retards, suppressions, correspondances physiques, accès aux gares et tarifs restent donc non vérifiés.

Le scénario historique du **2 novembre 2026**, pour une arrivée en gare avant 15 h 30, retournait notamment **K21 Annecy 13 h 43 → Grenoble 15 h 26**, direct. Une prise en charge fictive à 16 h laisse 34 minutes entre l'arrivée en gare et la mission ; cela ne valide pas la marche jusqu'à l'adresse. Le sens Grenoble–Annecy retrouvait aussi des propositions avec correspondance. Ces résultats archivés figurent dans `validation-sncf-annecy-grenoble-2026-10-31.json` ; ils ne constituent pas une preuve de circulation actuelle.

Deux mesures locales isolées : 46 ms pour l'Aller, 88 ms pour le sens inverse, après chargement et validation des fichiers. Ce ne sont ni des délais de téléchargement ni une mesure de performance sur Android.

Un appel réel au calculateur public Mobilités M pour Annecy–Grenoble le même jour retourne `GEOCODE_FROM_NOT_FOUND` ; le sens inverse retourne `GEOCODE_TO_NOT_FOUND`. Son périmètre n'est donc pas élargi par supposition. Le raccordement SNCF reste distinct du calculateur local Mobilités M.

## Tests et portée

- La suite dédiée valide le manifeste publié, les empreintes des huit index, la recherche gare-à-gare, les limites d'arrivée, la mutualisation/annulation, le géocodage et le rendu SNCF. Le nombre total de tests de l'application évolue indépendamment de ce document.
- Le vrai navigateur Chromium 156, en émulation Pixel 7, charge l'Agenda et affiche les propositions Annecy–Grenoble après géocodage. Capture : `mobile-annecy-grenoble.png` dans les artefacts du workflow mobile. Rapport : `validation-transport-mobile-sncf-2026-10-31.json`.
- Ce scénario navigateur utilise un extrait enregistré de deux courses et dix-huit gares provenant du fichier officiel : les horaires et coordonnées sont conservés, les indices des gares sont remappés. L'empreinte du fichier parent et le manifeste de l'extrait figurent dans `tests/fixtures/sncf-annecy-grenoble-2026-11-02.json`. La date de l'application est fixée et l'extrait reste indépendant du renouvellement quotidien des calendriers. Il ne représente pas une offre exhaustive.

Les missions et le géocodage du navigateur sont fictifs, toutes les requêtes externes sont simulées. Le rejeu des données officielles ne prouve pas la circulation actuelle. Les prix, les accès physiques et les cheminements en gare restent non vérifiés ; aucun badge « Réalisable ». Aucun appareil Android testé. Les jours publiés, le nombre de correspondances et les limites actuelles du moteur ne sont pas étendus par cette correction. La couverture AURA/nationale complète, les petites lignes supplémentaires et les tarifs restent à poursuivre. Pour un prix variable, un devis frais par trajet et date reste nécessaire.


Règle actuelle précisée le 31 octobre 2026 : minimum **5 minutes au point GPS exact de prise en charge, marche finale comprise**. Les anciennes mesures à 30 minutes ci-dessus décrivent leurs scénarios historiques ; 30–45 minutes restent une préférence. Voir `transport-pickup-margin.md` et `validation-transport-pickup5-2026-10-31.json`.
