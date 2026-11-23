# Convoyage Ultra — priorités tarifaires constatées (diagnostic du 23 novembre 2026)

Source locale vérifiable : `docs/COUVERTURE-TARIFS-DIAGNOSTIC.md` et `docs/DIAGNOSTIC-SERVEUR.md` ; scénario 2026-11-30 08:00 +01:00.

## Mesure de référence

- 27 axes ; 965 itinéraires ; 379 avec prix complet (39,3 %) ; 64 partiellement tarifés.
- 937 itinéraires avec marche calculée ; 93 déclarés réalisables. Ces compteurs ne doivent pas être confondus.
- 586 itinéraires sans prix complet : ne pas afficher de rentabilité de mission pour ces résultats.
- Occurrences de portions sans prix : SNCF 327 ; Cars Région Isère 99 ; Cars Région Haute-Savoie 48 ; FlixBus 35 ; BlaBlaCar Bus 33. Ce sont des occurrences, pas des billets distincts.

## Axes prioritaires pour obtenir des trajets entièrement tarifés

| Axe | Total | Prix complet | Partiel | Premier blocage vérifiable |
|---|---:|---:|---:|---|
| Saint-Julien-en-Genevois → Genève | 45 | 8 | 37 | Cars Région Haute-Savoie 274 ; SNCF C33 |
| Annecy → Genève | 49 | 0 | 18 | SNCF L2 ; Cars Région Haute-Savoie 274 |
| Thonon-les-Bains → Genève | 16 | 0 | 4 | SNCF C33/L1 ; AFO 271 ; BUT |
| Chambéry → Saint-Julien-en-Genevois | 11 | 0 | 1 | SNCF TER K11 |
| Voiron → Voreppe | 31 | 2 | 1 | SNCF / Mobilités M C6 |
| Chambéry → Grenoble | 72 | 0 | 0 | Cars Région Isère ; SNCF |
| Voiron → Grenoble | 39 | 0 | 0 | Cars Région Isère T40/T41/T55 ; SNCF |
| Ambérieu-en-Bugey → Lyon Part-Dieu | 18 | 0 | 0 | SNCF K23/C18/K1+ |

## Preuves requises avant d'annoncer un progrès

1. Récupérer la source officielle du **prix de vente** correspondant à la date, à la relation et au profil de voyageur ; GTFS horaire seul insuffisant.
2. Pour Isère : disposer d'une correspondance certifiée `stop_id GTFS → zone` pour **tous** les arrêts du tronçon, pas d'une déduction de la commune ; vérifier le nombre de zones traversées et la validité de la grille.
3. Pour SNCF, FlixBus et BlaBlaCar Bus : distinguer horaires GTFS et prix commerciaux datés. En absence d'API publique tarifaire autorisée et fiable, afficher un lien d'achat, **pas un prix estimé**.
4. Relancer le diagnostic identique et comparer `priced / trips`, `partialPricedJourneys`, `feasible`, ainsi que les occurrences par opérateur ; conserver la référence du run et la date.
5. Ne pas confondre `prix vérifié` et `trajet réalisable`. Le calcul de rentabilité doit rester masqué si une portion est sans prix.

Ce document est une feuille de priorités fondée sur des résultats déjà observés, **pas** une attestation de nouveaux tarifs ni de couverture supplémentaire.
