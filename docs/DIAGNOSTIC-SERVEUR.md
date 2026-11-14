# Diagnostic réel des transports — serveur GitHub Actions

Exécuté le 2026-11-14T19:50:05.124Z ; départs à partir de 2026-11-16T08:00:00+01:00 ; TripGo : non (pas de clé).

**Bilan : 866 trajets sur 23 axes, 254 avec prix vérifié (29.3 %), 825 avec marches calculées (95.3 %), 149 réalisables, 673 en horaire programmé (officiel, marches et marge vérifiées, sans temps réel).**

**TripGo : 0 trajets, 0 avec prix vérifié, 0 portions avec billet chiffré.**

Portions TripGo sans prix par opérateur : aucune.

Exemples de lignes sans tarif (3 par opérateur et par axe) :

- annecy-geneve / BlaBlaCar Bus : Car BlaBlaCar Bus (Annecy - Bus Station → Geneva - Bus Station) ; Car BlaBlaCar Bus (Annecy - Bus Station → Geneva - Airport Bus Station) ; Car BlaBlaCar Bus (Geneva - Airport Bus Station → Geneva - Bus Station)
- annecy-geneve / FlixBus : Car FlixBus 1749 (Annecy (Central Bus Station) → Geneva (central bus station)) ; Car FlixBus S766 (Annecy (Central Bus Station) → Sallanches (Bus Station)) ; Car FlixBus S500 (Sallanches (Bus Station) → Geneva (central bus station))
- annecy-geneve / SNCF : Train TER L2 (Annecy → Genève) ; Train L2 (Annecy → Genève-Eaux-Vives) ; Train L2 (Annecy → Genève Cornavin)
- annecy-geneve / SBB : Train R L4 (Annemasse → Genève)
- annecy-geneve / Cars Région Haute-Savoie : Bus 272 (Gare Routiere → Aéroport) ; Bus 274 (Aéroport → Poste) ; Bus 274 (Aéroport → Mont-Blanc)
- annemasse-stjulien / SNCF : Train C33 (Annemasse → Saint-Julien-en-Genevois) ; Train L1 (Annemasse → Machilly) ; Train L1 (Machilly → Lancy-Bachet)
- annemasse-stjulien / SBB : Train RE 33 (Annemasse → Lancy-Bachet) ; Train R L4 (Annemasse → Lancy-Bachet) ; Train R L1 (Annemasse → Lancy-Bachet)
- annemasse-stjulien / TPG : Bus B 80 (Lancy-Bachet, gare → Saint-Julien, centre) ; Bus B 80 (Saint-Julien, gare → Saint-Julien, centre)
- amberieu-lyon / SNCF : Train K23 (Ambérieu-en-Bugey → Lyon Part Dieu) ; Train C18 (Ambérieu-en-Bugey → Lyon Part Dieu) ; Train K1+ (Ambérieu-en-Bugey → Lyon Part Dieu)
- chambery-aix / SNCF : Train 621B (Chambéry - Challes-les-Eaux → Aix-les-Bains le Revard) ; Train C21 (Chambéry - Challes-les-Eaux → Aix-les-Bains le Revard) ; Train P41 (Chambéry - Challes-les-Eaux → Aix-les-Bains le Revard)
- chambery-aix / FlixBus : Car FlixBus 789 (Chambéry (Central Bus Station) → Aix-les-Bains (Centre Commercial Drumettaz)) ; Car FlixBus 1789 (Chambéry (Central Bus Station) → Aix-les-Bains (Centre Commercial Drumettaz))
- chambery-aix / Ondéa Aix-les-Bains : Bus 419 (Jeu de Paume → Gare 3 Wilson) ; Bus 419 (Jeu de Paume → Alliu) ; Bus 419 (Jeu de Paume → Boissy)
- grenoble-crolles / SNCF : Train C6 (Grenoble → Échirolles) ; Train C1 (Échirolles → Lancey) ; Train C31 (Grenoble → Lancey)
- grenoble-crolles / BlaBlaCar Bus : Car BlaBlaCar Bus (Grenoble - Bus Station → Crolles - Le Rafour)
- rumilly-annecy / SNCF : Train K21 (Rumilly → Annecy) ; Train C21 (Rumilly → Annecy) ; Train C21 (Rumilly → Albens)
- thonon-geneve / SNCF : Train L1 (Thonon-les-Bains → Genève Cornavin) ; Train TER C33 (Thonon-les-Bains → Annemasse) ; Train C33 (Évian-les-Bains → Annemasse)
- thonon-geneve / But : Bus B 002278 (Thonon-les-Bains, Georges And. → Thonon-les-Bains, Les Arts) ; Bus B 002279 (Thonon-les-Bains, Georges And. → Thonon-les-Bains, Les Arts) ; Bus B 002283 (Thonon-les-Bains, Georges And. → Thonon-les-Bains, Les Arts)
- thonon-geneve / AFO : Bus B 271 (Thonon-les-Bains, Les Arts → Genève, Place des Eaux-Vives)
- thonon-geneve / SBB : Train R L3 (Annemasse → Genève)
- thonon-geneve / FlixBus : Car FlixBus S1736 (Thonon-les-Bains → Annecy (Central Bus Station)) ; Car FlixBus 1726 (Annecy (Central Bus Station) → Geneva (central bus station))
- voiron-grenoble / SNCF : Train K6 (Voiron → Grenoble) ; Train C6 (Voiron → Grenoble) ; Train C6 (Voiron → Réaumont - Saint-Cassien)
- voiron-grenoble / Cars Région Isère : Bus T41 (Gare Routière Nord → Gare Routière) ; Bus T40 (Gare Routière → Gare Routière) ; Bus T55 (Gare Routière Sud → Gare Routière)
- voiron-grenoble / BlaBlaCar Bus : Car BlaBlaCar Bus (Voiron - Champfeuillet → Grenoble - Bus Station)
- voiron-grenoble / FlixBus : Car FlixBus N709 (Voiron (Champfeuillet) → Grenoble (Central Bus Station))
- aix-technolac / SNCF : Train P3 (Aix-les-Bains le Revard → Viviers-du-Lac) ; Train K3 (Aix-les-Bains le Revard → Chambéry - Challes-les-Eaux) ; Train P3 (Chambéry - Challes-les-Eaux → Viviers-du-Lac)
- aix-technolac / Ondéa Aix-les-Bains : Bus 102 (Boulevard Wilson → Gare 1 Parvis)
- thonon-bons / SNCF : Train L1 (Thonon-les-Bains → Bons-en-Chablais) ; Train C33 (Thonon-les-Bains → Bons-en-Chablais) ; Train L1 (Thonon-les-Bains → Évian-les-Bains)
- thonon-bons / Star't Thonon : Bus 142 (Les Arts → Sacré Coeur) ; Bus L (Mairie → Presbytère) ; Bus L (Sacré Coeur → Presbytère)
- chambery-chamoux / Cars Région Savoie : Bus S05 (Gare Routiere → Ecoles)
- chambery-chamoux / SNCF : Train P31 (Chambéry - Challes-les-Eaux → Chamousset) ; Train P41 (Chambéry - Challes-les-Eaux → Saint-Pierre-d'Albigny) ; Train P41 (Chambéry - Challes-les-Eaux → Aix-les-Bains le Revard)
- bourg-amberieu / SNCF : Train K13 (Bourg-en-Bresse → Ambérieu-en-Bugey) ; Train P13 (Bourg-en-Bresse Archives → Ambérieu-en-Bugey) ; Train P13 (Bourg-en-Bresse Gare Routière → Ambérieu-en-Bugey)
- bourg-amberieu / Cars Région Ain : Bus A32 (Berthelot → Carré Amiot (Quai E)) ; Bus A32 (SNCF → Carré Amiot (Quai E))
- geneve-lausanne / SBB : Train IR 90 (Genève → Lausanne) ; Train RE 33 (Genève → Lausanne) ; Train IR 95 (Genève → Lausanne)
- geneve-lausanne / BlaBlaCar Bus : Car BlaBlaCar Bus (Geneva - Airport Bus Station → Lausanne) ; Car BlaBlaCar Bus (Geneva - Bus Station → Annecy - Bus Station) ; Car BlaBlaCar Bus (Annecy - Bus Station → Lausanne)
- geneve-lausanne / FlixBus : Car FlixBus 1689 (Geneva (central bus station) → Lausanne (P+R Vélodrome)) ; Car FlixBus 122 (Geneva (central bus station) → Lausanne (P+R Vélodrome)) ; Car FlixBus 1749 (Geneva (central bus station) → Lausanne (P+R Vélodrome))
- annemasse-geneve / SBB : Train R L4 (Annemasse → Genève) ; Train RE 33 (Annemasse → Genève) ; Train R L1 (Annemasse → Genève)
- annemasse-geneve / SNCF : Train L1 (Annemasse → Machilly) ; Train L1 (Machilly → Genève-Eaux-Vives) ; Train L1 (Annemasse → Genève Cornavin)
- stjulien-geneve / TPG : Bus B 80 (Saint-Julien, centre → Genève, Stand) ; Bus B 80 (Saint-Julien, centre → Lancy-Bachet, gare)
- stjulien-geneve / SNCF : Train C33 (Saint-Julien-en-Genevois → Annemasse) ; Train L3 (Annemasse → Genève Cornavin) ; Train L4 (Annemasse → Genève Cornavin)
- stjulien-geneve / Cars Région Haute-Savoie : Bus 272 (SNCF → Aéroport) ; Bus 274 (Aéroport → Poste) ; Bus 274 (Aéroport → Mont-Blanc)
- archamps-geneve / TPG : Bus B 82 (Collonges, marché → Lancy-Bachet, gare)
- chambery-stjulien / SNCF : Train K11 (Chambéry - Challes-les-Eaux → Bellegarde) ; Train C33 (Bellegarde → Saint-Julien-en-Genevois) ; Train C21 (Chambéry - Challes-les-Eaux → Annecy)
- annecy-chambery / SNCF : Train 621B (Annecy → Chambéry - Challes-les-Eaux) ; Train C21 (Annecy → Chambéry - Challes-les-Eaux) ; Train K21 (Annecy → Chambéry - Challes-les-Eaux)
- annecy-chambery / BlaBlaCar Bus : Car BlaBlaCar Bus (Annecy - Bus Station → Chambéry - Bus Station)
- annecy-chambery / FlixBus : Car FlixBus 1726 (Annecy (Central Bus Station) → Chambéry (Central Bus Station)) ; Car FlixBus 1789 (Annecy (Central Bus Station) → Chambéry (Central Bus Station)) ; Car FlixBus 739 (Annecy (Central Bus Station) → Chambéry (Central Bus Station))
- lyon-grenoble / SNCF : Train K6 (Lyon Part Dieu → Grenoble) ; Train K54 (Lyon Part Dieu → Valence Ville) ; Train K21 (Valence Ville → Grenoble)
- lyon-grenoble / FlixBus : Car FlixBus 766 (Lyon (Gerland Bus Station) → Grenoble (Central Bus Station)) ; Car FlixBus 1501 (Lyon (Gerland Bus Station) → Grenoble (Central Bus Station)) ; Car FlixBus 776 (Lyon (Gerland Bus Station) → Grenoble (Central Bus Station))
- lyon-grenoble / BlaBlaCar Bus : Car BlaBlaCar Bus (Lyon - Gerland Bus Station → Grenoble - Bus Station) ; Car BlaBlaCar Bus (Lyon - Gerland Bus Station → Lyon - St. Exupéry Airport T1 Bus Stop) ; Car BlaBlaCar Bus (Lyon - St. Exupéry Airport T1 Bus Stop → Grenoble - Bus Station)
- lyon-intra / SNCF : Train C23 (Lyon Part Dieu → Lyon Perrache) ; Train C15 (Lyon Part Dieu → Lyon Perrache) ; Train 601A (Lyon Part Dieu → Lyon Perrache)
- voiron-voreppe / SNCF : Train C6 (Voiron → Voreppe) ; Train C31 (Voiron → Réaumont - Saint-Cassien) ; Train C6 (Réaumont - Saint-Cassien → Voreppe)
- voiron-voreppe / Mobilités M - SNCF : Train C6 (Voiron, Voiron → Voreppe, Voreppe)
- voiron-voreppe / Cars Région Isère : Bus T41 (Gare Routière Nord → Gare Routière) ; Bus T40 (Gare Routière → Place Docteur Thévenet) ; Bus T40 (Gare Routière → La Verronière)

Lignes bloquant les itinéraires partiellement tarifés :

- chambery-aix / Ondéa Aix-les-Bains : 419
- thonon-geneve / But : B 002289
- thonon-geneve / AFO : B 271
- aix-technolac / Ondéa Aix-les-Bains : 102
- thonon-bons / Star't Thonon : 142, L
- bourg-amberieu / Cars Région Ain : A32
- annemasse-geneve / SBB : R L7
- stjulien-geneve / TPG : B 80
- archamps-geneve / TPG : B 82
- chambery-stjulien / SNCF : K11
- voiron-voreppe / Mobilités M - SNCF : C6

Correspondances bloquant les itinéraires partiellement tarifés : Ondéa Aix-les-Bains (37), Star't Thonon (20), TPG (7), Cars Région Ain (2), SBB (2), SNCF (2), But (1), AFO (1), Mobilités M - SNCF (1).

Portions sans prix par opérateur (toutes sources) : SNCF (421), Cars Région Haute-Savoie (96), FlixBus (57), BlaBlaCar Bus (48), Ondéa Aix-les-Bains (38), Star't Thonon (32), SBB (27), Cars Région Isère (24), TPG (19), But (8), AFO (4), Cars Région Savoie (2), Cars Région Ain (2), Mobilités M - SNCF (1).

| Axe | Trajets | Prix vérifié | Marches calculées | Réalisables | Horaire programmé | 1er résultat | Total | Sources | Erreurs | Attendus non vus |
|---|---|---|---|---|---|---|---|---|---|---|
| Annecy → Genève | 59 | 0 | 59 | 14 | 45 | 0.4 s | 11.6 s | BlaBlaCar Bus (GTFS), FlixBus (GTFS), Suisse (transport.opendata.ch), SNCF (GTFS officiel), SNCF (GTFS), Cars Région Haute-Savoie (GTFS) | — | — |
| Annemasse → Saint-Julien-en-Genevois | 56 | 32 | 42 | 12 | 30 | 0.3 s | 20.0 s | Suisse (transport.opendata.ch), TAC Annemasse (GTFS), SNCF (GTFS), SNCF (GTFS officiel) | — | — |
| Ambérieu-en-Bugey → Lyon Part-Dieu | 19 | 0 | 19 | 5 | 14 | 0.2 s | 3.9 s | SNCF (GTFS officiel), SNCF (GTFS) | — | — |
| Chambéry → Aix-les-Bains | 64 | 4 | 64 | 5 | 59 | 0.1 s | 12.6 s | Synchro Chambéry (GTFS), Synchro Bus Chambéry (GTFS), SNCF (GTFS officiel), SNCF (GTFS), FlixBus (GTFS), Ondéa Aix-les-Bains (GTFS) | — | — |
| Grenoble → Crolles | 30 | 5 | 30 | 12 | 18 | 0.1 s | 5.6 s | Mobilités M, SNCF (GTFS officiel), SNCF (GTFS), BlaBlaCar Bus (GTFS) | — | — |
| Rumilly → Annecy | 24 | 1 | 24 | 6 | 18 | 0.2 s | 5.2 s | Sibra (GTFS), SNCF (GTFS), SNCF (GTFS officiel) | — | — |
| Thonon-les-Bains → Genève | 18 | 0 | 17 | 9 | 8 | 0.1 s | 10.2 s | SNCF (GTFS), Suisse (transport.opendata.ch), SNCF (GTFS officiel), FlixBus (GTFS) | — | — |
| Voiron → Grenoble | 39 | 0 | 39 | 4 | 35 | 0.3 s | 10.7 s | SNCF (GTFS), Mobilités M, SNCF (GTFS officiel), Cars Région Isère (GTFS), BlaBlaCar Bus (GTFS), FlixBus (GTFS) | — | — |
| Aix-les-Bains gare → Technolac (Ondéa 01) | 31 | 18 | 30 | 1 | 29 | 0.5 s | 9.6 s | Ondéa Aix-les-Bains (GTFS), SNCF (GTFS officiel), SNCF (GTFS) | — | — |
| Thonon → Bons-en-Chablais (Star’t 142) | 51 | 6 | 51 | 3 | 48 | 0.3 s | 17.5 s | Star't Thonon (GTFS), SNCF (GTFS), SNCF (GTFS officiel) | — | — |
| Rumilly Hôpital → Base de loisirs (J’y bus 1) | 56 | 56 | 56 | 0 | 56 | 0.6 s | 11.2 s | J’y bus Rumilly (GTFS), J'y bus Rumilly (GTFS) | — | — |
| Ambérieu gare → Cabrol (TAM 2) | 82 | 82 | 82 | 0 | 82 | 0.4 s | 16.2 s | TAM Ambérieu (GTFS), TAM Ambérieu-en-Bugey (GTFS), Cars Région Ain (GTFS) | — | — |
| Chambéry → Chamoux-sur-Gelon (Cars Savoie S05) | 19 | 0 | 19 | 8 | 11 | 0.0 s | 4.8 s | Cars Région Savoie (GTFS), SNCF (GTFS), SNCF (GTFS officiel) | — | — |
| Bourg-en-Bresse → Ambérieu (Cars Ain / TER) | 18 | 1 | 18 | 3 | 15 | 0.0 s | 6.1 s | Cars Région Ain (GTFS), SNCF (GTFS officiel), SNCF (GTFS) | — | — |
| Genève → Lausanne | 26 | 0 | 26 | 8 | 18 | 0.2 s | 6.1 s | Suisse (transport.opendata.ch), BlaBlaCar Bus (GTFS), FlixBus (GTFS) | — | — |
| Annemasse → Genève | 33 | 0 | 31 | 11 | 20 | 0.3 s | 2.9 s | Suisse (transport.opendata.ch), SNCF (GTFS officiel), SNCF (GTFS) | — | — |
| Saint-Julien-en-Genevois → Genève | 45 | 0 | 45 | 8 | 37 | 0.1 s | 9.0 s | Suisse (transport.opendata.ch), SNCF (GTFS), Cars Région Haute-Savoie (GTFS) | — | — |
| Archamps → Genève | 9 | 5 | 9 | 8 | 1 | 0.3 s | 6.4 s | Suisse (transport.opendata.ch), SNCF (GTFS) | — | — |
| Chambéry → Saint-Julien-en-Genevois | 8 | 0 | 8 | 5 | 3 | 0.2 s | 1.9 s | SNCF (GTFS), SNCF (GTFS officiel) | — | — |
| Annecy → Chambéry | 39 | 0 | 39 | 7 | 30 | 0.2 s | 1.8 s | SNCF (GTFS), BlaBlaCar Bus (GTFS), SNCF (GTFS officiel), FlixBus (GTFS) | — | — |
| Lyon → Grenoble | 55 | 0 | 55 | 7 | 47 | 0.1 s | 3.7 s | SNCF (GTFS officiel), SNCF (GTFS), FlixBus (GTFS), BlaBlaCar Bus (GTFS) | — | — |
| Lyon Part-Dieu → Bellecour (TCL) | 50 | 42 | 27 | 1 | 26 | 1.5 s | 27.8 s | Marche (Valhalla / OpenStreetMap), TCL (GTFS), TCL Lyon (GTFS), SNCF (GTFS) | — | — |
| Voiron → Voreppe (M réso Voironnais) | 35 | 2 | 35 | 12 | 23 | 0.2 s | 3.5 s | Mobilités M, SNCF (GTFS officiel), SNCF (GTFS), Cars Région Isère (GTFS) | — | — |

Exemples (3 meilleures propositions par axe) :

**Annecy → Genève**
- Meilleur compromis · Plus rapide : 2026-11-17T10:24:20.048Z → 2026-11-17T11:21:02.017Z · marche 54 m › BlaBlaCar Bus BlaBlaCar Bus › marche 494 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés)

