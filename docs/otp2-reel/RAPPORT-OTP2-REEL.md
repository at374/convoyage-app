# OTP2 réel — graphe AURA–Suisse construit et interrogé

Généré automatiquement le 2026-11-16T18:34:12.323Z sur un serveur GitHub Actions (gratuit, aucun déploiement).
Jour testé : **2026-11-24**, départ à partir de 08:00 (heure de Paris). Horaires GTFS planifiés, pas de temps réel.

## Construction du graphe

- Image OTP2 : `docker.io/opentripplanner/opentripplanner:2.10.0`
- Durée de construction : 275 s
- Mémoire maximale observée : 9.932GiB
- Taille du graphe : 596 Mo
- Mémoire du serveur après chargement : 6.945GiB

## OpenStreetMap

- https://download.geofabrik.de/europe/france/rhone-alpes-latest.osm.pbf — 508 Mo, SHA-256 `b1f395369942a1b5714080036fcb0a50e96f2db0330b22ff3ee5a3191faa4232`, modifié Mon, 16 Nov 2026 05:07:18 GMT
- https://download.geofabrik.de/europe/switzerland-latest.osm.pbf — 526 Mo, SHA-256 `eece9d61fffd76b88a6e5ff81cf89d662a40b9dae580a567c90220ab103dbab6`, modifié Mon, 16 Nov 2026 00:09:12 GMT
- Extrait utilisé : 72 Mo (rectangle 4.65,45.40,6.75,46.60, voies et quais seulement). Licence ODbL, © contributeurs OpenStreetMap.

## Flux GTFS

| Flux | État | Validité | Courses le jour testé | Tarifs dans le flux | SHA-256 de l’archive officielle |
|---|---|---|---|---|---|
| oura-agregat | importé | 20261116 → 20280630 | 8070 | non | `676747aaabb21f4b…` |
| sncf | importé | 20261115 → 20270430 | 1448 | non | `c7fa334890dad1a0…` |
| suisse-ski | importé | 20251214 → 20261212 | 25388 | non | `c221979f0dc36df7…` |
| flixbus | importé | 20261115 → 20270514 | 59 | non | `6e07dd3c3a76e297…` |
| blablacar-bus | importé | 20261116 → 20270106 | 28 | non | `060450e39074e769…` |
| sibra-annecy | importé | 20261112 → 20261227 | 1833 | non | `f621165ccb9da1c3…` |
| tac-annemasse | importé | 20261103 → 20271231 | 496 | non | `fbc644c04aac5460…` |
| tcl-lyon | importé | 20261016 → 20270703 | 21320 | oui | `72e89baa74995b59…` |
| synchro-chambery | importé | 20261116 → 20261220 | 1147 | non | `7ed9fe98b45f12c1…` |
| ondea-grand-lac | importé | 20261017 → 20270331 | 520 | non | `a4e636cd3ce782e8…` |
| start-thonon | importé | 20260817 → 20261220 | 743 | non | `0a03088709f15c4d…` |

Adresses complètes, tailles et empreintes : `rapport-otp2-reel.json`.

## Axes testés

| Axe | Itinéraires OTP2 | Retenus par l’application | Meilleure durée | Erreur |
|---|---|---|---|---|
| Ambérieu-en-Bugey gare → Lyon Part-Dieu | 6 | 6 | 25 min |  |
| Lyon Part-Dieu → Ambérieu-en-Bugey gare | 3 | 3 | 24 min |  |
| Chambéry gare → Saint-Julien-en-Genevois gare | 5 | 5 | 125 min |  |
| Saint-Julien-en-Genevois gare → Chambéry gare | 1 | 1 | 125 min |  |
| Annecy gare → Genève Cornavin | 4 | 4 | 88 min |  |
| Genève Cornavin → Annecy gare | 6 | 6 | 84 min |  |
| Annecy gare → Annemasse gare | 2 | 2 | 58 min |  |
| Annemasse gare → Annecy gare | 3 | 3 | 59 min |  |
| Archamps Technopole → Genève Cornavin | 4 | 4 | 41 min |  |
| Genève Cornavin → Archamps Technopole | 6 | 6 | 37 min |  |
| Archamps Technopole → Annecy gare | 2 | 2 | 103 min |  |
| Genève Cornavin → Lausanne gare | 6 | 6 | 42 min |  |

### Ambérieu-en-Bugey gare → Lyon Part-Dieu

1. **08:00 → 08:30** (29 min, 0 correspondance(s), 67 m à pied) — Prix non confirmé
   - Marche 59 m (tracé OpenStreetMap, 12 points) : Origin 08:00 → Ambérieu-en-Bugey 08:02
   - Train K33 — SNCF VOYAGEURS — prix non confirmé : Ambérieu-en-Bugey 08:02 → Lyon Part Dieu 08:30
   - Marche 8 m (tracé OpenStreetMap, 3 points) : Lyon Part Dieu 08:30 → Destination 08:30
