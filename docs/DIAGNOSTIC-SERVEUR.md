# Diagnostic réel des transports — serveur GitHub Actions

Exécuté le 2026-11-14T14:50:08.140Z ; départs à partir de 2026-11-16T08:00:00+01:00 ; TripGo : non (pas de clé).

**Bilan : 956 trajets sur 23 axes, 316 avec prix vérifié (33.1 %), 953 avec marches calculées (99.7 %), 166 réalisables, 370 en horaire programmé (officiel, marches et marge vérifiées, sans temps réel).**

**TripGo : 0 trajets, 0 avec prix vérifié, 0 portions avec billet chiffré.**

Portions TripGo sans prix par opérateur : aucune.

Exemples de lignes sans tarif (3 par opérateur et par axe) :

- annecy-geneve / SNCF : Train TER L2 (Annecy → Genève) ; Train L2 (Annecy → Genève-Eaux-Vives) ; Train K21 (Annecy → Aix-les-Bains le Revard)
- annecy-geneve / SBB : Train R L4 (Annemasse → Genève)
- annecy-geneve / FlixBus : Car FlixBus 1749 (Annecy (Central Bus Station) → Geneva (central bus station)) ; Car FlixBus 789 (Annecy (Central Bus Station) → Geneva (central bus station)) ; Car FlixBus 1749 (Annecy (Central Bus Station) → Geneva Airport (Bus Station))
- annecy-geneve / Cars Région Haute-Savoie : Bus 272 (Gare Routiere → Aéroport) ; Bus 274 (Aéroport → Poste) ; Bus 274 (Aéroport → Mont-Blanc)
- annecy-geneve / BlaBlaCar Bus : Car BlaBlaCar Bus (Annecy - Bus Station → Geneva - Bus Station) ; Car BlaBlaCar Bus (Annecy - Bus Station → Geneva - Airport Bus Station) ; Car BlaBlaCar Bus (Geneva - Airport Bus Station → Geneva - Bus Station)
- annemasse-stjulien / SNCF : Train TER C33 (Annemasse → Saint-Julien-en-Genevois) ; Train L1 (Annemasse → Machilly) ; Train L1 (Machilly → Lancy-Bachet)
- annemasse-stjulien / TPG : Bus B 80 (Saint-Julien, gare → Saint-Julien, centre) ; Bus B 80 (Lancy-Bachet, gare → Saint-Julien, centre)
- annemasse-stjulien / SBB : Train RE 33 (Annemasse → Lancy-Bachet) ; Train R L4 (Annemasse → Lancy-Bachet) ; Train R L1 (Annemasse → Lancy-Bachet)
- amberieu-lyon / SNCF : Train K23 (Ambérieu-en-Bugey → Lyon Part Dieu) ; Train C18 (Ambérieu-en-Bugey → Lyon Part Dieu) ; Train K1+ (Ambérieu-en-Bugey → Lyon Part Dieu)
- chambery-aix / SNCF : Train 621B (Chambéry - Challes-les-Eaux → Aix-les-Bains le Revard) ; Train C21 (Chambéry - Challes-les-Eaux → Aix-les-Bains le Revard) ; Train P41 (Chambéry - Challes-les-Eaux → Aix-les-Bains le Revard)
- chambery-aix / FlixBus : Car FlixBus 789 (Chambéry (Central Bus Station) → Aix-les-Bains (Centre Commercial Drumettaz)) ; Car FlixBus 1789 (Chambéry (Central Bus Station) → Aix-les-Bains (Centre Commercial Drumettaz))
- chambery-aix / Ondéa Aix-les-Bains : Bus 419 (Jeu de Paume → Gare 3 Wilson) ; Bus 419 (Jeu de Paume → Alliu) ; Bus 419 (Jeu de Paume → Boissy)
- grenoble-crolles / SNCF : Train C6 (Grenoble → Échirolles) ; Train C1 (Échirolles → Lancey) ; Train C31 (Grenoble → Lancey)
- grenoble-crolles / BlaBlaCar Bus : Car BlaBlaCar Bus (Grenoble - Bus Station → Crolles - Le Rafour)
- rumilly-annecy / SNCF : Train K21 (Rumilly → Annecy) ; Train C21 (Rumilly → Annecy) ; Train C21 (Rumilly → Albens)
- thonon-geneve / SNCF : Train L1 (Thonon-les-Bains → Genève-Eaux-Vives) ; Train TER C33 (Thonon-les-Bains → Annemasse) ; Train C33 (Évian-les-Bains → Annemasse)
- thonon-geneve / But : Bus B 002278 (Thonon-les-Bains, Georges And. → Thonon-les-Bains, Les Arts) ; Bus B 002279 (Thonon-les-Bains, Georges And. → Thonon-les-Bains, Les Arts) ; Bus B 002283 (Thonon-les-Bains, Georges And. → Thonon-les-Bains, Les Arts)
- thonon-geneve / AFO : Bus B 271 (Thonon-les-Bains, Les Arts → Genève, Place des Eaux-Vives)
- thonon-geneve / SBB : Train R L3 (Annemasse → Genève)
- thonon-geneve / FlixBus : Car FlixBus S1736 (Thonon-les-Bains → Annecy (Central Bus Station)) ; Car FlixBus 1726 (Annecy (Central Bus Station) → Geneva (central bus station)) ; Car FlixBus N872 (Annecy (Central Bus Station) → Geneva (central bus station))
- voiron-grenoble / SNCF : Train K6 (Voiron → Grenoble) ; Train C6 (Voiron → Réaumont - Saint-Cassien) ; Train C6 (Réaumont - Saint-Cassien → Grenoble)
- voiron-grenoble / Mobilités M - SNCF : Train C6 (Voiron, Voiron → Grenoble, Grenoble) ; Train K6 (Voiron, Voiron → Grenoble, Grenoble)
- voiron-grenoble / Cars Région Isère : Bus T41 (Gare Routière Nord → Gare Routière) ; Bus T40 (Gare Routière → Gare Routière) ; Bus T55 (Gare Routière Sud → Gare Routière)
- voiron-grenoble / BlaBlaCar Bus : Car BlaBlaCar Bus (Voiron - Champfeuillet → Grenoble - Bus Station)
- voiron-grenoble / FlixBus : Car FlixBus N709 (Voiron (Champfeuillet) → Grenoble (Central Bus Station))
- aix-technolac / SNCF : Train P3 (Aix-les-Bains le Revard → Viviers-du-Lac) ; Train K3 (Aix-les-Bains le Revard → Chambéry - Challes-les-Eaux) ; Train P3 (Chambéry - Challes-les-Eaux → Viviers-du-Lac)
- thonon-bons / SNCF : Train C33 (Thonon-les-Bains → Bons-en-Chablais) ; Train L1 (Thonon-les-Bains → Évian-les-Bains) ; Train L1 (Évian-les-Bains → Bons-en-Chablais)
- thonon-bons / But : Bus B 142 (Thonon-les-Bains, Les Arts → Bons-en-Chablais, Mairie) ; Bus B 142 (Bons-en-Chablais, Gare Didier → Bons-en-Chablais, Mairie)
- thonon-bons / Evian : Bus B 01 (Thonon-les-Bains, Les Arts → Évian-les-Bains, Anna Noailles)
- thonon-bons / Star't Thonon : Bus 142 (Les Arts → Sacré Coeur) ; Bus L (Mairie → Presbytère) ; Bus L (Sacré Coeur → Presbytère)
- chambery-chamoux / SNCF : Train P31 (Chambéry - Challes-les-Eaux → Chamousset) ; Train P41 (Chambéry - Challes-les-Eaux → Saint-Pierre-d'Albigny) ; Train P41 (Chambéry - Challes-les-Eaux → Aix-les-Bains le Revard)
- chambery-chamoux / Cars Région Savoie : Bus S05 (Gare Routiere → Ecoles)
- bourg-amberieu / SNCF : Train K13 (Bourg-en-Bresse → Ambérieu-en-Bugey) ; Train K13 (Bourg-en-Bresse → Saint-Amour) ; Train K13 (Saint-Amour → Ambérieu-en-Bugey)
- bourg-amberieu / Cars Région Ain : Bus A32 (Berthelot → Carré Amiot (Quai E)) ; Bus A32 (SNCF → Carré Amiot (Quai E))
- geneve-lausanne / SBB : Train IR 90 (Genève → Lausanne) ; Train RE 33 (Genève → Lausanne) ; Train IR 95 (Genève → Lausanne)
- geneve-lausanne / BlaBlaCar Bus : Car BlaBlaCar Bus (Geneva - Airport Bus Station → Lausanne) ; Car BlaBlaCar Bus (Geneva - Bus Station → Annecy - Bus Station) ; Car BlaBlaCar Bus (Annecy - Bus Station → Lausanne)
- geneve-lausanne / FlixBus : Car FlixBus 1689 (Geneva (central bus station) → Lausanne (P+R Vélodrome)) ; Car FlixBus 122 (Geneva (central bus station) → Lausanne (P+R Vélodrome)) ; Car FlixBus 1749 (Geneva (central bus station) → Lausanne (P+R Vélodrome))
- annemasse-geneve / SBB : Train R L4 (Annemasse → Genève) ; Train RE 33 (Annemasse → Genève) ; Train R L1 (Annemasse → Genève)
- annemasse-geneve / SNCF : Train L1 (Annemasse → Machilly) ; Train L1 (Machilly → Genève-Eaux-Vives) ; Train L4 (Annemasse → Genève-Eaux-Vives)
- stjulien-geneve / TPG : Bus B 80 (Saint-Julien, centre → Genève, Stand) ; Bus B 80 (Saint-Julien, centre → Lancy-Bachet, gare)
- stjulien-geneve / Cars Région Haute-Savoie : Bus 272 (SNCF → Aéroport) ; Bus 274 (Aéroport → Poste) ; Bus 274 (Aéroport → Mont-Blanc)
- stjulien-geneve / SNCF : Train C33 (Saint-Julien-en-Genevois → Annemasse) ; Train L3 (Annemasse → Genève-Eaux-Vives) ; Train L3 (Annemasse → Genève-Champel)
- archamps-geneve / TPG : Bus B 82 (Collonges, marché → Lancy-Bachet, gare)
- chambery-stjulien / SNCF : Train TER C21 (Chambéry-Challes-les-Eaux → Annecy) ; Train C21 (Chambéry - Challes-les-Eaux → Annecy) ; Train L2 (Annecy → Lancy-Bachet)
- chambery-stjulien / AFO : Bus B 272 (Annecy, Gare routière → Saint-Julien, centre)
- chambery-stjulien / TPG : Bus B 80 (Lancy-Bachet, gare → Saint-Julien, centre)
- annecy-chambery / SNCF : Train K21 (Annecy → Chambéry - Challes-les-Eaux) ; Train C21 (Annecy → Chambéry - Challes-les-Eaux) ; Train L2 (Annecy → Genève Cornavin)
- annecy-chambery / BlaBlaCar Bus : Car BlaBlaCar Bus (Annecy - Bus Station → Chambéry - Bus Station) ; Car BlaBlaCar Bus (Annecy - Bus Station → Geneva - Airport Bus Station) ; Car BlaBlaCar Bus (Geneva - Airport Bus Station → Chambéry - Bus Station)
- annecy-chambery / FlixBus : Car FlixBus 1726 (Annecy (Central Bus Station) → Chambéry (Central Bus Station)) ; Car FlixBus 1789 (Annecy (Central Bus Station) → Chambéry (Central Bus Station)) ; Car FlixBus 739 (Annecy (Central Bus Station) → Chambéry (Central Bus Station))
- lyon-grenoble / SNCF : Train K6 (Lyon Part Dieu → Grenoble) ; Train K54 (Lyon Part Dieu → Valence Ville) ; Train K21 (Valence Ville → Grenoble)
- lyon-grenoble / FlixBus : Car FlixBus 766 (Lyon (Gerland Bus Station) → Grenoble (Central Bus Station)) ; Car FlixBus 106 (Lyon (Gerland Bus Station) → Geneva (central bus station)) ; Car FlixBus 739 (Geneva (central bus station) → Grenoble (Central Bus Station))
- lyon-grenoble / BlaBlaCar Bus : Car BlaBlaCar Bus (Lyon - Gerland Bus Station → Grenoble - Bus Station) ; Car BlaBlaCar Bus (Lyon - Gerland Bus Station → Annecy - Bus Station) ; Car BlaBlaCar Bus (Annecy - Bus Station → Grenoble - Bus Station)
- lyon-intra / SNCF : Train C23 (Lyon Part Dieu → Lyon Perrache) ; Train C15 (Lyon Part Dieu → Lyon Perrache) ; Train 601A (Lyon Part Dieu → Lyon Perrache)
- voiron-voreppe / SNCF : Train C6 (Voiron → Voreppe) ; Train C31 (Voiron → Réaumont - Saint-Cassien) ; Train C6 (Réaumont - Saint-Cassien → Voreppe)
- voiron-voreppe / Mobilités M - SNCF : Train C6 (Voiron, Voiron → Voreppe, Voreppe)
- voiron-voreppe / Cars Région Isère : Bus T41 (Gare Routière Nord → Gare Routière) ; Bus T40 (Gare Routière → Place Docteur Thévenet) ; Bus T40 (Gare Routière → La Verronière)

Lignes bloquant les itinéraires partiellement tarifés :

- chambery-aix / Ondéa Aix-les-Bains : 419
- thonon-geneve / But : B 002289
- thonon-geneve / AFO : B 271
- thonon-bons / Star't Thonon : 142, L
- bourg-amberieu / Cars Région Ain : A32
- annemasse-geneve / SBB : R L7
- stjulien-geneve / TPG : B 80
- archamps-geneve / TPG : B 82
- chambery-stjulien / SNCF : TER K11, K11
- chambery-stjulien / TPG : B 80
- voiron-voreppe / Mobilités M - SNCF : C6

Correspondances bloquant les itinéraires partiellement tarifés : Ondéa Aix-les-Bains (34), Star't Thonon (26), TPG (8), SNCF (3), Cars Région Ain (2), SBB (2), But (1), AFO (1), Mobilités M - SNCF (1).

Portions sans prix par opérateur (toutes sources) : SNCF (626), Cars Région Haute-Savoie (96), FlixBus (75), BlaBlaCar Bus (66), Ondéa Aix-les-Bains (35), Star't Thonon (34), SBB (27), Cars Région Isère (24), TPG (20), But (16), AFO (7), Mobilités M - SNCF (3), Evian (2), Cars Région Savoie (2), Cars Région Ain (2).

| Axe | Trajets | Prix vérifié | Marches calculées | Réalisables | Horaire programmé | 1er résultat | Total | Sources | Erreurs | Attendus non vus |
|---|---|---|---|---|---|---|---|---|---|---|
| Annecy → Genève | 57 | 0 | 57 | 14 | 25 | 0.3 s | 17.8 s | Suisse (transport.opendata.ch), SNCF (GTFS officiel), SNCF (GTFS), FlixBus (GTFS), Cars Région Haute-Savoie (GTFS), BlaBlaCar Bus (GTFS) | — | — |
| Annemasse → Saint-Julien-en-Genevois | 71 | 54 | 71 | 12 | 21 | 0.3 s | 19.3 s | Suisse (transport.opendata.ch), SNCF (GTFS officiel), SNCF (GTFS), TAC Annemasse (GTFS) | — | — |
| Ambérieu-en-Bugey → Lyon Part-Dieu | 27 | 0 | 27 | 5 | 0 | 0.2 s | 6.0 s | SNCF (GTFS officiel), SNCF (GTFS) | — | — |
| Chambéry → Aix-les-Bains | 55 | 4 | 55 | 5 | 44 | 0.1 s | 10.6 s | Synchro Bus Chambéry (GTFS), Synchro Chambéry (GTFS), SNCF (GTFS officiel), SNCF (GTFS), FlixBus (GTFS), Ondéa Aix-les-Bains (GTFS) | — | — |
| Grenoble → Crolles | 28 | 5 | 28 | 12 | 6 | 0.1 s | 6.8 s | Mobilités M, SNCF (GTFS officiel), SNCF (GTFS), BlaBlaCar Bus (GTFS) | — | — |
| Rumilly → Annecy | 19 | 1 | 19 | 6 | 4 | 0.1 s | 4.0 s | Sibra (GTFS), SNCF (GTFS officiel), SNCF (GTFS) | — | — |
| Thonon-les-Bains → Genève | 37 | 0 | 36 | 9 | 0 | 0.1 s | 9.7 s | SNCF (GTFS officiel), Suisse (transport.opendata.ch), SNCF (GTFS), FlixBus (GTFS) | — | — |
| Voiron → Grenoble | 17 | 0 | 17 | 6 | 11 | 0.2 s | 10.2 s | SNCF (GTFS officiel), SNCF (GTFS), Mobilités M, Cars Région Isère (GTFS), BlaBlaCar Bus (GTFS), FlixBus (GTFS) | — | — |
| Aix-les-Bains gare → Technolac (Ondéa 01) | 55 | 40 | 55 | 1 | 1 | 0.4 s | 6.3 s | Ondéa Aix-les-Bains (GTFS), SNCF (GTFS officiel), SNCF (GTFS) | — | — |
| Thonon → Bons-en-Chablais (Star’t 142) | 64 | 7 | 64 | 11 | 32 | 0.2 s | 16.8 s | Star't Thonon (GTFS), SNCF (GTFS officiel), SNCF (GTFS), Suisse (transport.opendata.ch) | — | — |
| Rumilly Hôpital → Base de loisirs (J’y bus 1) | 51 | 51 | 51 | 0 | 49 | 0.4 s | 9.0 s | J’y bus Rumilly (GTFS), J'y bus Rumilly (GTFS) | — | — |
| Ambérieu gare → Cabrol (TAM 2) | 76 | 76 | 76 | 0 | 75 | 0.3 s | 11.1 s | TAM Ambérieu (GTFS), TAM Ambérieu-en-Bugey (GTFS), Cars Région Ain (GTFS) | — | — |
| Chambéry → Chamoux-sur-Gelon (Cars Savoie S05) | 21 | 0 | 21 | 8 | 3 | 0.0 s | 4.3 s | SNCF (GTFS officiel), SNCF (GTFS), Cars Région Savoie (GTFS) | — | — |
| Bourg-en-Bresse → Ambérieu (Cars Ain / TER) | 18 | 1 | 18 | 3 | 5 | 0.0 s | 6.6 s | Cars Région Ain (GTFS), SNCF (GTFS officiel), SNCF (GTFS) | — | — |
| Genève → Lausanne | 26 | 0 | 26 | 8 | 10 | 0.1 s | 6.2 s | Suisse (transport.opendata.ch), BlaBlaCar Bus (GTFS), FlixBus (GTFS) | — | — |
| Annemasse → Genève | 32 | 0 | 30 | 11 | 19 | 0.2 s | 2.4 s | Suisse (transport.opendata.ch), SNCF (GTFS officiel), SNCF (GTFS) | — | — |
| Saint-Julien-en-Genevois → Genève | 70 | 10 | 70 | 8 | 32 | 0.1 s | 9.2 s | SNCF (GTFS officiel), Suisse (transport.opendata.ch), Cars Région Haute-Savoie (GTFS), SNCF (GTFS) | — | — |
| Archamps → Genève | 27 | 23 | 27 | 8 | 0 | 0.2 s | 5.5 s | Suisse (transport.opendata.ch), SNCF (GTFS officiel), SNCF (GTFS) | — | — |
| Chambéry → Saint-Julien-en-Genevois | 16 | 0 | 16 | 12 | 0 | 0.2 s | 4.4 s | Suisse (transport.opendata.ch), SNCF (GTFS officiel), SNCF (GTFS) | — | — |
| Annecy → Chambéry | 46 | 0 | 46 | 7 | 14 | 0.2 s | 2.4 s | SNCF (GTFS officiel), SNCF (GTFS), BlaBlaCar Bus (GTFS), FlixBus (GTFS) | — | — |
| Lyon → Grenoble | 60 | 0 | 60 | 7 | 8 | 0.1 s | 5.7 s | SNCF (GTFS officiel), SNCF (GTFS), FlixBus (GTFS), BlaBlaCar Bus (GTFS) | — | — |
| Lyon Part-Dieu → Bellecour (TCL) | 51 | 42 | 51 | 1 | 4 | 0.9 s | 17.7 s | Marche (Valhalla / OpenStreetMap), SNCF (GTFS), TCL Lyon (GTFS), TCL (GTFS) | — | — |
| Voiron → Voreppe (M réso Voironnais) | 32 | 2 | 32 | 12 | 7 | 0.2 s | 3.6 s | Mobilités M, SNCF (GTFS officiel), SNCF (GTFS), Cars Région Isère (GTFS) | — | — |

Exemples (3 meilleures propositions par axe) :

**Annecy → Genève**
- Meilleur compromis · Plus rapide : 2026-11-16T07:42:52.518Z → 2026-11-16T09:13:00.000Z · marche 93 m › SNCF TER L2 · Prix à confirmer · Réalisable

**Annemasse → Saint-Julien-en-Genevois**
- Moins cher · Meilleur compromis : 2026-11-16T07:48:47.707Z → 2026-11-16T08:51:41.077Z · marche 102 m › TAC B 4 › marche 640 m · 1,70 € · Réalisable
- Plus rapide : 2026-11-16T08:06:00.000Z → 2026-11-16T08:31:41.584Z · SNCF TER C33 › marche 415 m › TPG B 80 › marche 230 m · Prix à confirmer · Réalisable

**Ambérieu-en-Bugey → Lyon Part-Dieu**
- Meilleur compromis · Plus rapide : 2026-11-16T07:12:26.785Z → 2026-11-16T07:52:00.000Z · marche 1346 m › SNCF K23 · Prix à confirmer · Réalisable

**Chambéry → Aix-les-Bains**
- Moins cher : 2026-11-16T11:06:14.962Z → 2026-11-16T11:41:36.577Z · marche 286 m › Synchro Bus Chambéry 30 › marche 129 m · 1,40 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)
- Meilleur compromis · Plus rapide : 2026-11-16T08:49:00.000Z → 2026-11-16T08:58:00.000Z · SNCF 621B · Prix à confirmer · Réalisable

