# Couverture tarifaire — diagnostic automatique

Source : diagnostic serveur (GitHub Actions) ; relevé : 2026-11-23T19:25:05.171Z ; scénario : 2026-11-30T08:00:00+01:00.

Ce rapport est un **instantané de diagnostic**, pas une confirmation de tarifs ou de disponibilité commerciale.

| Axe | Trajets | Entièrement tarifés | Partiellement tarifés | À compléter | Opérateurs sans prix |
|---|---:|---:|---:|---:|---|
| Chambéry → Grenoble | 72 | 0 | 0 | 72 | Cars Région Isère (75 portions), SNCF (20 portions), FlixBus (6 portions), BlaBlaCar Bus (6 portions) |
| Évian → Thonon (ÉVA’D / TER) | 53 | 0 | 0 | 53 | ÉVA'D Évian (29 portions), SNCF (18 portions), Evian (12 portions), But (4 portions) |
| Bourg-en-Bresse gare routière → centre (Rubis) | 57 | 7 | 0 | 50 | Rubis Bourg-en-Bresse (29 portions), Cars Région Ain (27 portions), SNCF (4 portions) |
| Annecy → Genève | 49 | 0 | 18 | 49 | SNCF (25 portions), Cars Région Haute-Savoie (16 portions), FlixBus (10 portions), BlaBlaCar Bus (4 portions) |
| Voiron → Grenoble | 39 | 0 | 0 | 39 | SNCF (20 portions), Cars Région Isère (12 portions), BlaBlaCar Bus (8 portions), Mobilités M - SNCF (5 portions) |
| Saint-Julien-en-Genevois → Genève | 45 | 8 | 37 | 37 | Cars Région Haute-Savoie (32 portions), SNCF (5 portions) |
| Annecy → Chambéry | 35 | 0 | 0 | 35 | SNCF (23 portions), BlaBlaCar Bus (8 portions), FlixBus (7 portions) |
| Voiron → Voreppe (M réso Voironnais) | 31 | 2 | 1 | 29 | SNCF (23 portions), Cars Région Isère (12 portions), Mobilités M - SNCF (3 portions) |
| Bonneville → La Roche-sur-Foron (Proxim iTi / TER) | 23 | 0 | 0 | 23 | SNCF (23 portions) |
| Chambéry → Aix-les-Bains | 65 | 45 | 0 | 20 | SNCF (20 portions) |
| Rumilly → Annecy | 21 | 1 | 0 | 20 | SNCF (20 portions) |
| Genève → Lausanne | 20 | 0 | 0 | 20 | FlixBus (10 portions), SBB (8 portions), BlaBlaCar Bus (4 portions) |
| Lyon → Grenoble | 20 | 0 | 0 | 20 | SNCF (20 portions) |
| Thonon → Bons-en-Chablais (Star’t 142) | 50 | 31 | 1 | 19 | SNCF (16 portions), But (2 portions), Star't Thonon (1 portions) |
| Ambérieu-en-Bugey → Lyon Part-Dieu | 18 | 0 | 0 | 18 | SNCF (18 portions) |
| Thonon-les-Bains → Genève | 16 | 0 | 4 | 16 | SNCF (11 portions), But (8 portions), AFO (4 portions), FlixBus (2 portions) |
| Bourg-en-Bresse → Ambérieu (Cars Ain / TER) | 16 | 1 | 2 | 15 | SNCF (13 portions), Cars Région Ain (2 portions) |
| Annemasse → Saint-Julien-en-Genevois | 52 | 38 | 0 | 14 | SNCF (14 portions), TPG (1 portions) |
| Lyon Part-Dieu → Bellecour (TCL) | 56 | 43 | 0 | 13 | SNCF (7 portions), Cars Région Express (5 portions) |
| Chambéry → Saint-Julien-en-Genevois | 11 | 0 | 1 | 11 | SNCF (19 portions), AFO (3 portions) |
| Chambéry → Chamoux-sur-Gelon (Cars Savoie S05) | 10 | 0 | 0 | 10 | SNCF (8 portions), Cars Région Savoie (2 portions) |
| Grenoble → Crolles | 8 | 5 | 0 | 3 | BlaBlaCar Bus (3 portions) |
| Aix-les-Bains gare → Technolac (Ondéa 01) | 19 | 19 | 0 | 0 | — |
| Rumilly Hôpital → Base de loisirs (J’y bus 1) | 60 | 60 | 0 | 0 | — |
| Ambérieu gare → Cabrol (TAM 2) | 83 | 83 | 0 | 0 | — |
| Annemasse → Genève | 28 | 28 | 0 | 0 | — |
| Archamps → Genève | 8 | 8 | 0 | 0 | — |