2. **08:05 → 08:48** (42 min, 0 correspondance(s), 67 m à pied) — Prix non confirmé
   - Marche 59 m (tracé OpenStreetMap, 12 points) : Origin 08:05 → Ambérieu-en-Bugey 08:07
   - Train C18 — SNCF VOYAGEURS — prix non confirmé : Ambérieu-en-Bugey 08:07 → Lyon Part Dieu 08:48
   - Marche 8 m (tracé OpenStreetMap, 3 points) : Lyon Part Dieu 08:48 → Destination 08:48
3. **08:26 → 08:52** (25 min, 0 correspondance(s), 67 m à pied) — Prix non confirmé
   - Marche 59 m (tracé OpenStreetMap, 12 points) : Origin 08:26 → Ambérieu-en-Bugey 08:28
   - Train K23 — SNCF VOYAGEURS — prix non confirmé : Ambérieu-en-Bugey 08:28 → Lyon Part Dieu 08:52
   - Marche 8 m (tracé OpenStreetMap, 3 points) : Lyon Part Dieu 08:52 → Destination 08:52
4. **08:35 → 09:18** (42 min, 0 correspondance(s), 67 m à pied) — Prix non confirmé
   - Marche 59 m (tracé OpenStreetMap, 12 points) : Origin 08:35 → Ambérieu-en-Bugey 08:37
   - Train C18 — SNCF VOYAGEURS — prix non confirmé : Ambérieu-en-Bugey 08:37 → Lyon Part Dieu 09:18
   - Marche 8 m (tracé OpenStreetMap, 3 points) : Lyon Part Dieu 09:18 → Destination 09:18
5. **08:55 → 09:22** (26 min, 0 correspondance(s), 67 m à pied) — Prix non confirmé
   - Marche 59 m (tracé OpenStreetMap, 12 points) : Origin 08:55 → Ambérieu-en-Bugey 08:57
   - Train K1+ — SNCF VOYAGEURS — prix non confirmé : Ambérieu-en-Bugey 08:57 → Lyon Part Dieu 09:22
   - Marche 8 m (tracé OpenStreetMap, 3 points) : Lyon Part Dieu 09:22 → Destination 09:22
6. **09:00 → 09:30** (29 min, 0 correspondance(s), 67 m à pied) — Prix non confirmé
   - Marche 59 m (tracé OpenStreetMap, 12 points) : Origin 09:00 → Ambérieu-en-Bugey 09:02
   - Train P33 — SNCF VOYAGEURS — prix non confirmé : Ambérieu-en-Bugey 09:02 → Lyon Part Dieu 09:30
   - Marche 8 m (tracé OpenStreetMap, 3 points) : Lyon Part Dieu 09:30 → Destination 09:30

### Lyon Part-Dieu → Ambérieu-en-Bugey gare

1. **08:07 → 08:32** (24 min, 0 correspondance(s), 67 m à pied) — Prix non confirmé
   - Marche 8 m (tracé OpenStreetMap, 3 points) : Origin 08:07 → Lyon Part Dieu 08:08
   - Train K23 — SNCF VOYAGEURS — prix non confirmé : Lyon Part Dieu 08:08 → Ambérieu-en-Bugey 08:31
   - Marche 59 m (tracé OpenStreetMap, 12 points) : Ambérieu-en-Bugey 08:31 → Destination 08:32
2. **08:11 → 08:55** (43 min, 0 correspondance(s), 67 m à pied) — Prix non confirmé
   - Marche 8 m (tracé OpenStreetMap, 3 points) : Origin 08:11 → Lyon Part Dieu 08:12
   - Train C18 — SNCF VOYAGEURS — prix non confirmé : Lyon Part Dieu 08:12 → Ambérieu-en-Bugey 08:54
   - Marche 59 m (tracé OpenStreetMap, 12 points) : Ambérieu-en-Bugey 08:54 → Destination 08:55
3. **08:37 → 09:03** (25 min, 0 correspondance(s), 67 m à pied) — Prix non confirmé
   - Marche 8 m (tracé OpenStreetMap, 3 points) : Origin 08:37 → Lyon Part Dieu 08:38
   - Train K1+ — SNCF VOYAGEURS — prix non confirmé : Lyon Part Dieu 08:38 → Ambérieu-en-Bugey 09:02
   - Marche 59 m (tracé OpenStreetMap, 12 points) : Ambérieu-en-Bugey 09:02 → Destination 09:03

### Chambéry gare → Saint-Julien-en-Genevois gare

