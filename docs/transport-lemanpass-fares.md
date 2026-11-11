# Source tarifaire Léman Pass — contrôle du 6 novembre 2026

## Source officielle interrogée

Page publique : <https://www.lemanpass.com/tarifs/>. Le script public du calculateur (`wp-content/plugins/leman-pass-calculator/assets/js/main.js`, version observée 1.1.3) utilise un service GET à `https://www.lemanpass.com/wp-admin/admin-ajax.php`.

Actions observées dans le code public : `leman_autocomplete_location` pour les lieux, `leman_get_price` pour les références tarifaires. Aucune clé ni compte n’a été utilisé. Ce service de site web n’est pas une API partenaire contractuelle documentée ; sa stabilité, sa réutilisation et sa disponibilité dans le navigateur de l’application restent à vérifier avant raccordement automatique.

Une recherche publique des lieux a renvoyé les libellés exacts `Annemasse (LEX)` et `Genève (LEX)`. Requête de prix réellement exécutée :

```text
action=leman_get_price
departure=Annemasse (LEX)
arrival=Genève (LEX)
product=4
category=1
```

Les valeurs produit 4 et catégorie 1 correspondent aux listes publiques « Billet Léman Pass » et « Adulte ». La réponse renvoie du JSON sous un Content-Type text/html. Le corps brut est conservé dans `tests/fixtures/lemanpass-annemasse-geneve-20261106.json` ; date HTTP observée : 2026-11-06T05:27:16Z.

## Résultat limité à la référence demandée

| Billet adulte direct, combinaison P | EUR | CHF |
|---|---:|---:|
| Annemasse (LEX) → Genève (LEX), 2e classe | 8,30 | 7,80 |
| Annemasse (LEX) → Genève (LEX), 1re classe | 14,30 | 13,40 |

Ces montants sont les deux prix de vente publiés dans les monnaies du calculateur, sans conversion entre eux. Ils ne constituent pas une preuve de circulation, disponibilité commerciale ou validité à une date future : la requête observée ne contient pas de date de voyage.

Le service renvoie aussi des combinaisons de zones, des itinéraires via Bellegarde et des lignes ayant d’autres extrémités. Choisir simplement le plus petit montant de toute la réponse donnerait une référence injustifiée pour le trajet direct demandé. Les offres par zones pourraient être pertinentes après une vérification distincte de leur couverture, non réalisée ici.

## Lecteur exécutable ajouté

`transport-lemanpass-fares.js` :

- Construit une requête de lecture sur le seul service officiel, billet adulte, classe 1 ou 2.
- Accepte uniquement les lignes directes P avec extrémités identiques, sans via ni zone ajoutée, dans la classe demandée.
- Conserve EUR et CHF séparément ; montant absent/invalide = inconnu, jamais zéro implicite.
- Écarte les erreurs de service, schémas inconnus et prix directs contradictoires.
- Retourne une référence sourcée et horodatée avec `fareVerified: false`, `travelDateValidityKnown: false` et `serviceConfirmed: false`.
- `fetchReference` lit sans identifiants utilisateur et sans cache ; le lecteur peut aussi recevoir une réponse enregistrée via `parse`.

Exécution des tests :

```sh
node --test tests/transport-lemanpass-fares.test.cjs
```

Six tests locaux réussis sur la réponse réelle enregistrée et ses mutations : parcours/classe, alternatives, prix manquants, ambiguïtés, schéma et erreurs réseau. Le workflow d’inspection des sources les exécute aussi sans appel réseau réel.

## Travail restant avant Android

Le module n’est pas encore chargé par `index.html` ni relié au classement. Il faut valider le chemin d’accès depuis l’application (notamment CORS ou relais adapté), les conditions de réutilisation, les lieux exacts et la couverture des zones/compléments d’abonnements, puis tester l’affichage et les dates de voyage. Il ne donne actuellement aucun prix pour l’ensemble de la Suisse, les trajets via Genève vers l’Ain ou tous les billets transfrontaliers : chaque combinaison reste à contrôler. Il n’effectue aucun achat ni réservation.
