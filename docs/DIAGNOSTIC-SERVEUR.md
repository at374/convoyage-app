# Diagnostic réel des transports — serveur GitHub Actions

Exécuté le 2026-11-24T15:14:12.261Z ; départs à partir de 2026-11-30T08:00:00+01:00 ; TripGo : non (pas de clé).

**Bilan : 972 trajets sur 27 axes, 380 avec prix vérifié (39.1 %), 942 avec marches calculées (96.9 %), 93 réalisables, 847 en horaire programmé (officiel, marches et marge vérifiées, sans temps réel).**

**TripGo : 0 trajets, 0 avec prix vérifié, 0 portions avec billet chiffré.**

Portions TripGo sans prix par opérateur : aucune.

Exemples de lignes sans tarif (3 par opérateur et par axe) :

- annecy-geneve / SNCF : Train TER L2 (Annecy → Genève) ; Train L2 (Annecy → Genève Cornavin) ; Bus B L2 (Annecy → Annemasse)
- annecy-geneve / FlixBus : Car FlixBus 1726 (Annecy (Central Bus Station) → Geneva (central bus station)) ; Car FlixBus 1749 (Annecy (Central Bus Station) → Geneva (central bus station)) ; Car FlixBus S766 (Annecy (Central Bus Station) → Sallanches (Bus Station))
- annecy-geneve / BlaBlaCar Bus : Car BlaBlaCar Bus (Annecy - Bus Station → Geneva - Bus Station) ; Car BlaBlaCar Bus (Annecy - Bus Station → Geneva - Airport Bus Station) ; Car BlaBlaCar Bus (Geneva - Airport Bus Station → Geneva - Bus Station)
- annecy-geneve / Cars Région Haute-Savoie : Bus 274 (Aéroport → Poste) ; Bus 274 (Aéroport → Mont-Blanc)
- annemasse-stjulien / SNCF : Train C33 (Annemasse → Saint-Julien-en-Genevois) ; Train C43 (Annemasse → Saint-Julien-en-Genevois) ; Train TER C33 (Annemasse → Saint-Julien-en-Genevois)
- annemasse-stjulien / TPG : Bus B 80 (Saint-Julien, gare → Saint-Julien, centre)
- amberieu-lyon / SNCF : Train K23 (Ambérieu-en-Bugey → Lyon Part Dieu) ; Train C18 (Ambérieu-en-Bugey → Lyon Part Dieu) ; Train K1+ (Ambérieu-en-Bugey → Lyon Part Dieu)
- chambery-aix / SNCF : Train 621B (Chambéry - Challes-les-Eaux → Aix-les-Bains le Revard) ; Train C21 (Chambéry - Challes-les-Eaux → Aix-les-Bains le Revard) ; Train P41 (Chambéry - Challes-les-Eaux → Aix-les-Bains le Revard)
- grenoble-crolles / BlaBlaCar Bus : Car BlaBlaCar Bus (Grenoble - Bus Station → Crolles - Le Rafour)
- rumilly-annecy / SNCF : Train K21 (Rumilly → Annecy) ; Train C21 (Rumilly → Annecy) ; Train K23 (Rumilly → Annecy)
- thonon-geneve / But : Bus B 002279 (Thonon-les-Bains, Georges And. → Thonon-les-Bains, Les Arts) ; Bus B 002278 (Thonon-les-Bains, Georges And. → Thonon-les-Bains, Les Arts) ; Bus B 002283 (Thonon-les-Bains, Georges And. → Thonon-les-Bains, Les Arts)
- thonon-geneve / SNCF : Train TER L1 (Thonon-les-Bains → Genève) ; Train L1 (Thonon-les-Bains → Genève Cornavin) ; Train TER C33 (Thonon-les-Bains → Annemasse)
- thonon-geneve / FlixBus : Car FlixBus S1736 (Thonon-les-Bains → Annecy (Central Bus Station)) ; Car FlixBus 1726 (Annecy (Central Bus Station) → Geneva (central bus station))
- thonon-geneve / AFO : Bus B 271 (Thonon-les-Bains, Les Arts → Genève, Place des Eaux-Vives)
- voiron-grenoble / Mobilités M - SNCF : Train K6 (Voiron, Voiron → Grenoble, Grenoble) ; Train C6 (Voiron, Voiron → Grenoble, Grenoble)
- voiron-grenoble / SNCF : Train K6 (Voiron → Grenoble) ; Train C6 (Voiron → Grenoble)
- voiron-grenoble / BlaBlaCar Bus : Car BlaBlaCar Bus (Voiron - Champfeuillet → Grenoble - Bus Station)
- voiron-grenoble / Cars Région Isère : Bus T41 (Gare Routière Nord → Gare Routière) ; Bus T40 (Gare Routière → Gare Routière) ; Bus T55 (Gare Routière Sud → Gare Routière)
- thonon-bons / But : Bus B 142 (Thonon-les-Bains, Les Arts → Bons-en-Chablais, Mairie)
- thonon-bons / SNCF : Train L1 (Thonon-les-Bains → Bons-en-Chablais) ; Train C33 (Thonon-les-Bains → Bons-en-Chablais)
- thonon-bons / Star't Thonon : Bus SMAR (Les Mottes → Presbytère)
- chambery-chamoux / Cars Région Savoie : Bus S05 (Gare Routiere → Ecoles)
- chambery-chamoux / SNCF : Train P31 (Chambéry - Challes-les-Eaux → Chamousset)
- bourg-amberieu / SNCF : Train K13 (Bourg-en-Bresse → Ambérieu-en-Bugey) ; Train P13 (Bourg-en-Bresse Archives → Ambérieu-en-Bugey) ; Train P13 (Bourg-en-Bresse Gare Routière → Ambérieu-en-Bugey)
- bourg-amberieu / Cars Région Ain : Bus A32 (Berthelot → Carré Amiot (Quai E)) ; Bus A32 (SNCF → Carré Amiot (Quai E))
- bourg-intra / Rubis Bourg-en-Bresse : Bus 3 (Sémard Gare → Hôtel de Ville) ; Bus 1 (Victoire Gare → Voltaire) ; Bus 1 (Victoire Gare → Carré Amiot (Quai B))
- bourg-intra / Cars Région Ain : Bus A32 (Berthelot → Village) ; Bus A32 (Village → Carré Amiot (Quai E)) ; Bus A32 (SNCF → Village)
- bourg-intra / SNCF : Train P13 (Bourg-en-Bresse Gare Routière → Bourg-en-Bresse Charité)
- bonneville-laroche / SNCF : Train TER C13 (Bonneville → La Roche-sur-Foron) ; Train TER L3 (Bonneville → La Roche-sur-Foron) ; Train L3 (Bonneville → La Roche-sur-Foron)
- evian-thonon / Evian : Bus B 02 (Évian-les-Bains, Jard.Japonais → Thonon-les-Bains, Les Arts) ; Bus B 02 (Évian-les-Bains, Jard.Japonais → Evian-les-Bains, gare SNCF) ; Bus B 01 (Évian-les-Bains, Anna Noailles → Thonon-les-Bains, Les Arts)
- evian-thonon / SNCF : Train L1 (Évian-les-Bains → Thonon-les-Bains) ; Train TER C33 (Evian-les-Bains → Thonon-les-Bains) ; Train C33 (Évian-les-Bains → Thonon-les-Bains)
- evian-thonon / But : Bus B A (Thonon-les-Bains, Les Arts → Thonon-les-Bains, Pré Cergues) ; Bus B N (Thonon-les-Bains, Pré Cergues → Thonon-les-Bains, Les Arts) ; Bus B D (Thonon-les-Bains, Pré Cergues → Thonon-les-Bains, Les Arts)
- evian-thonon / ÉVA'D Évian : Bus 01 (GARE ROUTIERE → LES ARTS) ; Bus 02 (JARDIN JAPONAIS → LES ARTS)
- geneve-lausanne / SBB : Train IR 90 (Genève → Lausanne) ; Train RE 33 (Genève → Lausanne) ; Train IR 95 (Genève → Lausanne)
- geneve-lausanne / FlixBus : Car FlixBus 1689 (Geneva (central bus station) → Lausanne (P+R Vélodrome)) ; Car FlixBus 122 (Geneva (central bus station) → Lausanne (P+R Vélodrome)) ; Car FlixBus 1749 (Geneva (central bus station) → Lausanne (P+R Vélodrome))
- geneve-lausanne / BlaBlaCar Bus : Car BlaBlaCar Bus (Geneva - Bus Station → Geneva - Airport Bus Station) ; Car BlaBlaCar Bus (Geneva - Airport Bus Station → Lausanne) ; Car BlaBlaCar Bus (Geneva - Bus Station → Annecy - Bus Station)
- stjulien-geneve / SNCF : Train C33 (Saint-Julien-en-Genevois → Annemasse)
- stjulien-geneve / Cars Région Haute-Savoie : Bus 274 (Aéroport → Poste) ; Bus 274 (Aéroport → Mont-Blanc)
- chambery-stjulien / SNCF : Train TER K11 (Chambéry-Challes-les-Eaux → Bellegarde-sur-Valserine) ; Train TER C33 (Bellegarde-sur-Valserine → Saint-Julien-en-Genevois) ; Train K11 (Chambéry - Challes-les-Eaux → Bellegarde)
- chambery-stjulien / AFO : Bus B 272 (Annecy, Gare routière → Saint-Julien, centre)
- annecy-chambery / SNCF : Train 621B (Annecy → Chambéry - Challes-les-Eaux) ; Train C21 (Annecy → Chambéry - Challes-les-Eaux) ; Train K21 (Annecy → Chambéry - Challes-les-Eaux)
- annecy-chambery / BlaBlaCar Bus : Car BlaBlaCar Bus (Annecy - Bus Station → Chambéry - Bus Station)
- annecy-chambery / FlixBus : Car FlixBus 1726 (Annecy (Central Bus Station) → Chambéry (Central Bus Station)) ; Car FlixBus 1789 (Annecy (Central Bus Station) → Chambéry (Central Bus Station)) ; Car FlixBus 739 (Annecy (Central Bus Station) → Chambéry (Central Bus Station))
- lyon-grenoble / SNCF : Train K6 (Lyon Part Dieu → Grenoble)
- chambery-grenoble / SNCF : Train K11 (Chambéry - Challes-les-Eaux → Grenoble) ; Train C1 (Chambéry - Challes-les-Eaux → Grenoble) ; Train K21 (Chambéry - Challes-les-Eaux → Grenoble)
- chambery-grenoble / FlixBus : Car FlixBus 789 (Chambéry (Central Bus Station) → Grenoble (Central Bus Station)) ; Car FlixBus 1789 (Chambéry (Central Bus Station) → Grenoble (Central Bus Station)) ; Car FlixBus 739 (Chambéry (Central Bus Station) → Grenoble (Central Bus Station))
- chambery-grenoble / BlaBlaCar Bus : Car BlaBlaCar Bus (Chambéry - Bus Station → Grenoble - Bus Station)
- chambery-grenoble / Cars Région Isère : Bus T83 (Gare Routière → Gares) ; Bus T83 (Gare Routière → Gare Routière) ; Bus T90 (Gare Routière → Gares)
- lyon-intra / SNCF : Train C23 (Lyon Part Dieu → Lyon Perrache) ; Train C15 (Lyon Part Dieu → Lyon Perrache) ; Train 601A (Lyon Part Dieu → Lyon Perrache)
- lyon-intra / Cars Région Express : Bus X75 (Lyon-Part-Dieu Gare Routière → Lyon Pont Gallieni)
- lyon-intra / Trenitalia : Train Paris-Gare-de-Lyon/Lyon-Perrache-Voyageurs (Lyon-Part-Dieu → Lyon-Perrache-Voyageurs)
- voiron-voreppe / Mobilités M - SNCF : Train C6 (Voiron, Voiron → Voreppe, Voreppe)
- voiron-voreppe / SNCF : Train C6 (Voiron → Voreppe) ; Train K6 (Voiron → Grenoble) ; Train C31 (Grenoble → Voreppe)
- voiron-voreppe / Cars Région Isère : Bus T41 (Gare Routière Nord → Gare Routière) ; Bus T40 (Gare Routière → Place Docteur Thévenet) ; Bus T40 (Gare Routière → La Verronière)