1. **08:41 → 10:57** (136 min, 2 correspondance(s), 248 m à pied) — Prix non confirmé
   - Marche 33 m (tracé OpenStreetMap, 4 points) : Origin 08:41 → Chambéry - Challes-les-Eaux 08:42
   - Train K11 — SNCF VOYAGEURS — prix non confirmé : Chambéry - Challes-les-Eaux 08:42 → Genève Cornavin 10:10
   - Marche 101 m (tracé OpenStreetMap, 20 points) : Genève Cornavin 10:10 → Genève, gare Cornavin 10:11
   - Tram 14 — Transports Publics Genevois — prix non confirmé : Genève, gare Cornavin 10:15 → Genève, Stand 10:20
   - Bus 80 — Transports Publics Genevois — prix non confirmé : Genève, Stand 10:25 → Saint-Julien, centre 10:56
   - Marche 114 m (tracé OpenStreetMap, 17 points) : Saint-Julien, centre 10:56 → Destination 10:57
2. **08:41 → 10:57** (136 min, 1 correspondance(s), 1009 m à pied) — Prix non confirmé
   - Marche 33 m (tracé OpenStreetMap, 4 points) : Origin 08:41 → Chambéry - Challes-les-Eaux 08:42
   - Train K11 — SNCF VOYAGEURS — prix non confirmé : Chambéry - Challes-les-Eaux 08:42 → Genève Cornavin 10:10
   - Marche 862 m (tracé OpenStreetMap, 94 points) : Genève Cornavin 10:10 → Genève, Stand 10:22
   - Bus 80 — Transports Publics Genevois — prix non confirmé : Genève, Stand 10:25 → Saint-Julien, centre 10:56
   - Marche 114 m (tracé OpenStreetMap, 17 points) : Saint-Julien, centre 10:56 → Destination 10:57
3. **09:10 → 11:16** (125 min, 1 correspondance(s), 987 m à pied) — Prix non confirmé
   - Marche 292 m (tracé OpenStreetMap, 44 points) : Origin 09:10 → Chambéry (Central Bus Station) 09:15
   - Bus FlixBus N706 — FlixBus-eu — prix non confirmé : Chambéry (Central Bus Station) 09:15 → Annecy (Central Bus Station) 10:00
   - Marche 551 m (tracé OpenStreetMap, 82 points) : Annecy (Central Bus Station) 10:00 → Annecy, Gare routière 10:09
   - Bus 272 — Alpbus Fournier — prix non confirmé : Annecy, Gare routière 10:15 → Saint-Julien, centre 11:14
   - Marche 144 m (tracé OpenStreetMap, 30 points) : Saint-Julien, centre 11:14 → Destination 11:16
4. **09:10 → 11:16** (126 min, 1 correspondance(s), 502 m à pied) — Prix non confirmé
   - Marche 292 m (tracé OpenStreetMap, 44 points) : Origin 09:10 → Chambéry (Central Bus Station) 09:15
   - Bus FlixBus N706 — FlixBus-eu — prix non confirmé : Chambéry (Central Bus Station) 09:15 → Annecy (Central Bus Station) 10:00
   - Marche 22 m (tracé OpenStreetMap, 15 points) : Annecy (Central Bus Station) 10:00 → Gare Routiere 10:00
   - Bus 272 — REGION - cars Région Haute-Savoie — prix non confirmé : Gare Routiere 10:15 → Centre 11:14
   - Marche 188 m (tracé OpenStreetMap, 35 points) : Centre 11:14 → Destination 11:16
5. **09:48 → 12:26** (158 min, 2 correspondance(s), 665 m à pied) — Prix non confirmé
   - Marche 33 m (tracé OpenStreetMap, 4 points) : Origin 09:48 → Chambéry - Challes-les-Eaux 09:49
   - Train 621B — SNCF VOYAGEURS — prix non confirmé : Chambéry - Challes-les-Eaux 09:49 → Annecy 10:29
   - Train L2 — SNCF VOYAGEURS — prix non confirmé : Annecy 10:44 → Annemasse 11:40
   - Train C43 — SNCF VOYAGEURS — prix non confirmé : Annemasse 12:05 → Saint-Julien-en-Genevois 12:18
   - Marche 632 m (tracé OpenStreetMap, 59 points) : Saint-Julien-en-Genevois 12:18 → Destination 12:26

### Saint-Julien-en-Genevois gare → Chambéry gare

1. **09:11 → 11:16** (125 min, 1 correspondance(s), 665 m à pied) — Prix non confirmé
   - Marche 632 m (tracé OpenStreetMap, 59 points) : Origin 09:11 → Saint-Julien-en-Genevois 09:20
   - Train C33 — SNCF VOYAGEURS — prix non confirmé : Saint-Julien-en-Genevois 09:20 → Bellegarde 09:42
   - Train K11 — SNCF VOYAGEURS — prix non confirmé : Bellegarde 10:28 → Chambéry - Challes-les-Eaux 11:16
   - Marche 33 m (tracé OpenStreetMap, 4 points) : Chambéry - Challes-les-Eaux 11:16 → Destination 11:16