## Portions sans prix par opérateur

Les nombres ci-dessous sont des **occurrences par axe**, pas des billets uniques ni des trajets distincts.

| Opérateur | Occurrences |
|---|---:|
| SNCF | 327 |
| Cars Région Isère | 99 |
| Cars Région Haute-Savoie | 48 |
| FlixBus | 35 |
| BlaBlaCar Bus | 33 |
| ÉVA'D Évian | 29 |
| Rubis Bourg-en-Bresse | 29 |
| Cars Région Ain | 29 |
| But | 14 |
| Evian | 12 |
| Mobilités M - SNCF | 8 |
| SBB | 8 |
| AFO | 7 |
| Cars Région Express | 5 |
| Cars Région Savoie | 2 |
| Star't Thonon | 1 |
| TPG | 1 |

## Lignes à rechercher en priorité

Exemples observés sur des trajets partiellement tarifés : liste non exhaustive, sans tarif présumé.

| Axe | Opérateur | Lignes sans tarif vérifié |
|---|---|---|
| Annecy → Genève | SNCF | B L2 |
| Annecy → Genève | Cars Région Haute-Savoie | 274 |
| Thonon-les-Bains → Genève | But | B 002278, B 002283, B 002289 |
| Thonon-les-Bains → Genève | SNCF | TER C33 |
| Thonon-les-Bains → Genève | AFO | B 271 |
| Thonon → Bons-en-Chablais (Star’t 142) | Star't Thonon | SMAR |
| Bourg-en-Bresse → Ambérieu (Cars Ain / TER) | Cars Région Ain | A32 |
| Saint-Julien-en-Genevois → Genève | SNCF | C33 |
| Saint-Julien-en-Genevois → Genève | Cars Région Haute-Savoie | 274 |
| Chambéry → Saint-Julien-en-Genevois | SNCF | TER K11 |
| Voiron → Voreppe (M réso Voironnais) | Mobilités M - SNCF | C6 |

## Couverture globale

379 trajets entièrement tarifés sur 965 (39.3 %).

## Distinction indispensable : prix et faisabilité

Trajets avec prix complet : 379 / 965.
Trajets déclarés faisables par le diagnostic : 93 / 965.
Ces deux compteurs sont indépendants : un trajet tarifé peut rester non réalisable (horaires, correspondances, confirmation). Leur intersection n’est pas calculée ici ; ne pas présenter 379 comme le nombre de trajets réalisables.

## Trajets partiellement tarifés

64 trajets possèdent au moins un tarif, mais pas de prix total vérifié. Ils restent exclus du calcul de rentabilité.

## Axes prioritaires : trajets déjà partiellement tarifés

Classement par nombre de trajets ayant au moins un tarif mais pas de total vérifié. Un trajet partiel n’est jamais compté comme entièrement tarifé.

| Axe | Partiellement tarifés | Entièrement tarifés | Total trajets |
|---|---:|---:|---:|
| Saint-Julien-en-Genevois → Genève | 37 | 8 | 45 |
| Annecy → Genève | 18 | 0 | 49 |
| Thonon-les-Bains → Genève | 4 | 0 | 16 |
| Bourg-en-Bresse → Ambérieu (Cars Ain / TER) | 2 | 1 | 16 |
| Voiron → Voreppe (M réso Voironnais) | 1 | 2 | 31 |
| Thonon → Bons-en-Chablais (Star’t 142) | 1 | 31 | 50 |
| Chambéry → Saint-Julien-en-Genevois | 1 | 0 | 11 |

## Priorité : portions bloquant les trajets partiellement tarifés

Ces occurrences sont déjà incluses dans les manques par opérateur ; elles ne doivent pas être additionnées aux autres comptes.

| Opérateur | Occurrences bloquantes |
|---|---:|
| Cars Région Haute-Savoie | 48 |
| SNCF | 11 |
| But | 4 |
| Cars Région Ain | 2 |
| AFO | 1 |
| Star't Thonon | 1 |
| Mobilités M - SNCF | 1 |

Aucun montant manquant ne doit être remplacé par une estimation. La rentabilité de mission reste masquée tant que le prix total du transport n’est pas vérifié.