**Annemasse → Saint-Julien-en-Genevois**
- Moins cher : 2026-11-16T07:48:47.707Z → 2026-11-16T08:51:41.077Z · marche 102 m › TAC B 4 › marche 640 m · 1,70 € · Réalisable
- Meilleur compromis : 2026-11-16T10:28:47.707Z → 2026-11-16T11:25:59.054Z · marche 102 m › TAC Annemasse 4 › marche 257 m · 1,70 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)
- Plus rapide : 2026-11-16T10:12:00.000Z → 2026-11-16T10:31:26.357Z · SNCF C33 › marche 631 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés)

**Ambérieu-en-Bugey → Lyon Part-Dieu**
- Meilleur compromis · Plus rapide : 2026-11-16T07:12:26.785Z → 2026-11-16T07:52:00.000Z · marche 1346 m › SNCF K23 · Prix à confirmer · Réalisable

**Chambéry → Aix-les-Bains**
- Moins cher · Meilleur compromis : 2026-11-16T11:06:14.962Z → 2026-11-16T11:41:36.577Z · marche 286 m › Synchro Chambéry 30 › marche 129 m · 1,40 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)
- Plus rapide : 2026-11-16T08:49:00.000Z → 2026-11-16T08:58:00.000Z · SNCF 621B · Prix à confirmer · Réalisable