### Annecy gare → Genève Cornavin

1. **08:10 → 09:43** (93 min, 1 correspondance(s), 630 m à pied) — tarif partiel
   - Marche 283 m (tracé OpenStreetMap, 74 points) : Origin 08:10 → Gare Routiere 08:15
   - Bus 272 — REGION - cars Région Haute-Savoie — prix non confirmé : Gare Routiere 08:15 → Lancy Pont Rouge Gare-Etoile P+R 09:24
   - Marche 343 m (tracé OpenStreetMap, 27 points) : Lancy Pont Rouge Gare-Etoile P+R 09:24 → Lancy-Pont-Rouge 09:29
   - Train L4 — SNCF VOYAGEURS — 3.00 CHF : Lancy-Pont-Rouge 09:37 → Genève Cornavin 09:43
   - Marche 4 m (tracé OpenStreetMap, 3 points) : Genève Cornavin 09:43 → Destination 09:43
2. **08:44 → 10:12** (88 min, 1 correspondance(s), 335 m à pied) — Prix non confirmé
   - Marche 54 m (tracé OpenStreetMap, 10 points) : Origin 08:44 → Annecy - Bus Station 08:45
   - Bus BlaBlaCar Bus — BlaBlaCar Bus — prix non confirmé : Annecy - Bus Station 08:45 → Geneva - Airport Bus Station 09:35
   - Marche 168 m (tracé OpenStreetMap, 33 points) : Geneva - Airport Bus Station 09:35 → Genève-Aéroport, Terminal 09:37
   - Bus 5 — Transports Publics Genevois — prix non confirmé : Genève-Aéroport, Terminal 09:46 → Genève, gare Cornavin 10:10
   - Marche 113 m (tracé OpenStreetMap, 12 points) : Genève, gare Cornavin 10:10 → Destination 10:12
3. **08:42 → 10:13** (90 min, 0 correspondance(s), 96 m à pied) — Prix non confirmé
   - Marche 92 m (tracé OpenStreetMap, 17 points) : Origin 08:42 → Annecy 08:44
   - Train L2 — SNCF VOYAGEURS — prix non confirmé : Annecy 08:44 → Genève Cornavin 10:13
   - Marche 4 m (tracé OpenStreetMap, 3 points) : Genève Cornavin 10:13 → Destination 10:13
4. **09:10 → 10:38** (88 min, 1 correspondance(s), 831 m à pied) — Prix non confirmé
   - Marche 283 m (tracé OpenStreetMap, 74 points) : Origin 09:10 → Gare Routiere 09:15
   - Bus 272 — REGION - cars Région Haute-Savoie — prix non confirmé : Gare Routiere 09:15 → Lancy Pont Rouge Gare-Etoile P+R 10:21
   - Marche 424 m (tracé OpenStreetMap, 35 points) : Lancy Pont Rouge Gare-Etoile P+R 10:21 → Lancy-Pont-Rouge 10:27
   - Train RE33 — Schweizerische Bundesbahnen SBB — prix non confirmé : Lancy-Pont-Rouge 10:31 → Genève 10:36
   - Marche 124 m (tracé OpenStreetMap, 16 points) : Genève 10:36 → Destination 10:38

### Genève Cornavin → Annecy gare

1. **08:20 → 10:07** (107 min, 2 correspondance(s), 632 m à pied) — tarif partiel
   - Marche 123 m (tracé OpenStreetMap, 16 points) : Origin 08:20 → Genève 08:23
   - Train RE33 — Schweizerische Bundesbahnen SBB — prix non confirmé : Genève 08:23 → Lancy-Pont-Rouge 08:28
   - Marche 340 m (tracé OpenStreetMap, 33 points) : Lancy-Pont-Rouge 08:28 → Lancy-Pont-Rouge, gare/Etoile 08:32
   - Bus 272 — Alpbus Fournier — prix non confirmé : Lancy-Pont-Rouge, gare/Etoile 08:40 → Annecy, Eglise Des Fins 09:57
   - Marche 4 m (tracé OpenStreetMap, 5 points) : Annecy, Eglise Des Fins 09:57 → EGLISE DES FINS 09:57
   - Bus 2 — SIBRA — 2.00 EUR : EGLISE DES FINS 09:59 → PAUL GRIMAULT 10:05
   - Marche 165 m (tracé OpenStreetMap, 14 points) : PAUL GRIMAULT 10:05 → Destination 10:07
