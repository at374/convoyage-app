# Diagnostic réel des transports — serveur GitHub Actions

Exécuté le 2026-11-13T09:52:43.584Z ; départs à partir de 2026-11-16T08:00:00+01:00 ; TripGo : non (pas de clé).

| Axe | Trajets | Prix vérifié | Marches calculées | Réalisables | 1er résultat | Total | Sources | Erreurs | Attendus non vus |
|---|---|---|---|---|---|---|---|---|---|
| Annecy → Genève | 24 | 0 | 16 | 16 | 0.2 s | 5.8 s | SNCF (GTFS officiel), Cars Région Haute-Savoie (GTFS) | — | lex, cff, longue |
| Annemasse → Saint-Julien-en-Genevois | 48 | 0 | 16 | 8 | 0.2 s | 6.6 s | SNCF (GTFS officiel), TAC Annemasse (GTFS) | Suisse : fetch failed | lex, tpg-fr |
| Ambérieu-en-Bugey → Lyon Part-Dieu | 8 | 0 | 8 | 2 | 0.1 s | 2.6 s | SNCF (GTFS officiel) | — | cars-01, tcl |
| Chambéry → Aix-les-Bains | 14 | 0 | 14 | 12 | 0.1 s | 7.7 s | SNCF (GTFS officiel), Synchro Bus Chambéry (GTFS) | — | ondea |
| Grenoble → Crolles | 13 | 5 | 13 | 13 | 0.1 s | 5.2 s | Mobilités M, SNCF (GTFS officiel) | — | — |
| Rumilly → Annecy | 9 | 1 | 9 | 1 | 0.1 s | 4.9 s | Sibra (GTFS), SNCF (GTFS officiel) | — | jybus, cars-74 |
| Thonon-les-Bains → Genève | 8 | 0 | 8 | 0 | 0.1 s | 2.5 s | SNCF (GTFS officiel) | — | lex, start, tpg-fr |
| Voiron → Grenoble | 21 | 0 | 21 | 21 | 0.2 s | 5.2 s | Mobilités M, SNCF (GTFS officiel), Cars Région Isère (GTFS) | — | mreso-voironnais |

Exemples (3 meilleures propositions par axe) :

**Annecy → Genève**
- Meilleur compromis · Plus rapide : 2026-11-16T07:42:57.390Z → 2026-11-16T09:13:00.000Z · marche 86 m › SNCF L2 · Prix à confirmer · Réalisable

**Annemasse → Saint-Julien-en-Genevois**
- Meilleur compromis · Plus rapide : 2026-11-16T07:01:00.000Z → 2026-11-16T08:26:26.357Z · SNCF L1 › SNCF C33 › marche 631 m · Prix à confirmer · Réalisable

**Ambérieu-en-Bugey → Lyon Part-Dieu**
- Meilleur compromis · Plus rapide : 2026-11-16T07:12:26.785Z → 2026-11-16T07:52:00.000Z · marche 1346 m › SNCF K23 · Prix à confirmer · Réalisable

**Chambéry → Aix-les-Bains**
- Meilleur compromis · Plus rapide : 2026-11-16T07:00:00.000Z → 2026-11-16T07:11:00.000Z · SNCF C21 · Prix à confirmer · Réalisable

**Grenoble → Crolles**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-16T07:02:04.000Z → 2026-11-16T07:42:59.000Z · marche 69 m › M Réso - Métropole Grenobloise C11 · 2,00 € · Réalisable

**Rumilly → Annecy**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-16T12:03:51.578Z → 2026-11-16T13:00:49.298Z · marche 625 m › Sibra 42 › marche 160 m · 2,00 € · Réalisable

**Thonon-les-Bains → Genève**
- Meilleur compromis · Plus rapide : 2026-11-16T06:57:38.441Z → 2026-11-16T07:58:00.000Z · marche 197 m › SNCF L1 · Prix à confirmer · Transport non confirmé (départ avant la fin de la mission précédente)

**Voiron → Grenoble**
- Meilleur compromis · Plus rapide : 2026-11-16T07:49:26.000Z → 2026-11-16T08:09:27.000Z · marche 358 m › Mobilités M - SNCF K6 › marche 27 m · Prix à confirmer · Réalisable