Lignes bloquant les itinéraires partiellement tarifés :

- annecy-geneve / SNCF : B L2
- annecy-geneve / Cars Région Haute-Savoie : 274
- thonon-geneve / But : B 002278, B 002283, B 002289
- thonon-geneve / SNCF : TER C33
- thonon-geneve / AFO : B 271
- thonon-bons / Star't Thonon : SMAR
- bourg-amberieu / Cars Région Ain : A32
- stjulien-geneve / SNCF : C33
- stjulien-geneve / Cars Région Haute-Savoie : 274
- chambery-stjulien / SNCF : TER K11
- voiron-voreppe / Mobilités M - SNCF : C6

Correspondances bloquant les itinéraires partiellement tarifés : Cars Région Haute-Savoie (48), SNCF (11), But (4), Cars Région Ain (2), AFO (1), Star't Thonon (1), Mobilités M - SNCF (1).

Portions sans prix par opérateur (toutes sources) : SNCF (327), Cars Région Isère (99), Cars Région Haute-Savoie (48), FlixBus (35), BlaBlaCar Bus (33), Cars Région Ain (29), Rubis Bourg-en-Bresse (29), ÉVA'D Évian (29), But (14), Evian (12), Mobilités M - SNCF (8), SBB (8), AFO (7), Trenitalia (6), Cars Région Express (5), Cars Région Savoie (2), TPG (1), Star't Thonon (1).