2. **08:20 → 10:07** (107 min, 1 correspondance(s), 827 m à pied) — Prix non confirmé
   - Marche 123 m (tracé OpenStreetMap, 16 points) : Origin 08:20 → Genève 08:23
   - Train RE33 — Schweizerische Bundesbahnen SBB — prix non confirmé : Genève 08:23 → Lancy-Pont-Rouge 08:28
   - Marche 421 m (tracé OpenStreetMap, 35 points) : Lancy-Pont-Rouge 08:28 → Lancy Pont Rouge Gare-Etoile P+R 08:34
   - Bus 272 — REGION - cars Région Haute-Savoie — prix non confirmé : Lancy Pont Rouge Gare-Etoile P+R 08:40 → Gare Routiere 10:03
   - Marche 283 m (tracé OpenStreetMap, 74 points) : Gare Routiere 10:03 → Destination 10:07
3. **08:45 → 10:17** (91 min, 0 correspondance(s), 96 m à pied) — Prix non confirmé
   - Marche 4 m (tracé OpenStreetMap, 3 points) : Origin 08:45 → Genève Cornavin 08:46
   - Train L2 — SNCF VOYAGEURS — prix non confirmé : Genève Cornavin 08:46 → Annecy 10:16
   - Marche 92 m (tracé OpenStreetMap, 17 points) : Annecy 10:16 → Destination 10:17
4. **09:00 → 10:36** (96 min, 1 correspondance(s), 586 m à pied) — tarif partiel
   - Marche 4 m (tracé OpenStreetMap, 3 points) : Origin 09:00 → Genève Cornavin 09:01
   - Train L4 — SNCF VOYAGEURS — 3.00 CHF : Genève Cornavin 09:01 → Lancy-Pont-Rouge 09:06
   - Marche 299 m (tracé OpenStreetMap, 18 points) : Lancy-Pont-Rouge 09:06 → Lancy Pont Rouge Gare-Etoile P+R 09:10
   - Bus 272 — REGION - cars Région Haute-Savoie — prix non confirmé : Lancy Pont Rouge Gare-Etoile P+R 09:25 → Gare Routiere 10:32
   - Marche 283 m (tracé OpenStreetMap, 74 points) : Gare Routiere 10:32 → Destination 10:36
5. **09:03 → 10:37** (94 min, 1 correspondance(s), 534 m à pied) — Prix non confirmé
   - Marche 139 m (tracé OpenStreetMap, 18 points) : Origin 09:03 → Genève, gare Cornavin 09:06
   - Tram 15 — Transports Publics Genevois — prix non confirmé : Genève, gare Cornavin 09:06 → Lancy-Pont-Rouge, gare/Etoile 09:23
   - Bus 272 — Alpbus Fournier — prix non confirmé : Lancy-Pont-Rouge, gare/Etoile 09:25 → Annecy, Gare routière 10:32
   - Marche 395 m (tracé OpenStreetMap, 36 points) : Annecy, Gare routière 10:32 → Destination 10:37
6. **09:15 → 10:39** (84 min, 1 correspondance(s), 416 m à pied) — tarif partiel
   - Marche 4 m (tracé OpenStreetMap, 3 points) : Origin 09:15 → Genève Cornavin 09:16
   - Train L4 — SNCF VOYAGEURS — 4.90 EUR : Genève Cornavin 09:16 → Annemasse 09:40
   - Marche 151 m (tracé OpenStreetMap, 21 points) : Annemasse 09:40 → Annemasse (Bus Station) 09:42
   - Bus FlixBus N1156 — FlixBus-eu — prix non confirmé : Annemasse (Bus Station) 09:55 → Annecy (Central Bus Station) 10:35
   - Marche 261 m (tracé OpenStreetMap, 62 points) : Annecy (Central Bus Station) 10:35 → Destination 10:39

### Annecy gare → Annemasse gare

1. **08:42 → 09:42** (60 min, 0 correspondance(s), 106 m à pied) — Prix non confirmé
   - Marche 92 m (tracé OpenStreetMap, 17 points) : Origin 08:42 → Annecy 08:44
   - Train L2 — SNCF VOYAGEURS — prix non confirmé : Annecy 08:44 → Annemasse 09:42
   - Marche 14 m (tracé OpenStreetMap, 4 points) : Annemasse 09:42 → Destination 09:42
2. **09:42 → 10:40** (58 min, 0 correspondance(s), 106 m à pied) — Prix non confirmé
   - Marche 92 m (tracé OpenStreetMap, 17 points) : Origin 09:42 → Annecy 09:44
   - Train L2 — SNCF VOYAGEURS — prix non confirmé : Annecy 09:44 → Annemasse 10:40
   - Marche 14 m (tracé OpenStreetMap, 4 points) : Annemasse 10:40 → Destination 10:40

### Annemasse gare → Annecy gare

