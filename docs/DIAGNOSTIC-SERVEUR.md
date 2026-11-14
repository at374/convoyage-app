# Diagnostic réel des transports — serveur GitHub Actions

Exécuté le 2026-11-14T10:34:23.348Z ; départs à partir de 2026-11-16T08:00:00+01:00 ; TripGo : non (pas de clé).

**Bilan : 1146 trajets sur 23 axes, 319 avec prix vérifié (27.8 %), 425 avec marches calculées (37.1 %), 132 réalisables.**

**TripGo : 0 trajets, 0 avec prix vérifié, 0 portions avec billet chiffré.**

Portions TripGo sans prix par opérateur : aucune.

Exemples de lignes sans tarif (3 par opérateur et par axe) :

- annecy-geneve / SNCF : Train TER L2 (Annecy → Genève) ; Train L2 (Annecy → Genève-Eaux-Vives) ; Train K21 (Annecy → Aix-les-Bains le Revard)
- annecy-geneve / SBB : Train R L4 (Annemasse → Genève)
- annecy-geneve / FlixBus : Car FlixBus S766 (Annecy (Central Bus Station) → Lyon (Gerland Bus Station)) ; Car FlixBus 1659 (Lyon (Gerland Bus Station) → Geneva (central bus station)) ; Car FlixBus N882 (Lyon (Gerland Bus Station) → Geneva (central bus station))
- annecy-geneve / BlaBlaCar Bus : Car BlaBlaCar Bus (Annecy - Bus Station → Geneva - Airport Bus Station) ; Car BlaBlaCar Bus (Geneva - Airport Bus Station → Geneva - Bus Station) ; Car BlaBlaCar Bus (Annecy - Bus Station → Saint-Étienne - Rue Milleret Bus Stop)
- annecy-geneve / Cars Région Haute-Savoie : Bus 272 (Gare Routiere → Aéroport) ; Bus 274 (Aéroport → Poste) ; Bus 274 (Aéroport → Mont-Blanc)
- annemasse-stjulien / SNCF : Train TER C33 (Annemasse → Saint-Julien-en-Genevois) ; Train L1 (Annemasse → Machilly) ; Train L1 (Machilly → Lancy-Bachet)
- annemasse-stjulien / TPG : Bus B 80 (Saint-Julien, gare → Saint-Julien, centre) ; Bus B 80 (Lancy-Bachet, gare → Saint-Julien, centre)
- annemasse-stjulien / SBB : Train RE 33 (Annemasse → Lancy-Bachet) ; Train R L4 (Annemasse → Lancy-Bachet) ; Train R L1 (Annemasse → Lancy-Bachet)
- amberieu-lyon / SNCF : Train K23 (Ambérieu-en-Bugey → Lyon Part Dieu) ; Train C18 (Ambérieu-en-Bugey → Lyon Part Dieu) ; Train K1+ (Ambérieu-en-Bugey → Lyon Part Dieu)
- chambery-aix / SNCF : Train C21 (Chambéry - Challes-les-Eaux → Aix-les-Bains le Revard) ; Train P41 (Chambéry - Challes-les-Eaux → Moûtiers-Salins-Brides-les-B.) ; Train P41 (Moûtiers-Salins-Brides-les-B. → Aix-les-Bains le Revard)
- chambery-aix / Ondéa Aix-les-Bains : Bus 419 (Jeu de Paume → Gare 3 Wilson) ; Bus 419 (Jeu de Paume → Alliu) ; Bus 419 (Jeu de Paume → Boissy)
- grenoble-crolles / SNCF : Train C6 (Grenoble → Échirolles) ; Train C1 (Échirolles → Lancey) ; Train C31 (Grenoble → Lancey)
- grenoble-crolles / BlaBlaCar Bus : Car BlaBlaCar Bus (Grenoble - Bus Station → Annecy - Bus Station) ; Car BlaBlaCar Bus (Annecy - Bus Station → Crolles - Le Rafour) ; Car BlaBlaCar Bus (Grenoble - Bus Station → Crolles - Le Rafour)
- rumilly-annecy / SNCF : Train K21 (Rumilly → Annecy) ; Train C21 (Rumilly → Annecy) ; Train C21 (Rumilly → Albens)
- thonon-geneve / SNCF : Train L1 (Thonon-les-Bains → Genève-Eaux-Vives) ; Train L1 (Perrignier → Genève-Eaux-Vives) ; Train L1 (Perrignier → Thonon-les-Bains)
- thonon-geneve / FlixBus : Car FlixBus S1736 (Thonon-les-Bains → Annecy (Central Bus Station)) ; Car FlixBus 1726 (Annecy (Central Bus Station) → Geneva (central bus station)) ; Car FlixBus N872 (Annecy (Central Bus Station) → Geneva (central bus station))
- voiron-grenoble / SNCF : Train K6 (Voiron → Grenoble) ; Train K6 (Voiron → La Tour-du-Pin) ; Train K6 (La Tour-du-Pin → Grenoble)
- voiron-grenoble / Mobilités M - SNCF : Train C6 (Voiron, Voiron → Grenoble, Grenoble) ; Train K6 (Voiron, Voiron → Grenoble, Grenoble)
- voiron-grenoble / BlaBlaCar Bus : Car BlaBlaCar Bus (Voiron - Champfeuillet → Lyon - St. Exupéry Airport T1 Bus Stop) ; Car BlaBlaCar Bus (Lyon - St. Exupéry Airport T1 Bus Stop → Grenoble - Bus Station) ; Car BlaBlaCar Bus (Voiron - Champfeuillet → Lyon - Gerland Bus Station)
- voiron-grenoble / Cars Région Isère : Bus T41 (Gare Routière Nord → Gare Routière) ; Bus T40 (Gare Routière → Gare Routière) ; Bus T55 (Gare Routière Sud → Gare Routière)
- voiron-grenoble / FlixBus : Car FlixBus N709 (Voiron (Champfeuillet) → Grenoble (Central Bus Station))
- aix-technolac / SNCF : Train P3 (Aix-les-Bains le Revard → Viviers-du-Lac) ; Train C21 (Aix-les-Bains le Revard → Chambéry - Challes-les-Eaux) ; Train K11 (Aix-les-Bains le Revard → Chambéry - Challes-les-Eaux)
- thonon-bons / SNCF : Train C33 (Thonon-les-Bains → Bons-en-Chablais) ; Train L1 (Thonon-les-Bains → Évian-les-Bains) ; Train L1 (Évian-les-Bains → Bons-en-Chablais)
- thonon-bons / But : Bus B 142 (Thonon-les-Bains, Les Arts → Bons-en-Chablais, Mairie) ; Bus B 142 (Bons-en-Chablais, Gare Didier → Bons-en-Chablais, Mairie)
- thonon-bons / Evian : Bus B 01 (Thonon-les-Bains, Les Arts → Évian-les-Bains, Anna Noailles)
- thonon-bons / Star't Thonon : Bus L (Mairie → Presbytère) ; Bus L (Sacré Coeur → Presbytère) ; Bus L (Sacré Coeur → Gare Saint-Didier)
- amberieu-intra / SNCF : Train P13 (Ambérieu-en-Bugey → Ambronay - Priay) ; Train P13 (Ambérieu-en-Bugey → Ambronay-Priay RD 1075) ; Train P13 (Ambronay-Priay RD 1075 → Ambérieu-en-Bugey)
- chambery-chamoux / SNCF : Train P31 (Chambéry - Challes-les-Eaux → Chamousset) ; Train P41 (Chambéry - Challes-les-Eaux → Saint-Pierre-d'Albigny) ; Train P41 (Chambéry - Challes-les-Eaux → Aix-les-Bains le Revard)
- chambery-chamoux / Cars Région Savoie : Bus S05 (Gare Routiere → Ecoles)
- bourg-amberieu / SNCF : Train K13 (Bourg-en-Bresse → Ambérieu-en-Bugey) ; Train P13 (Bourg-en-Bresse Charité → Bourg-en-Bresse Gare Routière) ; Train P13 (Bourg-en-Bresse Gare Routière → Ambérieu-en-Bugey)
- bourg-amberieu / Cars Région Ain : Bus A32 (Berthelot → Carré Amiot (Quai E)) ; Bus A32 (SNCF → Carré Amiot (Quai E))
- geneve-lausanne / SBB : Train IR 90 (Genève → Lausanne) ; Train RE 33 (Genève → Lausanne) ; Train IR 95 (Genève → Lausanne)
- geneve-lausanne / SNCF : Train 622E (Genève Cornavin → Paris Gare de Lyon Hall 1 - 2) ; Train 612E (Paris Gare de Lyon Hall 1 - 2 → Lausanne)
- geneve-lausanne / FlixBus : Car FlixBus 1689 (Geneva (central bus station) → Lausanne (P+R Vélodrome)) ; Car FlixBus 122 (Geneva (central bus station) → Lausanne (P+R Vélodrome)) ; Car FlixBus 1789 (Geneva (central bus station) → Chambéry (Central Bus Station))
- geneve-lausanne / BlaBlaCar Bus : Car BlaBlaCar Bus (Geneva - Bus Station → Annecy - Bus Station) ; Car BlaBlaCar Bus (Annecy - Bus Station → Lausanne) ; Car BlaBlaCar Bus (Geneva - Bus Station → Geneva - Airport Bus Station)
- annemasse-geneve / SBB : Train R L4 (Annemasse → Genève) ; Train RE 33 (Annemasse → Genève) ; Train R L1 (Annemasse → Genève)
- annemasse-geneve / SNCF : Train L1 (Annemasse → Machilly) ; Train L1 (Machilly → Genève-Eaux-Vives) ; Train L4 (Annemasse → Genève-Eaux-Vives)
- annemasse-geneve / TPG : Tram T 12 (Genève-Eaux-Vives, gare → Genève, Bel-Air) ; Tram T 14 (Genève, Bel-Air → Genève, gare Cornavin)
- annemasse-geneve / BlaBlaCar Bus : Car BlaBlaCar Bus (Annemasse → Annecy - Bus Station) ; Car BlaBlaCar Bus (Annecy - Bus Station → Geneva - Bus Station)
- annemasse-geneve / FlixBus : Car FlixBus S1736 (Annemasse (Jean Monnet P+R) → Annecy (Central Bus Station)) ; Car FlixBus 1726 (Annecy (Central Bus Station) → Geneva (central bus station)) ; Car FlixBus N872 (Annecy (Central Bus Station) → Geneva (central bus station))
- stjulien-geneve / SNCF : Train L2 (Lancy-Pont-Rouge → Genève Cornavin) ; Train L2 (Lancy-Bachet → Genève Cornavin) ; Train L4 (Lancy-Pont-Rouge → Genève-Eaux-Vives)
- stjulien-geneve / TPG : Bus B 80 (Saint-Julien, centre → Genève, Stand) ; Bus B 80 (Saint-Julien, centre → Lancy-Bachet, gare)
- stjulien-geneve / SBB : Train R L1 (Lancy-Bachet → Genève) ; Train RE 33 (Lancy-Bachet → Genève) ; Train R L2 (Lancy-Bachet → Genève)
- stjulien-geneve / Cars Région Haute-Savoie : Bus 272 (SNCF → Aéroport) ; Bus 274 (Aéroport → Poste) ; Bus 274 (Aéroport → Mont-Blanc)
- archamps-geneve / SNCF : Train L2 (Lancy-Pont-Rouge → Genève Cornavin) ; Train L2 (Lancy-Bachet → Genève Cornavin) ; Train L4 (Lancy-Pont-Rouge → Genève-Eaux-Vives)
- archamps-geneve / TPG : Bus B 82 (Collonges, marché → Lancy-Bachet, gare) ; Bus B 44 (Croix-de-Rozon, douane → Carouge GE, Rondeau) ; Tram T 18 (Carouge GE, Rondeau → Genève, gare Cornavin)
- archamps-geneve / SBB : Train R L4 (Lancy-Bachet → Genève) ; Train R L1 (Lancy-Bachet → Genève) ; Train R L2 (Lancy-Bachet → Genève)
- chambery-stjulien / SNCF : Train K21 (Chambéry - Challes-les-Eaux → Annecy) ; Train L2 (Annecy → Lancy-Bachet) ; Train C21 (Chambéry - Challes-les-Eaux → Annecy)
- chambery-stjulien / AFO : Bus B 272 (Annecy, Gare routière → Saint-Julien, centre)
- chambery-stjulien / SBB : Train R L4 (Genève → Lancy-Bachet)
- chambery-stjulien / TPG : Bus B 80 (Lancy-Bachet, gare → Saint-Julien, centre)
- annecy-chambery / SNCF : Train K21 (Annecy → Chambéry - Challes-les-Eaux) ; Train C21 (Annecy → Chambéry - Challes-les-Eaux) ; Train L2 (Annecy → Genève Cornavin)
- annecy-chambery / FlixBus : Car FlixBus S766 (Annecy (Central Bus Station) → Lyon Saint-Exupéry Airport) ; Car FlixBus X1726 (Lyon Saint-Exupéry Airport → Chambéry (Central Bus Station)) ; Car FlixBus S766 (Annecy (Central Bus Station) → Lyon (Gerland Bus Station))
- annecy-chambery / BlaBlaCar Bus : Car BlaBlaCar Bus (Annecy - Bus Station → Geneva - Airport Bus Station) ; Car BlaBlaCar Bus (Geneva - Airport Bus Station → Chambéry - Bus Station) ; Car BlaBlaCar Bus (Annecy - Bus Station → Chambéry - Bus Station)
- lyon-grenoble / SNCF : Train K6 (Lyon Part Dieu → Grenoble) ; Train K54 (Lyon Part Dieu → Valence Ville) ; Train K21 (Valence Ville → Grenoble)
- lyon-intra / TCL Lyon : Bus 1 (Terrasses Presqu'Île → Saint-Vincent)
- lyon-intra / SNCF : Train C23 (Lyon Perrache → Lyon Part Dieu) ; Train C24 (Lyon Jean Macé → Lyon Perrache) ; Train C12 (Lyon Perrache → Lyon Part Dieu)
- voiron-voreppe / Mobilités M - SNCF : Train C6 (Voiron, Voiron → Voreppe, Voreppe)
- voiron-voreppe / SNCF : Train C31 (Voiron → Réaumont - Saint-Cassien) ; Train C6 (Réaumont - Saint-Cassien → Voreppe) ; Train C6 (Voiron → Voreppe)
- voiron-voreppe / Cars Région Isère : Bus T41 (Gare Routière Nord → Gare Routière) ; Bus T40 (Gare Routière → Place Docteur Thévenet) ; Bus T40 (Gare Routière → La Verronière)

Lignes bloquant les itinéraires partiellement tarifés :

- chambery-aix / Ondéa Aix-les-Bains : 419
- thonon-bons / Star't Thonon : L, 142
- bourg-amberieu / Cars Région Ain : A32
- voiron-voreppe / Mobilités M - SNCF : C6

Correspondances bloquant les itinéraires partiellement tarifés : Ondéa Aix-les-Bains (34), Star't Thonon (26), Cars Région Ain (2), Mobilités M - SNCF (1).

Portions sans prix par opérateur (toutes sources) : SNCF (867), FlixBus (122), BlaBlaCar Bus (121), Cars Région Haute-Savoie (96), Ondéa Aix-les-Bains (35), Star't Thonon (34), SBB (33), TPG (32), Cars Région Isère (28), But (8), Mobilités M - SNCF (3), AFO (3), Evian (2), Cars Région Savoie (2), Cars Région Ain (2), TCL Lyon (1).

| Axe | Trajets | Prix vérifié | Marches calculées | Réalisables | 1er résultat | Total | Sources | Erreurs | Attendus non vus |
|---|---|---|---|---|---|---|---|---|---|
| Annecy → Genève | 80 | 0 | 46 | 14 | 0.3 s | 16.4 s | Suisse (transport.opendata.ch), SNCF (GTFS officiel), SNCF (GTFS), FlixBus (GTFS), BlaBlaCar Bus (GTFS), Cars Région Haute-Savoie (GTFS) | GTFS Sibra : fetch failed | — |
| Annemasse → Saint-Julien-en-Genevois | 84 | 54 | 36 | 12 | 0.2 s | 17.2 s | Suisse (transport.opendata.ch), SNCF (GTFS officiel), SNCF (GTFS), TAC Annemasse (GTFS) | — | — |
| Ambérieu-en-Bugey → Lyon Part-Dieu | 27 | 0 | 16 | 3 | 0.1 s | 5.9 s | SNCF (GTFS officiel), SNCF (GTFS) | — | — |
| Chambéry → Aix-les-Bains | 63 | 4 | 24 | 7 | 0.1 s | 9.2 s | Synchro Bus Chambéry (GTFS), Synchro Chambéry (GTFS), SNCF (GTFS officiel), SNCF (GTFS), Ondéa Aix-les-Bains (GTFS) | — | — |
| Grenoble → Crolles | 47 | 5 | 28 | 12 | 0.1 s | 5.3 s | Mobilités M, SNCF (GTFS officiel), SNCF (GTFS), BlaBlaCar Bus (GTFS) | — | — |
| Rumilly → Annecy | 23 | 0 | 15 | 6 | 0.1 s | 2.4 s | SNCF (GTFS officiel), SNCF (GTFS) | GTFS Sibra : fetch failed | sibra |
| Thonon-les-Bains → Genève | 31 | 0 | 20 | 1 | 0.1 s | 4.4 s | SNCF (GTFS officiel), SNCF (GTFS), FlixBus (GTFS) | — | tpg-fr |
| Voiron → Grenoble | 54 | 0 | 34 | 9 | 0.2 s | 10.2 s | SNCF (GTFS officiel), SNCF (GTFS), Mobilités M, BlaBlaCar Bus (GTFS), Cars Région Isère (GTFS), FlixBus (GTFS) | — | — |
| Aix-les-Bains gare → Technolac (Ondéa 01) | 69 | 40 | 24 | 5 | 0.4 s | 9.4 s | Ondéa Aix-les-Bains (GTFS), SNCF (GTFS officiel), SNCF (GTFS) | — | — |
| Thonon → Bons-en-Chablais (Star’t 142) | 71 | 7 | 40 | 10 | 0.2 s | 16.8 s | Star't Thonon (GTFS), SNCF (GTFS officiel), SNCF (GTFS), Suisse (transport.opendata.ch) | — | — |
| Rumilly Hôpital → Base de loisirs (J’y bus 1) | 58 | 58 | 28 | 0 | 0.4 s | 12.9 s | J’y bus Rumilly (GTFS), J'y bus Rumilly (GTFS) | GTFS Sibra : fetch failed | — |
| Ambérieu gare → Cabrol (TAM 2) | 93 | 83 | 32 | 7 | 0.1 s | 17.8 s | TAM Ambérieu (GTFS), SNCF (GTFS officiel), TAM Ambérieu-en-Bugey (GTFS), Cars Région Ain (GTFS) | — | — |
| Chambéry → Chamoux-sur-Gelon (Cars Savoie S05) | 31 | 0 | 18 | 6 | 0.0 s | 4.4 s | SNCF (GTFS officiel), SNCF (GTFS), Cars Région Savoie (GTFS) | — | — |
| Bourg-en-Bresse → Ambérieu (Cars Ain / TER) | 29 | 1 | 0 | 0 | 0.0 s | 2.7 s | Cars Région Ain (GTFS), SNCF (GTFS officiel), SNCF (GTFS) | — | — |
| Genève → Lausanne | 32 | 0 | 10 | 10 | 0.1 s | 1.3 s | Suisse (transport.opendata.ch), SNCF (GTFS officiel), FlixBus (GTFS), BlaBlaCar Bus (GTFS) | — | — |
| Annemasse → Genève | 37 | 0 | 19 | 11 | 0.2 s | 1.0 s | Suisse (transport.opendata.ch), SNCF (GTFS officiel), SNCF (GTFS), BlaBlaCar Bus (GTFS), FlixBus (GTFS) | — | — |
| Saint-Julien-en-Genevois → Genève | 70 | 0 | 0 | 0 | 0.1 s | 1.0 s | SNCF (GTFS officiel), Suisse (transport.opendata.ch), SNCF (GTFS), Cars Région Haute-Savoie (GTFS) | — | — |
| Archamps → Genève | 18 | 0 | 0 | 0 | 0.2 s | 0.9 s | SNCF (GTFS officiel), Suisse (transport.opendata.ch) | — | — |
| Chambéry → Saint-Julien-en-Genevois | 16 | 0 | 7 | 3 | 0.2 s | 1.4 s | SNCF (GTFS officiel), Suisse (transport.opendata.ch), SNCF (GTFS) | — | — |
| Annecy → Chambéry | 64 | 0 | 15 | 7 | 0.1 s | 0.8 s | SNCF (GTFS officiel), SNCF (GTFS), FlixBus (GTFS), BlaBlaCar Bus (GTFS) | GTFS Sibra : fetch failed | — |
| Lyon → Grenoble | 27 | 0 | 10 | 6 | 0.1 s | 0.8 s | SNCF (GTFS officiel), SNCF (GTFS) | — | longue |
| Lyon Part-Dieu → Bellecour (TCL) | 90 | 65 | 0 | 0 | 0.1 s | 8.7 s | TCL Lyon (GTFS), TCL (GTFS), SNCF (GTFS), SNCF (GTFS officiel) | — | — |
| Voiron → Voreppe (M réso Voironnais) | 32 | 2 | 3 | 3 | 0.1 s | 1.4 s | Mobilités M, SNCF (GTFS officiel), SNCF (GTFS), Cars Région Isère (GTFS) | — | — |

Exemples (3 meilleures propositions par axe) :

**Annecy → Genève**
- Meilleur compromis · Plus rapide : 2026-11-16T07:42:52.518Z → 2026-11-16T09:13:00.000Z · marche 93 m › SNCF TER L2 · Prix à confirmer · Réalisable

**Annemasse → Saint-Julien-en-Genevois**
- Moins cher · Meilleur compromis : 2026-11-16T07:48:47.707Z → 2026-11-16T08:51:41.077Z · marche 102 m › TAC B 4 › marche 640 m · 1,70 € · Réalisable
- Plus rapide : 2026-11-16T08:06:00.000Z → 2026-11-16T08:31:41.584Z · SNCF TER C33 › marche 415 m › TPG B 80 › marche 230 m · Prix à confirmer · Réalisable

**Ambérieu-en-Bugey → Lyon Part-Dieu**
- Meilleur compromis · Plus rapide : 2026-11-16T07:12:26.785Z → 2026-11-16T07:52:00.000Z · marche 1346 m › SNCF K23 · Prix à confirmer · Réalisable

**Chambéry → Aix-les-Bains**
- Moins cher : 2026-11-16T11:06:14.962Z → 2026-11-16T11:41:36.577Z · marche 286 m › Synchro Bus Chambéry 30 › marche 129 m · 1,40 € · Transport non confirmé (horaire GTFS local non confirmé en temps réel)
- Meilleur compromis · Plus rapide : 2026-11-16T07:00:00.000Z → 2026-11-16T07:11:00.000Z · SNCF C21 · Prix à confirmer · Réalisable

**Grenoble → Crolles**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-16T07:02:04.000Z → 2026-11-16T07:42:59.000Z · marche 69 m › M Réso - Métropole Grenobloise C11 · 2,00 € · Réalisable

**Rumilly → Annecy**
- Meilleur compromis · Plus rapide : 2026-11-16T07:47:33.324Z → 2026-11-16T08:15:59.306Z · marche 925 m › SNCF K21 › marche 86 m · Prix à confirmer · Réalisable

**Thonon-les-Bains → Genève**
- Meilleur compromis · Plus rapide : 2026-11-16T08:27:38.441Z → 2026-11-16T09:41:19.389Z · marche 197 m › SNCF L1 › marche 2419 m · Prix à confirmer · Réalisable

**Voiron → Grenoble**
- Meilleur compromis · Plus rapide : 2026-11-16T07:19:38.452Z → 2026-11-16T07:39:00.000Z · marche 361 m › SNCF K6 · Prix à confirmer · Réalisable

**Aix-les-Bains gare → Technolac (Ondéa 01)**
- Moins cher : 2026-11-16T07:06:00.000Z → 2026-11-16T07:36:00.000Z · Ondéa Aix-les-Bains 03 › Ondéa Aix-les-Bains 01 · 1,70 € · Transport non confirmé (marches non calculées (quota de la fiche))
- Meilleur compromis · Plus rapide : 2026-11-16T07:13:00.000Z → 2026-11-16T07:56:56.409Z · SNCF P3 › marche 3361 m · Prix à confirmer · Réalisable

**Thonon → Bons-en-Chablais (Star’t 142)**
- Moins cher : 2026-11-16T07:01:00.000Z → 2026-11-16T07:50:00.000Z · Star't Thonon 142 · 2,20 € · Transport non confirmé (horaire GTFS local non confirmé en temps réel)
- Meilleur compromis · Plus rapide : 2026-11-16T07:28:02.877Z → 2026-11-16T07:54:10.713Z · marche 154 m › SNCF C33 › marche 804 m · Prix à confirmer · Réalisable

**Rumilly Hôpital → Base de loisirs (J’y bus 1)**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-16T09:04:00.000Z → 2026-11-16T09:04:00.000Z · J’y bus Rumilly 1 · 1,00 € · Transport non confirmé (marches non calculées (quota de la fiche))

**Ambérieu gare → Cabrol (TAM 2)**
- Moins cher : 2026-11-16T08:09:00.000Z → 2026-11-16T08:10:00.000Z · TAM Ambérieu TAM 2 · 1,10 € · Transport non confirmé (marches non calculées (quota de la fiche))
- Meilleur compromis · Plus rapide : 2026-11-16T07:03:28.321Z → 2026-11-16T07:59:31.677Z · marche 46 m › SNCF P13 › marche 4056 m · Prix à confirmer · Réalisable

**Chambéry → Chamoux-sur-Gelon (Cars Savoie S05)**
- Meilleur compromis · Plus rapide : 2026-11-16T07:28:26.574Z → 2026-11-16T08:49:14.460Z · marche 346 m › SNCF P31 › marche 2867 m · Prix à confirmer · Réalisable

**Bourg-en-Bresse → Ambérieu (Cars Ain / TER)**
- Moins cher : 2026-11-16T14:33:00.000Z → 2026-11-16T17:57:00.000Z · Cars Région Ain A19 › Cars Région Ain A27 · 2,30 € · Transport non confirmé (horaire GTFS local non confirmé en temps réel · marche depuis l’adresse exacte de départ non calculée · marche jusqu’à l’adresse exacte d’arrivée non calculée)
- Meilleur compromis · Plus rapide : 2026-11-16T09:45:00.000Z → 2026-11-16T10:01:00.000Z · SNCF K13 · Prix à confirmer · Transport non confirmé (marche depuis l’adresse exacte de départ non calculée · marche jusqu’à l’adresse exacte d’arrivée non calculée)

**Genève → Lausanne**
- Meilleur compromis · Plus rapide : 2026-11-16T07:05:00.000Z → 2026-11-16T07:44:00.000Z · SBB IR 90 · Prix à confirmer · Réalisable

**Annemasse → Genève**
- Meilleur compromis · Plus rapide : 2026-11-16T07:20:00.000Z → 2026-11-16T07:43:00.000Z · SBB R L4 · Prix à confirmer · Réalisable

**Saint-Julien-en-Genevois → Genève**
- Meilleur compromis · Plus rapide : 2026-11-16T07:07:00.000Z → 2026-11-16T07:13:00.000Z · SNCF L2 · Prix à confirmer · Transport non confirmé (marche depuis l’adresse exacte de départ non calculée)

**Archamps → Genève**
- Meilleur compromis · Plus rapide : 2026-11-16T07:07:00.000Z → 2026-11-16T07:13:00.000Z · SNCF L2 · Prix à confirmer · Transport non confirmé (marche depuis l’adresse exacte de départ non calculée)

**Chambéry → Saint-Julien-en-Genevois**
- Meilleur compromis · Plus rapide : 2026-11-16T07:22:00.000Z → 2026-11-16T11:11:53.607Z · SNCF K21 › SNCF L2 › marche 5341 m · Prix à confirmer · Réalisable

**Annecy → Chambéry**
- Meilleur compromis · Plus rapide : 2026-11-16T07:41:57.390Z → 2026-11-16T08:36:00.000Z · marche 86 m › SNCF K21 · Prix à confirmer · Réalisable

**Lyon → Grenoble**
- Meilleur compromis · Plus rapide : 2026-11-16T08:16:00.000Z → 2026-11-16T09:39:00.000Z · SNCF K6 · Prix à confirmer · Réalisable

**Lyon Part-Dieu → Bellecour (TCL)**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-16T07:00:00.000Z → 2026-11-16T07:00:00.000Z · TCL Lyon C14 · 2,10 € · Transport non confirmé (horaire GTFS local non confirmé en temps réel · marche depuis l’adresse exacte de départ non calculée · marche jusqu’à l’adresse exacte d’arrivée non calculée)

**Voiron → Voreppe (M réso Voironnais)**
- Moins cher · Meilleur compromis : 2026-11-16T07:07:40.000Z → 2026-11-16T07:34:07.000Z · marche 389 m › M Réso - Métropole Grenobloise C13 › marche 61 m · 2,00 € · Réalisable
- Plus rapide : 2026-11-16T07:10:26.000Z → 2026-11-16T07:35:43.000Z · marche 358 m › Mobilités M - SNCF C6 › marche 89 m › M Réso - Métropole Grenobloise C13 › marche 40 m · Prix à confirmer · Réalisable