| Axe | Trajets | Prix vérifié | Marches calculées | Réalisables | Horaire programmé | 1er résultat | Total | Sources | Erreurs | Attendus non vus |
|---|---|---|---|---|---|---|---|---|---|---|
| Annecy → Genève | 49 | 0 | 49 | 8 | 41 | 0.2 s | 9.9 s | Suisse (transport.opendata.ch), FlixBus (GTFS), BlaBlaCar Bus (GTFS), SNCF (GTFS), Cars Région Haute-Savoie (GTFS) | — | — |
| Annemasse → Saint-Julien-en-Genevois | 52 | 38 | 52 | 8 | 44 | 0.5 s | 23.9 s | Suisse (transport.opendata.ch), SNCF (GTFS), TAC Annemasse (GTFS) | — | lex |
| Ambérieu-en-Bugey → Lyon Part-Dieu | 18 | 0 | 18 | 0 | 18 | 0.9 s | 1.4 s | SNCF (GTFS) | — | — |
| Chambéry → Aix-les-Bains | 65 | 45 | 65 | 0 | 65 | 0.2 s | 10.9 s | Synchro Bus Chambéry (GTFS), Ondéa Aix-les-Bains (GTFS), SNCF (GTFS), Synchro Chambéry (GTFS) | — | — |
| Grenoble → Crolles | 8 | 5 | 8 | 5 | 3 | 0.1 s | 3.9 s | Mobilités M, BlaBlaCar Bus (GTFS) | — | — |
| Rumilly → Annecy | 21 | 1 | 21 | 0 | 21 | 0.1 s | 4.7 s | Sibra (GTFS), SNCF (GTFS) | — | — |
| Thonon-les-Bains → Genève | 16 | 0 | 15 | 7 | 8 | 0.8 s | 7.8 s | Suisse (transport.opendata.ch), SNCF (GTFS), FlixBus (GTFS) | — | — |
| Voiron → Grenoble | 39 | 0 | 39 | 5 | 34 | 0.2 s | 10.1 s | Mobilités M, SNCF (GTFS), BlaBlaCar Bus (GTFS), Cars Région Isère (GTFS) | — | — |
| Aix-les-Bains gare → Technolac (Ondéa 01) | 19 | 19 | 19 | 0 | 19 | 0.3 s | 11.1 s | Ondéa Aix-les-Bains (GTFS) | — | — |
| Thonon → Bons-en-Chablais (Star’t 142) | 50 | 31 | 50 | 2 | 48 | 0.3 s | 16.8 s | Star't Thonon (GTFS), Suisse (transport.opendata.ch), SNCF (GTFS) | — | — |
| Rumilly Hôpital → Base de loisirs (J’y bus 1) | 60 | 60 | 60 | 0 | 60 | 0.4 s | 11.5 s | J’y bus Rumilly (GTFS), J'y bus Rumilly (GTFS) | — | — |
| Ambérieu gare → Cabrol (TAM 2) | 83 | 83 | 83 | 0 | 83 | 0.3 s | 16.2 s | TAM Ambérieu (GTFS), TAM Ambérieu-en-Bugey (GTFS), Cars Région Ain (GTFS) | — | — |
| Chambéry → Chamoux-sur-Gelon (Cars Savoie S05) | 10 | 0 | 10 | 0 | 10 | 0.0 s | 2.3 s | Cars Région Savoie (GTFS), SNCF (GTFS) | — | — |
| Bourg-en-Bresse → Ambérieu (Cars Ain / TER) | 16 | 1 | 16 | 0 | 16 | 0.0 s | 5.6 s | Cars Région Ain (GTFS), SNCF (GTFS) | — | — |
| Bourg-en-Bresse gare routière → centre (Rubis) | 57 | 7 | 57 | 1 | 56 | 0.0 s | 11.5 s | Marche (Valhalla / OpenStreetMap), Rubis Bourg-en-Bresse (GTFS), Cars Région Ain (GTFS), SNCF (GTFS) | — | — |
| Bonneville → La Roche-sur-Foron (Proxim iTi / TER) | 23 | 0 | 23 | 7 | 16 | 0.8 s | 4.3 s | Suisse (transport.opendata.ch), SNCF (GTFS) | — | — |
| Évian → Thonon (ÉVA’D / TER) | 53 | 0 | 52 | 7 | 45 | 0.4 s | 12.4 s | Suisse (transport.opendata.ch), SNCF (GTFS), ÉVA'D Évian (GTFS) | — | — |
| Genève → Lausanne | 20 | 0 | 20 | 8 | 12 | 0.1 s | 5.8 s | Suisse (transport.opendata.ch), FlixBus (GTFS), BlaBlaCar Bus (GTFS) | — | — |
| Annemasse → Genève | 28 | 28 | 26 | 6 | 20 | 0.9 s | 3.4 s | Suisse (transport.opendata.ch), SNCF (GTFS) | — | — |
| Saint-Julien-en-Genevois → Genève | 45 | 8 | 45 | 8 | 37 | 0.1 s | 6.6 s | Suisse (transport.opendata.ch), SNCF (GTFS), Cars Région Haute-Savoie (GTFS) | — | — |
| Archamps → Genève | 8 | 8 | 8 | 8 | 0 | 0.8 s | 4.8 s | Suisse (transport.opendata.ch) | — | — |
| Chambéry → Saint-Julien-en-Genevois | 11 | 0 | 11 | 7 | 4 | 0.8 s | 4.3 s | Suisse (transport.opendata.ch), SNCF (GTFS) | — | — |
| Annecy → Chambéry | 35 | 0 | 35 | 0 | 33 | 0.2 s | 2.1 s | SNCF (GTFS), BlaBlaCar Bus (GTFS), FlixBus (GTFS) | — | — |
| Lyon → Grenoble | 20 | 0 | 20 | 0 | 20 | 0.2 s | 2.4 s | SNCF (GTFS) | — | longue |
| Chambéry → Grenoble | 72 | 0 | 72 | 0 | 72 | 0.1 s | 10.9 s | SNCF (GTFS), FlixBus (GTFS), BlaBlaCar Bus (GTFS), Cars Région Isère (GTFS) | — | — |
| Lyon Part-Dieu → Bellecour (TCL) | 63 | 44 | 37 | 1 | 36 | 0.0 s | 29.0 s | Marche (Valhalla / OpenStreetMap), TCL Lyon (GTFS), SNCF (GTFS), Cars Région Express (GTFS), TCL (GTFS), Trenitalia (GTFS) | — | — |
| Voiron → Voreppe (M réso Voironnais) | 31 | 2 | 31 | 5 | 26 | 0.1 s | 3.6 s | Mobilités M, SNCF (GTFS), Cars Région Isère (GTFS) | — | — |