1. **08:01 → 09:07** (66 min, 1 correspondance(s), 106 m à pied) — Prix non confirmé
   - Marche 14 m (tracé OpenStreetMap, 4 points) : Origin 08:01 → Annemasse 08:02
   - Train C43 — SNCF VOYAGEURS — prix non confirmé : Annemasse 08:02 → La Roche-sur-Foron 08:19
   - Train C13 — SNCF VOYAGEURS — prix non confirmé : La Roche-sur-Foron 08:25 → Annecy 09:06
   - Marche 92 m (tracé OpenStreetMap, 17 points) : Annecy 09:06 → Destination 09:07
2. **08:18 → 09:17** (59 min, 0 correspondance(s), 106 m à pied) — Prix non confirmé
   - Marche 14 m (tracé OpenStreetMap, 4 points) : Origin 08:18 → Annemasse 08:19
   - Train L2 — SNCF VOYAGEURS — prix non confirmé : Annemasse 08:19 → Annecy 09:16
   - Marche 92 m (tracé OpenStreetMap, 17 points) : Annecy 09:16 → Destination 09:17
3. **09:17 → 10:17** (60 min, 0 correspondance(s), 106 m à pied) — Prix non confirmé
   - Marche 14 m (tracé OpenStreetMap, 4 points) : Origin 09:17 → Annemasse 09:18
   - Train L2 — SNCF VOYAGEURS — prix non confirmé : Annemasse 09:18 → Annecy 10:16
   - Marche 92 m (tracé OpenStreetMap, 17 points) : Annecy 10:16 → Destination 10:17

### Archamps Technopole → Genève Cornavin

1. **08:00 → 08:43** (43 min, 1 correspondance(s), 1301 m à pied) — tarif partiel
   - Marche 996 m (tracé OpenStreetMap, 108 points) : Origin 08:00 → Collonges, marché 08:13
   - Bus 82 — Transports Publics Genevois — prix non confirmé : Collonges, marché 08:13 → Lancy-Bachet, gare 08:26
   - Marche 301 m (tracé OpenStreetMap, 32 points) : Lancy-Bachet, gare 08:26 → Lancy-Bachet 08:30
   - Train L4 — SNCF VOYAGEURS — 3.00 CHF : Lancy-Bachet 08:34 → Genève Cornavin 08:43
   - Marche 4 m (tracé OpenStreetMap, 3 points) : Genève Cornavin 08:43 → Destination 08:43
2. **08:16 → 08:58** (42 min, 1 correspondance(s), 1328 m à pied) — tarif partiel
   - Marche 996 m (tracé OpenStreetMap, 108 points) : Origin 08:16 → Collonges, marché 08:29
   - Bus 82 — Transports Publics Genevois — prix non confirmé : Collonges, marché 08:29 → Grand-Lancy, Préventorium 08:39
   - Marche 328 m (tracé OpenStreetMap, 26 points) : Grand-Lancy, Préventorium 08:39 → Lancy-Bachet 08:45
   - Train L1 — SNCF VOYAGEURS — 3.00 CHF : Lancy-Bachet 08:49 → Genève Cornavin 08:58
   - Marche 4 m (tracé OpenStreetMap, 3 points) : Genève Cornavin 08:58 → Destination 08:58
3. **08:31 → 09:13** (42 min, 1 correspondance(s), 1328 m à pied) — tarif partiel
   - Marche 996 m (tracé OpenStreetMap, 108 points) : Origin 08:31 → Collonges, marché 08:44
   - Bus 82 — Transports Publics Genevois — prix non confirmé : Collonges, marché 08:44 → Grand-Lancy, Préventorium 08:54
   - Marche 328 m (tracé OpenStreetMap, 26 points) : Grand-Lancy, Préventorium 08:54 → Lancy-Bachet 09:00
   - Train L2 — SNCF VOYAGEURS — 3.00 CHF : Lancy-Bachet 09:04 → Genève Cornavin 09:13
   - Marche 4 m (tracé OpenStreetMap, 3 points) : Genève Cornavin 09:13 → Destination 09:13
4. **08:47 → 09:28** (41 min, 1 correspondance(s), 1301 m à pied) — tarif partiel
   - Marche 996 m (tracé OpenStreetMap, 108 points) : Origin 08:47 → Collonges, marché 09:00
   - Bus 82 — Transports Publics Genevois — prix non confirmé : Collonges, marché 09:00 → Lancy-Bachet, gare 09:11
   - Marche 301 m (tracé OpenStreetMap, 32 points) : Lancy-Bachet, gare 09:11 → Lancy-Bachet 09:15
   - Train L3 — SNCF VOYAGEURS — 3.00 CHF : Lancy-Bachet 09:19 → Genève Cornavin 09:28
   - Marche 4 m (tracé OpenStreetMap, 3 points) : Genève Cornavin 09:28 → Destination 09:28

### Genève Cornavin → Archamps Technopole