**Grenoble → Crolles**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-16T07:02:04.000Z → 2026-11-16T07:42:59.000Z · marche 69 m › M Réso - Métropole Grenobloise C11 · 2,00 € · Réalisable

**Rumilly → Annecy**
- Moins cher : 2026-11-16T12:03:51.578Z → 2026-11-16T13:00:49.298Z · marche 625 m › Sibra 42 › marche 160 m · 2,00 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)
- Meilleur compromis · Plus rapide : 2026-11-16T07:47:33.324Z → 2026-11-16T08:15:59.306Z · marche 925 m › SNCF K21 › marche 86 m · Prix à confirmer · Réalisable

**Thonon-les-Bains → Genève**
- Meilleur compromis · Plus rapide : 2026-11-16T08:27:38.441Z → 2026-11-16T09:41:19.389Z · marche 197 m › SNCF L1 › marche 2419 m · Prix à confirmer · Réalisable

**Voiron → Grenoble**
- Meilleur compromis · Plus rapide : 2026-11-16T07:19:38.452Z → 2026-11-16T07:39:00.000Z · marche 361 m › SNCF K6 · Prix à confirmer · Réalisable

**Aix-les-Bains gare → Technolac (Ondéa 01)**
- Moins cher : 2026-11-16T06:54:10.782Z → 2026-11-16T07:39:00.000Z · marche 894 m › Ondéa Aix-les-Bains 03 › Ondéa Aix-les-Bains 01 · 1,70 € · Transport non confirmé (horaire GTFS local non confirmé en temps réel · départ avant la fin de la mission précédente)
- Meilleur compromis · Plus rapide : 2026-11-16T07:13:00.000Z → 2026-11-16T07:56:56.409Z · SNCF P3 › marche 3361 m · Prix à confirmer · Réalisable