Exemples (3 meilleures propositions par axe) :

**Annecy → Genève**
- Meilleur compromis : 2026-11-30T07:42:52.518Z → 2026-11-30T09:13:00.000Z · marche 93 m › SNCF TER L2 · Prix à confirmer · Réalisable
- Plus rapide · FlixBus : 2026-11-30T16:48:15.036Z → 2026-11-30T17:46:37.350Z · marche 140 m › FlixBus FlixBus 1726 › marche 545 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés)
- BlaBlaCar Bus : 2026-11-30T14:49:20.048Z → 2026-11-30T15:51:02.017Z · marche 54 m › BlaBlaCar Bus BlaBlaCar Bus › marche 494 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés)

**Annemasse → Saint-Julien-en-Genevois**
- Moins cher · Meilleur compromis : 2026-11-30T07:48:47.707Z → 2026-11-30T08:51:41.077Z · marche 102 m › TAC B 4 › marche 640 m · 1,70 € · Réalisable
- Plus rapide : 2026-11-30T10:12:00.000Z → 2026-11-30T10:31:51.177Z · SNCF C33 › marche 643 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés)

**Ambérieu-en-Bugey → Lyon Part-Dieu**
- Meilleur compromis · Plus rapide : 2026-11-30T07:12:26.785Z → 2026-11-30T07:52:00.000Z · marche 1346 m › SNCF K23 · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés · recherche des correspondances incomplète)