1. **08:00 → 08:38** (38 min, 1 correspondance(s), 1146 m à pied) — tarif partiel
   - Marche 4 m (tracé OpenStreetMap, 3 points) : Origin 08:00 → Genève Cornavin 08:01
   - Train L4 — SNCF VOYAGEURS — 3.00 CHF : Genève Cornavin 08:01 → Lancy-Bachet 08:10
   - Marche 248 m (tracé OpenStreetMap, 30 points) : Lancy-Bachet 08:10 → Lancy-Bachet, gare 08:14
   - Bus 82 — Transports Publics Genevois — prix non confirmé : Lancy-Bachet, gare 08:18 → Archamps, Pont de Combe 08:27
   - Marche 894 m (tracé OpenStreetMap, 103 points) : Archamps, Pont de Combe 08:27 → Destination 08:38
2. **08:15 → 08:53** (38 min, 1 correspondance(s), 1146 m à pied) — tarif partiel
   - Marche 4 m (tracé OpenStreetMap, 3 points) : Origin 08:15 → Genève Cornavin 08:16
   - Train L4 — SNCF VOYAGEURS — 3.00 CHF : Genève Cornavin 08:16 → Lancy-Bachet 08:25
   - Marche 248 m (tracé OpenStreetMap, 30 points) : Lancy-Bachet 08:25 → Lancy-Bachet, gare 08:29
   - Bus 82 — Transports Publics Genevois — prix non confirmé : Lancy-Bachet, gare 08:33 → Archamps, Pont de Combe 08:42
   - Marche 894 m (tracé OpenStreetMap, 103 points) : Archamps, Pont de Combe 08:42 → Destination 08:53
3. **08:30 → 09:09** (39 min, 1 correspondance(s), 1146 m à pied) — tarif partiel
   - Marche 4 m (tracé OpenStreetMap, 3 points) : Origin 08:30 → Genève Cornavin 08:31
   - Train L3 — SNCF VOYAGEURS — 3.00 CHF : Genève Cornavin 08:31 → Lancy-Bachet 08:40
   - Marche 248 m (tracé OpenStreetMap, 30 points) : Lancy-Bachet 08:40 → Lancy-Bachet, gare 08:44
   - Bus 82 — Transports Publics Genevois — prix non confirmé : Lancy-Bachet, gare 08:48 → Archamps, Pont de Combe 08:58
   - Marche 894 m (tracé OpenStreetMap, 103 points) : Archamps, Pont de Combe 08:58 → Destination 09:09
4. **08:45 → 09:23** (38 min, 1 correspondance(s), 1146 m à pied) — tarif partiel
   - Marche 4 m (tracé OpenStreetMap, 3 points) : Origin 08:45 → Genève Cornavin 08:46
   - Train L2 — SNCF VOYAGEURS — 3.00 CHF : Genève Cornavin 08:46 → Lancy-Bachet 08:55
   - Marche 248 m (tracé OpenStreetMap, 30 points) : Lancy-Bachet 08:55 → Lancy-Bachet, gare 08:59
   - Bus 82 — Transports Publics Genevois — prix non confirmé : Lancy-Bachet, gare 09:04 → Archamps, Pont de Combe 09:12
   - Marche 894 m (tracé OpenStreetMap, 103 points) : Archamps, Pont de Combe 09:12 → Destination 09:23
5. **09:00 → 09:37** (37 min, 1 correspondance(s), 1146 m à pied) — tarif partiel
   - Marche 4 m (tracé OpenStreetMap, 3 points) : Origin 09:00 → Genève Cornavin 09:01
   - Train L4 — SNCF VOYAGEURS — 3.00 CHF : Genève Cornavin 09:01 → Lancy-Bachet 09:10
   - Marche 248 m (tracé OpenStreetMap, 30 points) : Lancy-Bachet 09:10 → Lancy-Bachet, gare 09:14
   - Bus 82 — Transports Publics Genevois — prix non confirmé : Lancy-Bachet, gare 09:18 → Archamps, Pont de Combe 09:26
   - Marche 894 m (tracé OpenStreetMap, 103 points) : Archamps, Pont de Combe 09:26 → Destination 09:37
6. **09:20 → 09:59** (39 min, 1 correspondance(s), 1272 m à pied) — Prix non confirmé
   - Marche 123 m (tracé OpenStreetMap, 16 points) : Origin 09:20 → Genève 09:23
   - Train RE33 — Schweizerische Bundesbahnen SBB — prix non confirmé : Genève 09:23 → Lancy-Bachet 09:32
   - Marche 255 m (tracé OpenStreetMap, 31 points) : Lancy-Bachet 09:32 → Lancy-Bachet, gare 09:36
   - Bus 82 — Transports Publics Genevois — prix non confirmé : Lancy-Bachet, gare 09:40 → Archamps, Pont de Combe 09:48
   - Marche 894 m (tracé OpenStreetMap, 103 points) : Archamps, Pont de Combe 09:48 → Destination 09:59