**Grenoble → Crolles**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-16T07:02:04.000Z → 2026-11-16T07:42:59.000Z · marche 69 m › M Réso - Métropole Grenobloise C11 · 2,00 € · Réalisable

**Rumilly → Annecy**
- Moins cher · Meilleur compromis : 2026-11-16T12:03:51.578Z → 2026-11-16T13:00:49.298Z · marche 625 m › Sibra 42 › marche 160 m · 2,00 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)
- Plus rapide : 2026-11-16T18:48:33.324Z → 2026-11-16T19:15:59.306Z · marche 925 m › SNCF K21 › marche 86 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés · recherche des correspondances incomplète)

**Thonon-les-Bains → Genève**
- Meilleur compromis · Plus rapide : 2026-11-16T08:27:38.441Z → 2026-11-16T09:28:00.000Z · marche 197 m › SNCF L1 · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés · recherche des correspondances incomplète)

**Voiron → Grenoble**
- Meilleur compromis · Plus rapide : 2026-11-16T07:50:38.452Z → 2026-11-16T08:09:00.000Z · marche 361 m › SNCF K6 · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés · recherche des correspondances incomplète)

**Aix-les-Bains gare → Technolac (Ondéa 01)**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-16T16:15:00.000Z → 2026-11-16T16:38:00.000Z · Ondéa Aix-les-Bains 01 · 1,70 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)