**Chambéry → Aix-les-Bains**
- Moins cher : 2026-11-30T11:06:14.962Z → 2026-11-30T11:41:36.577Z · marche 286 m › Synchro Bus Chambéry 30 › marche 129 m · 1,40 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)
- Meilleur compromis : 2026-11-30T16:26:37.129Z → 2026-11-30T17:01:36.577Z · marche 262 m › Ondéa Aix-les-Bains 419 › marche 129 m · 1,70 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)
- Plus rapide : 2026-11-30T08:49:00.000Z → 2026-11-30T08:58:00.000Z · SNCF 621B · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés · recherche des correspondances incomplète)

**Grenoble → Crolles**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-30T07:02:04.000Z → 2026-11-30T07:42:59.000Z · marche 69 m › M Réso - Métropole Grenobloise C11 · 2,00 € · Réalisable
- BlaBlaCar Bus : 2026-11-30T10:02:27.806Z → 2026-11-30T10:51:18.909Z · marche 215 m › BlaBlaCar Bus BlaBlaCar Bus › marche 2136 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés)

**Rumilly → Annecy**
- Moins cher · Meilleur compromis : 2026-11-30T12:03:51.578Z → 2026-11-30T13:00:49.298Z · marche 625 m › Sibra 42 › marche 160 m · 2,00 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)
- Plus rapide : 2026-11-30T18:48:33.607Z → 2026-11-30T19:15:59.306Z · marche 925 m › SNCF K21 › marche 86 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés · recherche des correspondances incomplète)

