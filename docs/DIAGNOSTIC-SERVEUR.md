# Diagnostic réel des transports — serveur GitHub Actions

Exécuté le 2026-11-13T14:51:20.327Z ; départs à partir de 2026-11-16T08:00:00+01:00 ; TripGo : non (pas de clé).

| Axe | Trajets | Prix vérifié | Marches calculées | Réalisables | 1er résultat | Total | Sources | Erreurs | Attendus non vus |
|---|---|---|---|---|---|---|---|---|---|
| Annecy → Genève | 30 | 0 | 22 | 22 | 0.5 s | 6.2 s | Suisse (transport.opendata.ch), SNCF (GTFS officiel), Cars Région Haute-Savoie (GTFS) | — | longue |
| Annemasse → Saint-Julien-en-Genevois | 52 | 41 | 20 | 12 | 0.3 s | 13.5 s | Suisse (transport.opendata.ch), SNCF (GTFS officiel), TAC Annemasse (GTFS) | — | — |
| Ambérieu-en-Bugey → Lyon Part-Dieu | 10 | 0 | 8 | 3 | 0.2 s | 3.6 s | SNCF (GTFS officiel) | — | cars-01, tcl |
| Chambéry → Aix-les-Bains | 16 | 6 | 14 | 13 | 0.1 s | 6.9 s | Synchro Bus Chambéry (GTFS), SNCF (GTFS officiel) | — | ondea |
| Grenoble → Crolles | 12 | 5 | 12 | 12 | 0.1 s | 7.1 s | Mobilités M, SNCF (GTFS officiel) | — | — |
| Rumilly → Annecy | 8 | 1 | 8 | 7 | 0.1 s | 4.7 s | Sibra (GTFS), SNCF (GTFS officiel) | — | jybus, cars-74 |
| Thonon-les-Bains → Genève | 17 | 0 | 15 | 8 | 0.1 s | 9.1 s | SNCF (GTFS officiel), Suisse (transport.opendata.ch) | — | start |
| Voiron → Grenoble | 18 | 0 | 18 | 18 | 0.3 s | 5.2 s | SNCF (GTFS officiel), Mobilités M, Cars Région Isère (GTFS) | — | mreso-voironnais |
| Aix-les-Bains gare → Technolac (Ondéa 01) | 50 | 40 | 16 | 5 | 0.1 s | 8.8 s | Ondéa Aix-les-Bains (GTFS), SNCF (GTFS officiel) | — | — |
| Thonon → Bons-en-Chablais (Star’t 142) | 58 | 0 | 24 | 17 | 0.1 s | 11.4 s | SNCF (GTFS officiel), Suisse (transport.opendata.ch), Star't Thonon (GTFS) | — | — |
| Rumilly Hôpital → Base de loisirs (J’y bus 1) | 31 | 0 | 7 | 7 | 0.7 s | 2.0 s | J'y bus Rumilly (GTFS) | — | — |
| Ambérieu gare → Cabrol (TAM 2) | 67 | 0 | 16 | 15 | 0.1 s | 10.1 s | TAM Ambérieu-en-Bugey (GTFS), SNCF (GTFS officiel), Cars Région Ain (GTFS) | — | — |
| Chambéry → Chamoux-sur-Gelon (Cars Savoie S05) | 12 | 0 | 10 | 8 | 0.1 s | 4.6 s | Cars Région Savoie (GTFS), SNCF (GTFS officiel) | — | — |
| Bourg-en-Bresse → Ambérieu (Cars Ain / TER) | 12 | 0 | 0 | 0 | 0.0 s | 2.2 s | SNCF (GTFS officiel), Cars Région Ain (GTFS) | — | — |
| Voiron → Voreppe (M réso Voironnais) | 18 | 2 | 3 | 3 | 0.2 s | 1.2 s | Mobilités M, SNCF (GTFS officiel), Cars Région Isère (GTFS) | — | — |

Exemples (3 meilleures propositions par axe) :

**Annecy → Genève**
- Meilleur compromis · Plus rapide : 2026-11-16T07:42:52.518Z → 2026-11-16T09:13:00.000Z · marche 93 m › SNCF TER L2 · Prix à confirmer · Réalisable

**Annemasse → Saint-Julien-en-Genevois**
- Moins cher · Meilleur compromis : 2026-11-16T07:48:47.707Z → 2026-11-16T08:51:41.077Z · marche 102 m › TAC B 4 › marche 640 m · 1,70 € · Réalisable
- Plus rapide : 2026-11-16T08:06:00.000Z → 2026-11-16T08:31:41.584Z · SNCF TER C33 › marche 415 m › TPG B 80 › marche 230 m · Prix à confirmer · Réalisable

**Ambérieu-en-Bugey → Lyon Part-Dieu**
- Meilleur compromis · Plus rapide : 2026-11-16T07:12:26.785Z → 2026-11-16T07:52:00.000Z · marche 1346 m › SNCF K23 · Prix à confirmer · Réalisable

**Chambéry → Aix-les-Bains**
- Moins cher · Meilleur compromis : 2026-11-16T11:06:14.962Z → 2026-11-16T11:41:36.577Z · marche 286 m › Synchro Bus Chambéry 30 › marche 129 m · 1,40 € · Réalisable
- Plus rapide : 2026-11-16T07:00:00.000Z → 2026-11-16T07:11:00.000Z · SNCF C21 · Prix à confirmer · Réalisable

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