**Thonon → Bons-en-Chablais (Star’t 142)**
- Moins cher : 2026-11-16T07:01:00.000Z → 2026-11-16T07:50:00.000Z · Star't Thonon 142 · 2,20 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)
- Meilleur compromis · Plus rapide : 2026-11-16T07:28:02.877Z → 2026-11-16T07:54:10.713Z · marche 154 m › SNCF C33 › marche 804 m · Prix à confirmer · Réalisable

**Rumilly Hôpital → Base de loisirs (J’y bus 1)**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-16T08:58:00.000Z → 2026-11-16T09:22:00.000Z · J’y bus Rumilly 1 · 1,00 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)

**Ambérieu gare → Cabrol (TAM 2)**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-16T07:40:00.000Z → 2026-11-16T07:56:00.000Z · TAM Ambérieu TAM 2 · 1,10 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)

**Chambéry → Chamoux-sur-Gelon (Cars Savoie S05)**
- Meilleur compromis · Plus rapide : 2026-11-16T07:28:26.574Z → 2026-11-16T08:49:14.460Z · marche 346 m › SNCF P31 › marche 2867 m · Prix à confirmer · Réalisable

**Bourg-en-Bresse → Ambérieu (Cars Ain / TER)**
- Moins cher : 2026-11-16T14:33:00.000Z → 2026-11-16T17:57:27.767Z · Cars Région Ain A19 › Cars Région Ain A27 › marche 38 m · 2,30 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)
- Meilleur compromis · Plus rapide : 2026-11-16T09:43:55.631Z → 2026-11-16T10:01:33.893Z · marche 93 m › SNCF K13 › marche 46 m · Prix à confirmer · Réalisable