### Archamps Technopole → Annecy gare

1. **08:24 → 10:07** (103 min, 2 correspondance(s), 911 m à pied) — tarif partiel
   - Marche 742 m (tracé OpenStreetMap, 88 points) : Origin 08:24 → Archamps, Pont de Combe 08:34
   - Bus M — Transports Publics Genevois — prix non confirmé : Archamps, Pont de Combe 08:34 → Saint-Julien, gare 08:50
   - Bus 272 — Alpbus Fournier — prix non confirmé : Saint-Julien, gare 09:01 → Annecy, Eglise Des Fins 09:57
   - Marche 4 m (tracé OpenStreetMap, 5 points) : Annecy, Eglise Des Fins 09:57 → EGLISE DES FINS 09:57
   - Bus 2 — SIBRA — 2.00 EUR : EGLISE DES FINS 09:59 → PAUL GRIMAULT 10:05
   - Marche 165 m (tracé OpenStreetMap, 14 points) : PAUL GRIMAULT 10:05 → Destination 10:07
2. **08:24 → 10:07** (103 min, 1 correspondance(s), 1038 m à pied) — Prix non confirmé
   - Marche 742 m (tracé OpenStreetMap, 88 points) : Origin 08:24 → Archamps, Pont de Combe 08:34
   - Bus M — Transports Publics Genevois — prix non confirmé : Archamps, Pont de Combe 08:34 → Saint-Julien, gare 08:50
   - Marche 13 m (tracé OpenStreetMap, 6 points) : Saint-Julien, gare 08:50 → SNCF 08:50
   - Bus 272 — REGION - cars Région Haute-Savoie — prix non confirmé : SNCF 09:01 → Gare Routiere 10:03
   - Marche 283 m (tracé OpenStreetMap, 74 points) : Gare Routiere 10:03 → Destination 10:07

### Genève Cornavin → Lausanne gare

1. **08:02 → 08:44** (42 min, 0 correspondance(s), 150 m à pied) — Prix non confirmé
   - Marche 147 m (tracé OpenStreetMap, 19 points) : Origin 08:02 → Genève 08:05
   - Train IR90 — Schweizerische Bundesbahnen SBB — prix non confirmé : Genève 08:05 → Lausanne 08:44
   - Marche 3 m (tracé OpenStreetMap, 3 points) : Lausanne 08:44 → Destination 08:44
2. **08:05 → 08:59** (54 min, 0 correspondance(s), 174 m à pied) — Prix non confirmé
   - Marche 123 m (tracé OpenStreetMap, 16 points) : Origin 08:05 → Genève 08:08
   - Train RE33 — Schweizerische Bundesbahnen SBB — prix non confirmé : Genève 08:08 → Lausanne 08:59
   - Marche 51 m (tracé OpenStreetMap, 7 points) : Lausanne 08:59 → Destination 08:59
3. **08:21 → 09:10** (49 min, 0 correspondance(s), 150 m à pied) — Prix non confirmé
   - Marche 147 m (tracé OpenStreetMap, 19 points) : Origin 08:21 → Genève 08:24
   - Train IR95 — Schweizerische Bundesbahnen SBB — prix non confirmé : Genève 08:24 → Lausanne 09:10
   - Marche 3 m (tracé OpenStreetMap, 3 points) : Lausanne 09:10 → Destination 09:10
4. **08:32 → 09:17** (45 min, 0 correspondance(s), 356 m à pied) — Prix non confirmé
   - Marche 149 m (tracé OpenStreetMap, 21 points) : Origin 08:32 → Genève 08:35
   - Train IC1 — Schweizerische Bundesbahnen SBB — prix non confirmé : Genève 08:35 → Lausanne 09:14
   - Marche 207 m (tracé OpenStreetMap, 14 points) : Lausanne 09:14 → Destination 09:17
5. **08:35 → 09:30** (55 min, 0 correspondance(s), 257 m à pied) — Prix non confirmé
   - Marche 124 m (tracé OpenStreetMap, 16 points) : Origin 08:35 → Genève 08:38
   - Train RE33 — Schweizerische Bundesbahnen SBB — prix non confirmé : Genève 08:38 → Lausanne 09:29
   - Marche 133 m (tracé OpenStreetMap, 12 points) : Lausanne 09:29 → Destination 09:30
6. **08:51 → 09:40** (49 min, 0 correspondance(s), 354 m à pied) — Prix non confirmé
   - Marche 147 m (tracé OpenStreetMap, 19 points) : Origin 08:51 → Genève 08:54
   - Train IR15 — Schweizerische Bundesbahnen SBB — prix non confirmé : Genève 08:54 → Lausanne 09:37
   - Marche 207 m (tracé OpenStreetMap, 14 points) : Lausanne 09:37 → Destination 09:40

