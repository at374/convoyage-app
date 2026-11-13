# Diagnostic réel des transports — serveur GitHub Actions

Exécuté le 2026-11-13T09:58:08.770Z ; départs à partir de 2026-11-16T08:00:00+01:00 ; TripGo : non (pas de clé).

| Axe | Trajets | Prix vérifié | Marches calculées | Réalisables | 1er résultat | Total | Sources | Erreurs | Attendus non vus |
|---|---|---|---|---|---|---|---|---|---|
| Annecy → Genève | 30 | 0 | 22 | 22 | 0.4 s | 6.8 s | Suisse (transport.opendata.ch), SNCF (GTFS officiel), Cars Région Haute-Savoie (GTFS) | — | longue |
| Annemasse → Saint-Julien-en-Genevois | 44 | 0 | 12 | 4 | 0.2 s | 5.5 s | SNCF (GTFS officiel), TAC Annemasse (GTFS) | Suisse : fetch failed | tpg-fr |
| Ambérieu-en-Bugey → Lyon Part-Dieu | 10 | 0 | 8 | 3 | 0.1 s | 3.6 s | SNCF (GTFS officiel) | — | cars-01, tcl |
| Chambéry → Aix-les-Bains | 16 | 0 | 14 | 13 | 0.1 s | 6.7 s | SNCF (GTFS officiel), Synchro Bus Chambéry (GTFS) | — | ondea |
| Grenoble → Crolles | 12 | 5 | 12 | 12 | 0.1 s | 8.7 s | Mobilités M, SNCF (GTFS officiel) | — | — |
| Rumilly → Annecy | 8 | 1 | 8 | 7 | 0.1 s | 6.8 s | Sibra (GTFS), SNCF (GTFS officiel) | — | jybus, cars-74 |
| Thonon-les-Bains → Genève | 17 | 0 | 15 | 8 | 0.1 s | 9.0 s | SNCF (GTFS officiel), Suisse (transport.opendata.ch) | — | start |
| Voiron → Grenoble | 18 | 0 | 18 | 18 | 0.2 s | 5.3 s | SNCF (GTFS officiel), Mobilités M, Cars Région Isère (GTFS) | — | mreso-voironnais |

Exemples (3 meilleures propositions par axe) :

**Annecy → Genève**
- Meilleur compromis · Plus rapide : 2026-11-16T07:42:52.518Z → 2026-11-16T09:13:00.000Z · marche 93 m › SNCF TER L2 · Prix à confirmer · Réalisable

**Annemasse → Saint-Julien-en-Genevois**
- Meilleur compromis · Plus rapide : 2026-11-16T07:30:00.000Z → 2026-11-16T08:26:26.357Z · SNCF C33 › SNCF C33 › marche 631 m · Prix à confirmer · Réalisable

**Ambérieu-en-Bugey → Lyon Part-Dieu**
- Meilleur compromis · Plus rapide : 2026-11-16T07:12:26.785Z → 2026-11-16T07:52:00.000Z · marche 1346 m › SNCF K23 · Prix à confirmer · Réalisable

**Chambéry → Aix-les-Bains**
- Meilleur compromis · Plus rapide : 2026-11-16T07:00:00.000Z → 2026-11-16T07:11:00.000Z · SNCF C21 · Prix à confirmer · Réalisable

**Grenoble → Crolles**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-16T07:02:04.000Z → 2026-11-16T07:42:59.000Z · marche 69 m › M Réso - Métropole Grenobloise C11 · 2,00 € · Réalisable

**Rumilly → Annecy**
- Moins cher · Meilleur compromis : 2026-11-16T12:03:51.578Z → 2026-11-16T13:00:49.298Z · marche 625 m › Sibra 42 › marche 160 m · 2,00 € · Réalisable
- Plus rapide : 2026-11-16T07:47:33.324Z → 2026-11-16T08:15:59.306Z · marche 925 m › SNCF K21 › marche 86 m · Prix à confirmer · Réalisable

**Thonon-les-Bains → Genève**
- Meilleur compromis · Plus rapide : 2026-11-16T08:27:38.441Z → 2026-11-16T09:41:19.389Z · marche 197 m › SNCF L1 › marche 2419 m · Prix à confirmer · Réalisable

**Voiron → Grenoble**
- Meilleur compromis · Plus rapide : 2026-11-16T07:19:38.452Z → 2026-11-16T07:39:00.000Z · marche 361 m › SNCF K6 · Prix à confirmer · Réalisable