**Genève → Lausanne**
- Meilleur compromis · Plus rapide : 2026-11-16T07:05:00.000Z → 2026-11-16T07:44:00.000Z · SBB IR 90 · Prix à confirmer · Réalisable

**Annemasse → Genève**
- Meilleur compromis · Plus rapide : 2026-11-16T07:20:00.000Z → 2026-11-16T07:43:00.000Z · SBB R L4 · Prix à confirmer · Réalisable

**Saint-Julien-en-Genevois → Genève**
- Moins cher : 2026-11-16T06:00:48.640Z → 2026-11-16T07:13:00.000Z · marche 5341 m › SNCF L2 · 3,00 CHF · Transport non confirmé (départ avant la fin de la mission précédente)
- Meilleur compromis : 2026-11-16T07:39:00.960Z → 2026-11-16T08:29:38.794Z · marche 230 m › TPG B 80 › marche 848 m · Prix à confirmer · Réalisable
- Plus rapide : 2026-11-16T07:17:00.960Z → 2026-11-16T07:58:00.000Z · marche 230 m › TPG B 80 › marche 115 m › SBB R L1 · Prix à confirmer · Réalisable

**Archamps → Genève**
- Moins cher : 2026-11-16T07:51:15.473Z → 2026-11-16T08:43:00.000Z · marche 1713 m › TPG B 44 › TPG T 18 › marche 115 m › SBB R L4 · 3,00 CHF · Réalisable
- Meilleur compromis · Plus rapide : 2026-11-16T07:47:51.967Z → 2026-11-16T08:28:00.000Z · marche 1054 m › TPG B 82 › marche 115 m › SBB R L3 · Prix à confirmer · Réalisable

