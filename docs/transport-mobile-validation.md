# Validation mobile des transports Agenda

Validation locale du 31 octobre 2026 sur la branche `feature/transport-ranking-safe`, après le commit `d205f808b8d17d21e01e0bf5cbbf524ed592b4fe`.

## Exécution

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install --with-deps chromium
node tests/browser/transport-mobile.cjs
```

`CHROMIUM_EXECUTABLE` permet de sélectionner un Chromium installé. La validation locale utilise Chrome for Testing 156.0.8078.80, avec émulation Pixel 7 (412 × 839), langue française et fuseau Europe/Paris. La date applicative du scénario est fixée au 31 octobre 2026 ; les délais réels restent actifs. Le workflow `Test mobile transport lifecycle` reproduit ce parcours et conserve les captures et le rapport pendant sept jours.

## Vérifications réalisées

Le navigateur charge les vrais fichiers de l'application et ouvre l'Agenda puis une fiche mission. Il vérifie les boutons voiture et Transports séparés, la couleur bleu clair du bouton, la saisie d'une livraison prévue, les arrivées indépendantes des coordonnées précises et les blocs Aller / Jonction / Retour. La requête Aller tient compte des 30 minutes de marge.

Une archive GTFS synthétique compressée est réellement décompressée et indexée dans le worker du navigateur. La réponse Mobilités M enregistrée pour Grenoble–Crolles est rendue dans la jonction. L'actualisation relance les recherches. Une deuxième actualisation est volontairement suspendue : fermer la fiche annule les trois requêtes régionales et termine les workers. Les réponses libérées après fermeture ne modifient plus le panneau.

La capture régionale a été inspectée : les propositions sont lisibles dans le style existant et le panneau ne déborde pas horizontalement. Aucune erreur JavaScript non interceptée. Résultats détaillés : `validation-transport-mobile-2026-10-31.json`.

## Annulation et partage

Chaque bloc régional possède un signal d'annulation. Un changement de coordonnées annule sa recherche précédente ; masquer ou retirer le panneau annule les recherches restantes. Le moteur partage toujours les requêtes identiques : annuler un consommateur ne coupe pas celui qui en a encore besoin. La dernière annulation coupe la requête réseau. Une réponse tardive provenant d'un transport qui ignore l'annulation n'alimente pas le cache. Les délais et limites de résultats existants sont conservés.

Les tests unitaires couvrent le partage, la dernière annulation, la réponse tardive et le signal déjà annulé. Validation locale totale : 141 tests JavaScript et 2 tests Python réussis, plus ce parcours navigateur.

## Limites

Toutes les requêtes externes sont interceptées. Les missions, la session et l'archive GTFS sont fictives ; aucune mission réelle ni clé API n'est envoyée. Les lectures de statut et de version Android sont également simulées. Les service workers sont désactivés pour isoler le test : le fonctionnement hors connexion et la migration d'un cache installé ne sont pas validés ici.

Ce test n'établit ni la circulation réelle, ni un tarif officiel, ni l'accès physique aux adresses. Les propositions restent « Transport non confirmé — vérifiez vous-même ». L'émulation Pixel ne remplace pas une validation sur appareil Android ; celle-ci reste à effectuer. Les liaisons interurbaines, la couverture nationale et les prix ne sont pas complétés par ce lot.

## Exécution GitHub Actions

Sur le commit `6600fe5f4543d75337e92f9a22ef119f2e5e647e`, les huit exécutions déclenchées (push et PR) réussissent, dont deux parcours mobiles. Le parcours PR utilise Chromium 151.0.7922.34 et confirme les trois annulations, zéro worker restant et aucune erreur JavaScript. [Exécution et captures](https://github.com/at374/convoyage-app/actions/runs/41179664330). Ce résultat est distinct du navigateur local et ne constitue pas un test Android.


Règle actuelle précisée le 31 octobre 2026 : minimum **5 minutes au point GPS exact de prise en charge, marche finale comprise**. Les anciennes mesures à 30 minutes ci-dessus décrivent leurs scénarios historiques ; 30–45 minutes restent une préférence. Voir `transport-pickup-margin.md` et `validation-transport-pickup5-2026-10-31.json`.

## Résultats visibles dans les trois sens

Le moteur suisse lance les recherches Aller, Jonction et Retour dans le panneau principal, dans le périmètre Genève–Lausanne et approches proches. Il applique la marge avant mission aux trajets qui ont une échéance, relance lorsque les coordonnées exactes arrivent et annule les requêtes quand le panneau est fermé. Le moteur fournit des horaires aux arrêts. Prix et circulation restent à vérifier. La recherche publique sur coordonnées Genève → Lausanne a renvoyé deux trajets arrivant avant 09 h 30 le 10 novembre 2026.

Les cartes principales peuvent afficher une référence Cars Région Express quand elle correspond à la course, sans l’utiliser comme prix confirmé ni pour le tri. Les cartes TripGo affichent des trajets BlaBlaCar Bus et FlixBus si la clé est présente sur l’appareil et si le moteur les renvoie. Chaque portion de car identifiée propose un lien de recherche du prix sur le site officiel. La réponse horaire testée ne livre aucun devis de vente. Le covoiturage BlaBlaCar a une recherche distincte dans les réglages.

Les tests locaux couvrent les trois sens suisses et le filtrage horaire, les deux opérateurs de car sur réponse enregistrée, et l’absence de prix inventé. La version installée sur téléphone reste à valider.

## Accès aux propositions après les premières cartes

Le classement garde ses recommandations en tête, puis « Afficher plus de trajets » donne accès aux autres résultats compatibles par lots. Le panneau récupère les alternatives GTFS au-delà des cinq lignes de détail et signale une recherche locale partielle. Les listes SNCF, régionales et suisses conservent les propositions compatibles rendues par leurs moteurs. Le moteur suisse n’effectue plus une seconde recherche Aller et Retour dans les réglages.

TripGo conserve tous les trajets valides de la réponse dans ses limites de lecture. Le scénario de régression place un FlixBus après douze propositions BlaBlaCar Bus et vérifie qu’il reste disponible. Le tri et la pagination conservent le statut de prix inconnu lorsque la source ne fournit aucun devis vérifié. Les moteurs gardent leurs limites de couverture, de dates, de volume ou de disponibilité.

## Recherche du prix des cars par trajet

Les cartes TripGo gardent les offres de deux opérateurs même si les horaires, les arrêts et le libellé de ligne coïncident. Le lien FlixBus préremplit les villes reconnues, le jour local de départ et un adulte. Les identifiants viennent des pages publiques [Grenoble–Annecy](https://www.flixbus.fr/voyages-car/grenoble-annecy), [Annecy–Genève](https://www.flixbus.fr/voyages-car/annecy-geneve), [Annecy–Annemasse](https://www.flixbus.fr/voyages-car/annecy-annemasse), [Annecy–Chambéry](https://www.flixbus.fr/voyages-car/annecy-chambery) et [Annecy–Lyon](https://www.flixbus.fr/voyages-car/annecy-lyon). L’utilisateur sélectionne son départ et confirme le profil sur le site marchand. Les aéroports et villes non reconnues gardent le lien générique.

Pour BlaBlaCar Bus, la carte ouvre la page officielle de la relation si les deux villes correspondent à un lien publié. L’utilisateur sélectionne le jour et la course. Le 9 novembre, la page [Annecy–Grenoble](https://www.blablacar.fr/bus/routes/annecy-2/grenoble-2) contenait une offre de 4,99 € pour le départ du 10 novembre à 10 h 15, arrivée à 11 h 40, dans le contenu de la page. C’est un prix observé à cet instant. La requête avec l’origine de la web app a renvoyé HTTP 200 sans autorisation CORS, ce qui empêche sa lecture directe depuis la page de l’application. Le tarif de départ FlixBus affiché sur sa page de relation est un minimum public. Le lien de recherche prérempli renvoie une page de recherche, sans devis de course exploitable dans la réponse HTML testée. [FlixBus présente une intégration API via son programme partenaire](https://www.flixbus.com/company/partners/affiliate-partners).

Le prix dans l’application reste inconnu jusqu’à obtention d’un devis frais rattaché à la course, au jour et au profil. Les liens ne réutilisent ni les URL externes fournies par TripGo ni les identifiants de session observés sur les sites. Les tests locaux couvrent le sens du trajet, la date après minuit, les solutions de repli et la conservation des deux opérateurs.

## Cartes de résultat dans la fiche mission

Le bouton Transports ouvre Aller, Jonction et Retour et lance les moteurs raccordés. Les cartes gardent les recommandations et le bouton pour afficher davantage de trajets. Les liens qui demandaient de refaire la recherche de trajet ou de prix sur SNCF Connect, BlaBlaCar Bus et FlixBus ont été retirés de cette fiche. Les liens cartographiques et les preuves tarifaires restent associés à un résultat.

La carte affiche le prix disponible ou son statut dans le résumé. Les grilles Express et Y51 restent identifiées comme références lorsqu’un devis n’est pas établi. Les réponses TripGo enregistrées pour BlaBlaCar Bus et FlixBus fournissent les étapes et des tracés. Le dessin montre les portions reçues, avec les marches en violet et les portions de transport en bleu. Une étape sans géométrie fiable ne donne lieu à aucun trait de remplacement. Les marches GTFS calculées par Valhalla remontent dans le détail de la carte correspondante, avec durée, distance et géométrie lorsque disponibles. Ce calcul reste soumis au budget du moteur piéton.

Le prix exact des cars et le covoiturage BlaBlaCar exigent encore un raccordement qui renvoie une offre datée dans l’application. Les autres moteurs sans géométrie gardent leurs étapes et les informations d’arrêt disponibles. Les tests locaux vérifient les cartes et les données enregistrées. Le navigateur mobile complet et le téléphone physique restent à valider.