**Thonon → Bons-en-Chablais (Star’t 142)**
- Moins cher · Meilleur compromis : 2026-11-16T07:01:00.000Z → 2026-11-16T07:50:00.000Z · Star't Thonon 142 · 2,20 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)
- Plus rapide : 2026-11-16T10:39:02.877Z → 2026-11-16T11:04:10.713Z · marche 154 m › SNCF L1 › marche 804 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés · recherche des correspondances incomplète)

**Rumilly Hôpital → Base de loisirs (J’y bus 1)**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-16T11:38:00.000Z → 2026-11-16T12:01:00.000Z · J’y bus Rumilly 1 · 1,00 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)

**Ambérieu gare → Cabrol (TAM 2)**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-16T07:40:00.000Z → 2026-11-16T07:56:00.000Z · TAM Ambérieu TAM 2 · 1,10 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)

**Chambéry → Chamoux-sur-Gelon (Cars Savoie S05)**
- Meilleur compromis : 2026-11-16T11:30:00.000Z → 2026-11-16T12:38:00.000Z · Cars Région Savoie S05 · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)
- Plus rapide : 2026-11-16T17:24:26.574Z → 2026-11-16T18:26:14.460Z · marche 346 m › SNCF P31 › marche 2867 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés)

**Bourg-en-Bresse → Ambérieu (Cars Ain / TER)**
- Moins cher : 2026-11-16T14:33:00.000Z → 2026-11-16T17:57:27.767Z · Cars Région Ain A19 › Cars Région Ain A27 › marche 38 m · 2,30 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)
- Meilleur compromis · Plus rapide : 2026-11-16T09:43:55.631Z → 2026-11-16T10:01:33.893Z · marche 93 m › SNCF K13 › marche 46 m · Prix à confirmer · Réalisable

