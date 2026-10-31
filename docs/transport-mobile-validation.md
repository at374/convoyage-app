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
