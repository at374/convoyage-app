# Diagnostic réel des transports — serveur GitHub Actions

Exécuté le 2026-11-13T10:39:53.871Z ; départs à partir de 2026-11-16T08:00:00+01:00 ; TripGo : non (pas de clé).

| Axe | Trajets | Prix vérifié | Marches calculées | Réalisables | 1er résultat | Total | Sources | Erreurs | Attendus non vus |
|---|---|---|---|---|---|---|---|---|---|
| Annecy → Genève | 22 | 0 | 14 | 14 | 0.4 s | 5.8 s | SNCF (GTFS officiel), Cars Région Haute-Savoie (GTFS) | Suisse : fetch failed | cff, longue |
| Annemasse → Saint-Julien-en-Genevois | 44 | 1 | 12 | 4 | 0.3 s | 5.5 s | SNCF (GTFS officiel), TAC Annemasse (GTFS) | Suisse : fetch failed | tpg-fr |
| Ambérieu-en-Bugey → Lyon Part-Dieu | 10 | 0 | 8 | 3 | 0.1 s | 3.6 s | SNCF (GTFS officiel) | — | cars-01, tcl |
| Chambéry → Aix-les-Bains | 16 | 0 | 14 | 13 | 0.1 s | 6.9 s | SNCF (GTFS officiel), Synchro Bus Chambéry (GTFS) | — | ondea |
| Grenoble → Crolles | 12 | 5 | 12 | 12 | 0.1 s | 5.8 s | Mobilités M, SNCF (GTFS officiel) | — | — |
| Rumilly → Annecy | 8 | 1 | 8 | 7 | 0.1 s | 4.5 s | Sibra (GTFS), SNCF (GTFS officiel) | — | jybus, cars-74 |
| Thonon-les-Bains → Genève | 9 | 0 | 8 | 1 | 0.1 s | 3.6 s | SNCF (GTFS officiel) | Suisse : fetch failed | start, tpg-fr |
| Voiron → Grenoble | 18 | 0 | 18 | 18 | 0.3 s | 5.3 s | SNCF (GTFS officiel), Mobilités M, Cars Région Isère (GTFS) | — | mreso-voironnais |
| Aix-les-Bains gare → Technolac (Ondéa 01) | 50 | 40 | 16 | 5 | 0.1 s | 8.8 s | Ondéa Aix-les-Bains (GTFS), SNCF (GTFS officiel) | — | — |
| Thonon → Bons-en-Chablais (Star’t 142) | 50 | 0 | 16 | 9 | 0.1 s | 9.6 s | SNCF (GTFS officiel), Star't Thonon (GTFS) | Suisse : fetch failed | — |
| Rumilly Hôpital → Base de loisirs (J’y bus 1) | 31 | 0 | 7 | 7 | 0.7 s | 1.9 s | J'y bus Rumilly (GTFS) | — | — |
| Ambérieu gare → Cabrol (TAM 2) | 67 | 0 | 16 | 15 | 0.1 s | 10.1 s | TAM Ambérieu-en-Bugey (GTFS), SNCF (GTFS officiel), Cars Région Ain (GTFS) | — | — |
| Chambéry → Chamoux-sur-Gelon (Cars Savoie S05) | 12 | 0 | 10 | 8 | 0.1 s | 4.7 s | Cars Région Savoie (GTFS), SNCF (GTFS officiel) | — | — |
| Bourg-en-Bresse → Ambérieu (Cars Ain / TER) | 12 | 0 | 0 | 0 | 0.1 s | 2.2 s | SNCF (GTFS officiel), Cars Région Ain (GTFS) | — | — |
| Voiron → Voreppe (M réso Voironnais) | 18 | 2 | 3 | 3 | 0.1 s | 1.2 s | Mobilités M, SNCF (GTFS officiel), Cars Région Isère (GTFS) | — | — |

Exemples (3 meilleures propositions par axe) :

**Annecy → Genève**
- Meilleur compromis · Plus rapide : 2026-11-16T07:42:57.390Z → 2026-11-16T09:27:19.389Z · marche 86 m › SNCF L2 › marche 2419 m · Prix à confirmer · Réalisable

**Annemasse → Saint-Julien-en-Genevois**
- Moins cher · Meilleur compromis : 2026-11-16T07:20:00.000Z → 2026-11-16T08:41:53.607Z · SNCF L4 › marche 5341 m · 4,80 € · Réalisable
- Plus rapide : 2026-11-16T07:30:00.000Z → 2026-11-16T08:26:26.357Z · SNCF C33 › SNCF C33 › marche 631 m · Prix à confirmer · Réalisable

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

**Aix-les-Bains gare → Technolac (Ondéa 01)**
- Moins cher : 2026-11-16T07:06:00.000Z → 2026-11-16T07:36:00.000Z · Ondéa Aix-les-Bains 03 › Ondéa Aix-les-Bains 01 · 1,70 € · Transport non confirmé (marches non calculées (quota de la fiche))
- Meilleur compromis · Plus rapide : 2026-11-16T07:13:00.000Z → 2026-11-16T07:56:56.409Z · SNCF P3 › marche 3361 m · Prix à confirmer · Réalisable

**Thonon → Bons-en-Chablais (Star’t 142)**
- Meilleur compromis · Plus rapide : 2026-11-16T07:28:02.877Z → 2026-11-16T07:54:10.713Z · marche 154 m › SNCF C33 › marche 804 m · Prix à confirmer · Réalisable

**Rumilly Hôpital → Base de loisirs (J’y bus 1)**
- Meilleur compromis · Plus rapide : 2026-11-16T07:18:00.000Z → 2026-11-16T07:43:00.000Z · J'y bus Rumilly 1 · Prix à confirmer · Réalisable

**Ambérieu gare → Cabrol (TAM 2)**
- Meilleur compromis · Plus rapide : 2026-11-16T07:00:00.000Z → 2026-11-16T07:17:00.000Z · TAM Ambérieu-en-Bugey TAM 2 · Prix à confirmer · Réalisable

**Chambéry → Chamoux-sur-Gelon (Cars Savoie S05)**
- Meilleur compromis · Plus rapide : 2026-11-16T11:30:00.000Z → 2026-11-16T12:38:00.000Z · Cars Région Savoie S05 · Prix à confirmer · Réalisable

**Bourg-en-Bresse → Ambérieu (Cars Ain / TER)**
- Meilleur compromis · Plus rapide : 2026-11-16T09:45:00.000Z → 2026-11-16T10:01:00.000Z · SNCF K13 · Prix à confirmer · Transport non confirmé (marche jusqu’à Bourg-en-Bresse non calculée · marche depuis Ambérieu-en-Bugey non calculée)

**Voiron → Voreppe (M réso Voironnais)**
- Moins cher · Meilleur compromis : 2026-11-16T07:07:40.000Z → 2026-11-16T07:34:07.000Z · marche 389 m › M Réso - Métropole Grenobloise C13 › marche 61 m · 2,00 € · Réalisable
- Plus rapide : 2026-11-16T07:10:26.000Z → 2026-11-16T07:35:43.000Z · marche 358 m › Mobilités M - SNCF C6 › marche 89 m › M Réso - Métropole Grenobloise C13 › marche 40 m · Prix à confirmer · Réalisable