**Thonon-les-Bains → Genève**
- Meilleur compromis : 2026-11-30T08:00:30.709Z → 2026-11-30T09:28:00.000Z · marche 203 m › But B 002279 › marche 231 m › SNCF TER L1 · Prix à confirmer · Réalisable
- Plus rapide : 2026-11-30T08:27:38.441Z → 2026-11-30T09:28:00.000Z · marche 197 m › SNCF L1 · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés · recherche des correspondances incomplète)
- FlixBus : 2026-11-30T14:35:21.001Z → 2026-11-30T17:46:37.350Z · marche 1235 m › FlixBus FlixBus S1736 › FlixBus FlixBus 1726 › marche 545 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés · correspondance programmée non confirmée en temps réel)

**Voiron → Grenoble**
- Meilleur compromis : 2026-11-30T07:49:26.000Z → 2026-11-30T08:09:27.000Z · marche 358 m › Mobilités M - SNCF K6 › marche 27 m · Prix à confirmer · Réalisable
- Plus rapide : 2026-11-30T07:50:38.452Z → 2026-11-30T08:09:00.000Z · marche 361 m › SNCF K6 · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés · recherche des correspondances incomplète)
- BlaBlaCar Bus : 2026-11-30T19:15:54.482Z → 2026-11-30T20:12:35.751Z · marche 2748 m › BlaBlaCar Bus BlaBlaCar Bus › marche 215 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés)