**Genève → Lausanne**
- Meilleur compromis · Plus rapide : 2026-11-16T07:05:00.000Z → 2026-11-16T07:44:00.000Z · SBB IR 90 · Prix à confirmer · Réalisable

**Annemasse → Genève**
- Meilleur compromis · Plus rapide : 2026-11-16T07:20:00.000Z → 2026-11-16T07:43:00.000Z · SBB R L4 · Prix à confirmer · Réalisable

**Saint-Julien-en-Genevois → Genève**
- Meilleur compromis : 2026-11-16T07:39:00.960Z → 2026-11-16T08:29:38.794Z · marche 230 m › TPG B 80 › marche 848 m · Prix à confirmer · Réalisable
- Plus rapide : 2026-11-16T07:17:00.960Z → 2026-11-16T07:58:00.000Z · marche 230 m › TPG B 80 › marche 115 m › SBB R L1 · Prix à confirmer · Réalisable

**Archamps → Genève**
- Moins cher : 2026-11-16T07:51:15.473Z → 2026-11-16T08:43:00.000Z · marche 1713 m › TPG B 44 › TPG T 18 › marche 115 m › SBB R L4 · 3,00 CHF · Réalisable
- Meilleur compromis · Plus rapide : 2026-11-16T07:47:51.967Z → 2026-11-16T08:28:00.000Z · marche 1054 m › TPG B 82 › marche 115 m › SBB R L3 · Prix à confirmer · Réalisable