**Chambéry → Saint-Julien-en-Genevois**
- Meilleur compromis · Plus rapide : 2026-11-16T06:59:35.471Z → 2026-11-16T09:04:41.584Z · marche 31 m › SNCF TER C21 › marche 717 m › AFO B 272 › marche 230 m · Prix à confirmer · Réalisable

**Annecy → Chambéry**
- Meilleur compromis · Plus rapide : 2026-11-16T07:41:57.390Z → 2026-11-16T08:36:00.000Z · marche 86 m › SNCF K21 · Prix à confirmer · Réalisable

**Lyon → Grenoble**
- Meilleur compromis · Plus rapide : 2026-11-16T08:16:00.000Z → 2026-11-16T09:39:00.000Z · SNCF K6 · Prix à confirmer · Réalisable

**Lyon Part-Dieu → Bellecour (TCL)**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-16T07:00:00.000Z → 2026-11-16T07:30:30.725Z · marche 2507 m · Gratuit (à pied) · Réalisable

**Voiron → Voreppe (M réso Voironnais)**
- Moins cher · Meilleur compromis : 2026-11-16T07:07:40.000Z → 2026-11-16T07:34:07.000Z · marche 389 m › M Réso - Métropole Grenobloise C13 › marche 61 m · 2,00 € · Réalisable
- Plus rapide : 2026-11-16T07:27:38.452Z → 2026-11-16T07:52:47.030Z · marche 361 m › SNCF C6 › marche 825 m · Prix à confirmer · Réalisable