**Aix-les-Bains gare → Technolac (Ondéa 01)**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-30T16:15:00.000Z → 2026-11-30T16:38:00.000Z · Ondéa Aix-les-Bains 01 · 1,70 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)

**Thonon → Bons-en-Chablais (Star’t 142)**
- Moins cher : 2026-11-30T07:01:00.000Z → 2026-11-30T07:50:00.000Z · Star't Thonon 142 · 2,20 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)
- Meilleur compromis : 2026-11-30T17:03:36.652Z → 2026-11-30T17:42:00.000Z · marche 117 m › But B 142 · Prix à confirmer · Réalisable
- Plus rapide : 2026-11-30T10:39:02.877Z → 2026-11-30T11:04:10.713Z · marche 154 m › SNCF L1 › marche 804 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés · recherche des correspondances incomplète)

**Rumilly Hôpital → Base de loisirs (J’y bus 1)**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-30T11:38:00.000Z → 2026-11-30T12:01:00.000Z · J’y bus Rumilly 1 · 1,00 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)

**Ambérieu gare → Cabrol (TAM 2)**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-30T07:40:00.000Z → 2026-11-30T07:56:00.000Z · TAM Ambérieu TAM 2 · 1,10 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)

**Chambéry → Chamoux-sur-Gelon (Cars Savoie S05)**
- Meilleur compromis : 2026-11-30T11:30:00.000Z → 2026-11-30T12:38:00.000Z · Cars Région Savoie S05 · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)
- Plus rapide : 2026-11-30T17:24:26.574Z → 2026-11-30T18:26:14.460Z · marche 346 m › SNCF P31 › marche 2867 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés)

**Bourg-en-Bresse → Ambérieu (Cars Ain / TER)**
- Moins cher : 2026-11-30T14:33:00.000Z → 2026-11-30T17:57:27.767Z · Cars Région Ain A19 › Cars Région Ain A27 › marche 38 m · 2,30 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)
- Meilleur compromis · Plus rapide : 2026-11-30T09:43:55.631Z → 2026-11-30T10:01:33.893Z · marche 93 m › SNCF K13 › marche 46 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés)

**Bourg-en-Bresse gare routière → centre (Rubis)**
- Moins cher · Meilleur compromis : 2026-11-30T07:00:00.000Z → 2026-11-30T07:12:35.943Z · marche 1092 m · Gratuit (à pied) · Réalisable
- Plus rapide : 2026-11-30T07:00:00.000Z → 2026-11-30T07:07:27.570Z · Rubis Bourg-en-Bresse 3 › marche 126 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)

**Bonneville → La Roche-sur-Foron (Proxim iTi / TER)**
- Meilleur compromis · Plus rapide : 2026-11-30T07:27:54.400Z → 2026-11-30T07:56:49.339Z · marche 835 m › SNCF TER C13 › marche 706 m · Prix à confirmer · Réalisable

**Évian → Thonon (ÉVA’D / TER)**
- Meilleur compromis : 2026-11-30T07:17:49.850Z → 2026-11-30T08:19:23.302Z · marche 225 m › Evian B 02 › marche 117 m · Prix à confirmer · Réalisable
- Plus rapide : 2026-11-30T14:12:50.839Z → 2026-11-30T14:29:54.070Z · marche 568 m › SNCF L1 › marche 161 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés · recherche des correspondances incomplète)

**Genève → Lausanne**
- Meilleur compromis · Plus rapide : 2026-11-30T07:05:00.000Z → 2026-11-30T07:44:00.000Z · SBB IR 90 · Prix à confirmer · Réalisable
- FlixBus : 2026-11-30T07:23:56.796Z → 2026-11-30T08:58:14.063Z · marche 521 m › FlixBus FlixBus 1689 › marche 2907 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés)
- BlaBlaCar Bus : 2026-11-30T10:29:14.902Z → 2026-11-30T12:32:11.253Z · marche 494 m › BlaBlaCar Bus BlaBlaCar Bus › BlaBlaCar Bus BlaBlaCar Bus › marche 2826 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés · correspondance programmée non confirmée en temps réel)

**Annemasse → Genève**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-30T07:20:00.000Z → 2026-11-30T07:43:00.000Z · SBB R L4 · 4,90 € · Réalisable