**Chambéry → Saint-Julien-en-Genevois**
- Meilleur compromis · Plus rapide : 2026-11-16T17:46:00.000Z → 2026-11-16T19:47:26.357Z · SNCF K11 › SNCF C33 › marche 631 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés · correspondance programmée non confirmée en temps réel)

**Annecy → Chambéry**
- Meilleur compromis : 2026-11-16T14:27:57.390Z → 2026-11-16T15:10:00.000Z · marche 86 m › SNCF 621B · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés · recherche des correspondances incomplète)
- Plus rapide : 2026-11-16T10:24:20.048Z → 2026-11-16T11:03:47.341Z · marche 54 m › BlaBlaCar Bus BlaBlaCar Bus › marche 284 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés)

**Lyon → Grenoble**
- Meilleur compromis · Plus rapide : 2026-11-16T08:16:00.000Z → 2026-11-16T09:39:00.000Z · SNCF K6 · Prix à confirmer · Réalisable

**Lyon Part-Dieu → Bellecour (TCL)**
- Moins cher : 2026-11-16T07:00:00.000Z → 2026-11-16T07:30:30.725Z · marche 2507 m · Gratuit (à pied) · Réalisable
- Meilleur compromis · Plus rapide : 2026-11-16T12:59:04.315Z → 2026-11-16T13:21:38.709Z · marche 168 m › TCL C13 › marche 762 m · 2,10 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)

**Voiron → Voreppe (M réso Voironnais)**
- Moins cher · Meilleur compromis : 2026-11-16T07:07:40.000Z → 2026-11-16T07:34:07.000Z · marche 389 m › M Réso - Métropole Grenobloise C13 › marche 61 m · 2,00 € · Réalisable
- Plus rapide : 2026-11-16T07:27:38.452Z → 2026-11-16T07:52:47.030Z · marche 361 m › SNCF C6 › marche 825 m · Prix à confirmer · Réalisable

