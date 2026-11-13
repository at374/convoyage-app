# Transmission à ChatGPT — module Transports AURA + Suisse de Convoyage Ultra

**Date du relevé : 13 novembre 2026.** Dépôt : `at374/convoyage-app`, branche `feature/transports-aura-suisse`. Ce document décrit l'état après la session Claude du 13/11/2026, pour éviter de refaire le même travail ou de recréer le conflit décrit ci-dessous.

## Conflit `transport-fare-grids.js` — résolu, lire avant de retoucher le fichier

Entre le 13/11 (matin) et maintenant, `transport-fare-grids.js` a eu une entrée TAM tronquée réintroduite **sur au moins 6 commits consécutifs** côté ChatGPT (8d3da02, ebd9a7a, 4eb0628, 2632964, ae70e3c, 6c880f3), ce qui cassait `require()` du module et faisait échouer `tests/transport-coverage.test.cjs`. Un garde CI a ensuite été ajouté (21d1bd4/1afedc2) avec un test qui imposait **TAM = 1,10 €** (source citée : `storage.googleapis.com/is-wp-170-prod/.../Livret_TAM_2026.pdf`).

Après plusieurs recherches indépendantes (WebSearch ciblé sur Ambérieu-en-Bugey + TAM + tarifs), **cette URL n'apparaît dans aucun résultat et reste invérifiable**. Les seules traces officielles trouvées sont un exemple isolé et non daté « Gare ↔ clinique : 15 mn et 1 € » (livret mobilité CC Plaine de l'Ain) — pas une grille complète. J'ai donc :
- laissé TAM sans tarif (« Prix à confirmer ») dans `transport-fare-grids.js`,
- adapté le test CI (`.github/workflows/diagnostic-transports.yml`) pour vérifier l'**absence** de prix TAM plutôt que d'imposer 1,10 €.

**Si tu as une vraie source officielle et datée pour TAM, dis-le explicitement dans le message de commit avec l'URL vérifiable** — sinon merci de ne pas réintroduire ce chiffre, pour éviter un nouveau cycle de conflits sur ce même point.

## Corrections de couverture poussées aujourd'hui

Trois écarts du diagnostic réel ont été corrigés dans `transport-coverage.js` — dans les trois cas c'était l'attente du test qui était fausse, pas le moteur :
- **Rumilly → Annecy** : Sibra dessert la liaison (ligne 42), pas J'y bus (les lignes J4/J5 s'arrêtent avant Annecy, vérifié sur les arrêts GTFS réels et confirmé par recherche officielle des terminus).
- **Voiron → Grenoble** : Cars Région Isère (lignes T40/T41/T50/T51/T55 via Saint-Laurent-du-Pont/Moirans, confirmées sur itinisere.fr), pas M réso Voironnais (réseau local, pas de ligne directe vers Grenoble).
- **Ambérieu-en-Bugey → Lyon** : TER seul. La « ligne 103 » affichée en gare comme « Cars interurbains » n'est pas un car direct jusqu'à Lyon : c'est la navette OùRA Lagnieu ↔ Ambérieu, combinée commercialement avec le TER (« Lagnieu → Ambérieu → Lyon : car + train », confirmé par plusieurs fiches horaires officielles). TCL ne dessert pas Ambérieu (sa propre ligne 103 est une ligne de banlieue ouest de Lyon, sans rapport).

## Couverture tarifaire — recherche approfondie du 13/11 (soir)

- **Cars Région Ain** : tarif réseau **unique** confirmé à **2,20 €** le 1 voyage (comparaison de plusieurs fiches horaires officielles datées : 2 € en 2022, 2,20 € pour la période 25/08/2025-23/08/2026 — même montant sur des lignes différentes à la même date). Intégré dans `transport-fare-grids.js`. **Limite connue** : validité bornée au 23/08/2026, faute de fiche 2026/2027 trouvée — à revérifier si quelqu'un trouve la fiche de la période en cours.
- **Cars Région Isère** : grille zonale officielle confirmée avec URL (carsisere.auvergnerhonealpes.fr), 1 à 6 zones de 4,10 € à 12,10 €. **Non intégrée** : aucune donnée de zone par arrêt dans le pipeline pour savoir combien de zones un trajet traverse. Appliquer un chiffre au hasard de cette grille serait un prix inventé.
- **Cars Région Savoie** : confirmé qu'il n'y a **pas** de tarif réseau unique (contrairement à l'Ain) — plusieurs lignes touristiques/TAD ont des tarifs différents vérifiés sur fiches officielles (S80 3,00 €, S66/S32/S33/S40/S41 12,50 €/8,90 €, S70 8,50 €/6,10 €...). Pas de prix unique possible sans savoir quelle ligne est concernée.
- **TPG (Genève, zone 10)** : confirmé 3,00 CHF (billet 60 min plein tarif) via 3 sources officielles concordantes. **Non intégré** : `transport.opendata.ch` ne donne aucune zone par arrêt, donc impossible de distinguer un trajet intra-Genève d'un trajet transfrontalier (tarif Léman Pass, plus élevé) — risque de prix trop bas, pas juste une lacune.
- **Léman Pass** : toujours désactivé (`LEMAN_PASS_ACTIVE=false` dans `transport-fare-grids.js`) suite à un désaccord apparent entre sources (TAC 4,90 € vs Jacquet 4,80 €). Piste trouvée mais pas vérifiée : ce serait peut-être des zones de départ différentes plutôt qu'une vraie contradiction — à vérifier spécifiquement avant de réactiver, pas en passant.
- **J'y bus (Rumilly)** : toujours aucune grille officielle avec prix trouvée, malgré recherche sur data.gouv.fr, rumilly-tourisme.com, transbus.org.

## Ce qui reste ouvert

1. **Section 5 de la mission (routage piéton)** : le fichier de mission envoyé par l'utilisateur est tronqué avant la fin de cette section. Pas encore attaqué.
2. **Tarif TAM, J'y bus, zones Isère/Savoie** : documentés comme ci-dessus, pas de prix fiable trouvé — ne pas réinventer un chiffre sans source vérifiable indépendamment.
3. Avant toute modification de `transport-fare-grids.js` ou `transport-coverage.js` : `git fetch` + lire les derniers commits, pour éviter un nouveau conflit simultané comme celui du matin.

Historique complet : commits `2ba2ce6`, `6e6f369`, `54d73ae`, `11775f6`, `8573921`, `201d58e` sur cette branche.