**Saint-Julien-en-Genevois → Genève**
- Moins cher · Plus rapide : 2026-11-30T07:17:00.960Z → 2026-11-30T07:58:00.000Z · marche 230 m › TPG B 80 › marche 115 m › SBB R L1 · 4,80 € · Réalisable
- Meilleur compromis : 2026-11-30T07:39:00.960Z → 2026-11-30T08:29:38.794Z · marche 230 m › TPG B 80 › marche 848 m · 4,80 € · Réalisable

**Archamps → Genève**
- Meilleur compromis · Plus rapide : 2026-11-30T07:47:51.967Z → 2026-11-30T08:28:00.000Z · marche 1054 m › TPG B 82 › marche 115 m › SBB R L3 · 4,80 € · Réalisable

**Chambéry → Saint-Julien-en-Genevois**
- Meilleur compromis : 2026-11-30T11:41:35.471Z → 2026-11-30T13:49:04.438Z · marche 31 m › SNCF TER K11 › SNCF TER C33 › marche 750 m · Prix à confirmer · Réalisable
- Plus rapide : 2026-11-30T17:46:00.000Z → 2026-11-30T19:47:51.177Z · SNCF K11 › SNCF C33 › marche 643 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés · correspondance programmée non confirmée en temps réel)

**Annecy → Chambéry**
- Meilleur compromis : 2026-11-30T08:22:57.390Z → 2026-11-30T09:04:00.000Z · marche 86 m › SNCF 621B · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés · recherche des correspondances incomplète)
- Plus rapide · BlaBlaCar Bus : 2026-11-30T10:24:20.048Z → 2026-11-30T11:03:47.341Z · marche 54 m › BlaBlaCar Bus BlaBlaCar Bus › marche 284 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés)
- FlixBus : 2026-11-30T08:58:15.036Z → 2026-11-30T09:48:44.976Z · marche 140 m › FlixBus FlixBus 1726 › marche 286 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés)

**Lyon → Grenoble**
- Meilleur compromis · Plus rapide : 2026-11-30T07:16:00.000Z → 2026-11-30T08:39:00.000Z · SNCF K6 · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés · recherche des correspondances incomplète)

**Chambéry → Grenoble**
- Meilleur compromis · Plus rapide : 2026-11-30T07:21:00.000Z → 2026-11-30T08:02:00.000Z · SNCF K11 · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés · recherche des correspondances incomplète)
- FlixBus : 2026-11-30T20:01:14.962Z → 2026-11-30T20:58:05.049Z · marche 286 m › FlixBus FlixBus 789 › marche 246 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés)
- BlaBlaCar Bus : 2026-11-30T09:31:13.607Z → 2026-11-30T10:32:35.751Z · marche 284 m › BlaBlaCar Bus BlaBlaCar Bus › marche 215 m · Prix à confirmer · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS non confirmé en temps réel · prix commercial et disponibilité non vérifiés)

**Lyon Part-Dieu → Bellecour (TCL)**
- Moins cher · Meilleur compromis : 2026-11-30T07:00:00.000Z → 2026-11-30T07:30:30.725Z · marche 2507 m · Gratuit (à pied) · Réalisable
- Plus rapide : 2026-11-30T07:06:04.315Z → 2026-11-30T07:21:14.783Z · marche 168 m › TCL Lyon C9 › marche 180 m · 2,10 € · Horaire programmé — à confirmer le jour J (Horaire officiel publié ; marches, correspondances et marge vérifiées. Reste à confirmer : horaire GTFS local non confirmé en temps réel)

**Voiron → Voreppe (M réso Voironnais)**
- Moins cher · Meilleur compromis : 2026-11-30T07:07:40.000Z → 2026-11-30T07:34:07.000Z · marche 389 m › M Réso - Métropole Grenobloise C13 › marche 61 m · 2,00 € · Réalisable
- Plus rapide : 2026-11-30T07:10:26.000Z → 2026-11-30T07:35:43.000Z · marche 358 m › Mobilités M - SNCF C6 › marche 89 m › M Réso - Métropole Grenobloise C13 › marche 40 m · Prix à confirmer · Réalisable

