# Diagnostic réel des transports — serveur GitHub Actions

Exécuté le 2026-11-13T16:51:43.244Z ; départs à partir de 2026-11-16T08:00:00+01:00 ; TripGo : oui.

**Bilan : 473 trajets sur 15 axes, 174 avec prix vérifié (36.8 %), 217 avec marches calculées (45.9 %), 173 réalisables.**

**TripGo : 47 trajets, 0 avec prix vérifié, 0 portions avec billet chiffré.**

Portions TripGo sans prix par opérateur : BlaBlaCar Bus (1), FlixBus-eu (3), SNCF (Société Nationale des Chemins de fer Français) (4), SNCF (18), SNCF VOYAGEURS (21).

Exemples de lignes sans tarif (3 par opérateur et par axe) :

- annecy-geneve / BlaBlaCar Bus : Car BlaBlaCar Bus (Annecy - Bus Station → Geneva - Bus Station)
- annecy-geneve / FlixBus-eu : Car FlixBus 1726 (Annecy (Central Bus Station) → Geneva (central bus station)) ; Car FlixBus 1749 (Annecy (Central Bus Station) → Geneva (central bus station)) ; Car FlixBus N706 (Annecy (Central Bus Station) → Geneva (central bus station))
- annecy-geneve / SNCF : Train TER L2 (Annecy → Genève) ; Train L2 (Annecy → Genève-Eaux-Vives) ; Train K21 (Annecy → Aix-les-Bains le Revard)
- annecy-geneve / SBB : Train R L4 (Annemasse → Genève)
- annecy-geneve / Cars Région Haute-Savoie : Bus 272 (Gare Routiere → Aéroport) ; Bus 274 (Aéroport → Poste) ; Bus 274 (Aéroport → Mont-Blanc)
- annemasse-stjulien / SNCF (Société Nationale des Chemins de fer Français) : Train TER (Annemasse → Saint-Julien-en-Genevois)
- annemasse-stjulien / SNCF : Train L1 (Annemasse → Machilly) ; Train L1 (Machilly → Lancy-Bachet) ; Train L4 (Annemasse → Lancy-Bachet)
- annemasse-stjulien / SBB : Train RE 33 (Annemasse → Lancy-Bachet) ; Train R L4 (Annemasse → Lancy-Bachet) ; Train R L1 (Annemasse → Lancy-Bachet)
- annemasse-stjulien / TPG : Bus B 80 (Lancy-Bachet, gare → Saint-Julien, centre) ; Bus B 80 (Saint-Julien, gare → Saint-Julien, centre)
- amberieu-lyon / SNCF : Train K23 (Ambérieu-en-Bugey → Lyon Part Dieu) ; Train C18 (Ambérieu-en-Bugey → Lyon Part Dieu) ; Train K1+ (Ambérieu-en-Bugey → Lyon Part Dieu)
- amberieu-lyon / SNCF VOYAGEURS : Train C18 (Ambérieu-en-Bugey → Lyon Part Dieu) ; Train K23 (Ambérieu-en-Bugey → Lyon Part Dieu) ; Train K13 (Ambérieu-en-Bugey → Lyon Part Dieu)
- chambery-aix / SNCF : Train C21 (Chambéry - Challes-les-Eaux → Aix-les-Bains le Revard) ; Train P41 (Chambéry - Challes-les-Eaux → Moûtiers-Salins-Brides-les-B.) ; Train P41 (Moûtiers-Salins-Brides-les-B. → Aix-les-Bains le Revard)
- chambery-aix / SNCF VOYAGEURS : Train K11 (Chambéry - Challes-les-Eaux → Aix-les-Bains le Revard)
- chambery-aix / Ondéa Aix-les-Bains : Bus 419 (Jeu de Paume → Gare 3 Wilson) ; Bus 419 (Jeu de Paume → Boulevard Wilson) ; Bus 419 (Jeu de Paume → Alliu)
- grenoble-crolles / SNCF : Train C6 (Grenoble → Échirolles) ; Train C1 (Échirolles → Lancey) ; Train C31 (Grenoble → Lancey)
- rumilly-annecy / SNCF : Train K21 (Rumilly → Annecy) ; Train C21 (Rumilly → Annecy) ; Train C21 (Rumilly → Albens)
- rumilly-annecy / SNCF VOYAGEURS : Train K23 (Rumilly → Annecy)
- thonon-geneve / SNCF : Train L1 (Thonon-les-Bains → Genève-Eaux-Vives) ; Train TER C33 (Thonon-les-Bains → Annemasse) ; Train TER L1 (Thonon-les-Bains → Genève)
- thonon-geneve / But : Bus B 002278 (Thonon-les-Bains, Georges And. → Thonon-les-Bains, Les Arts) ; Bus B 002279 (Thonon-les-Bains, Georges And. → Thonon-les-Bains, Les Arts) ; Bus B 002283 (Thonon-les-Bains, Georges And. → Thonon-les-Bains, Les Arts)
- thonon-geneve / AFO : Bus B 271 (Thonon-les-Bains, Les Arts → Genève, Place des Eaux-Vives)
- thonon-geneve / SBB : Train R L3 (Annemasse → Genève)
- thonon-geneve / TPG : Tram T 17 (Genève, Rive → Genève, Bel-Air) ; Bus B 3 (Genève, Bel-Air → Genève, gare Cornavin)
- voiron-grenoble / SNCF : Train K6 (Voiron → Grenoble) ; Train K6 (Voiron → La Tour-du-Pin) ; Train K6 (La Tour-du-Pin → Grenoble)
- voiron-grenoble / SNCF VOYAGEURS : Train C6 (Voiron → Grenoble) ; Train K6 (Voiron → Grenoble)
- voiron-grenoble / Cars Région Isère : Bus T41 (Gare Routière Nord → Gare Routière) ; Bus T40 (Gare Routière → Gare Routière) ; Bus T55 (Gare Routière Sud → Gare Routière)
- aix-technolac / SNCF : Train P3 (Aix-les-Bains le Revard → Viviers-du-Lac) ; Train C21 (Aix-les-Bains le Revard → Chambéry - Challes-les-Eaux) ; Train K11 (Aix-les-Bains le Revard → Chambéry - Challes-les-Eaux)
- aix-technolac / SNCF VOYAGEURS : Train P3 (Aix-les-Bains le Revard → Viviers-du-Lac)
- thonon-bons / SNCF : Train C33 (Thonon-les-Bains → Bons-en-Chablais) ; Train L1 (Thonon-les-Bains → Évian-les-Bains) ; Train L1 (Évian-les-Bains → Bons-en-Chablais)
- thonon-bons / But : Bus B 142 (Thonon-les-Bains, Les Arts → Bons-en-Chablais, Mairie) ; Bus B 142 (Bons-en-Chablais, Gare Didier → Bons-en-Chablais, Mairie)
- thonon-bons / Evian : Bus B 01 (Thonon-les-Bains, Les Arts → Évian-les-Bains, Anna Noailles)
- thonon-bons / Star't Thonon : Bus 142 (Les Arts → Collège F.Mugnier) ; Bus 142 (Les Arts → Sacré Coeur) ; Bus L (Mairie → Presbytère)
- amberieu-intra / SNCF : Train P13 (Ambérieu-en-Bugey → Ambronay - Priay) ; Train P13 (Ambérieu-en-Bugey → Ambronay-Priay RD 1075) ; Train P13 (Ambronay-Priay RD 1075 → Ambérieu-en-Bugey)
- amberieu-intra / Cars Région Ain : Bus A49 (SNCF → Centre Hospitalier) ; Bus A49 (SNCF → Les Arcades) ; Bus A49 (Les Arcades → Centre Hospitalier)
- chambery-chamoux / Cars Région Savoie : Bus S05 (Gare Routiere → Ecoles)
- chambery-chamoux / SNCF : Train P41 (Chambéry - Challes-les-Eaux → Saint-Pierre-d'Albigny) ; Train P41 (Chambéry - Challes-les-Eaux → Aix-les-Bains le Revard) ; Train P41 (Aix-les-Bains le Revard → Saint-Pierre-d'Albigny)
- chambery-chamoux / SNCF VOYAGEURS : Train P31 (Chambéry - Challes-les-Eaux → Chamousset)
- bourg-amberieu / SNCF : Train K13 (Bourg-en-Bresse → Ambérieu-en-Bugey) ; Train 622E (Bourg-en-Bresse → Genève Cornavin) ; Train K1+ (Genève Cornavin → Ambérieu-en-Bugey)
- bourg-amberieu / SNCF VOYAGEURS : Train P13 (Bourg-en-Bresse Gare Routière → Ambérieu-en-Bugey)
- bourg-amberieu / Cars Région Ain : Bus A19 (SNCF → Carré Amiot (Quai E)) ; Bus A27 (Carré Amiot (Quai E) → SNCF) ; Bus A32 (Berthelot → Carré Amiot (Quai E))
- voiron-voreppe / Mobilités M - SNCF : Train C6 (Voiron, Voiron → Voreppe, Voreppe)
- voiron-voreppe / SNCF VOYAGEURS : Train C6 (Voiron → Voreppe)
- voiron-voreppe / SNCF : Train C31 (Voiron → Réaumont - Saint-Cassien) ; Train C6 (Réaumont - Saint-Cassien → Voreppe) ; Train C6 (Voiron → Voreppe)
- voiron-voreppe / Cars Région Isère : Bus T41 (Gare Routière Nord → Gare Routière) ; Bus T40 (Gare Routière → Place Docteur Thévenet) ; Bus T40 (Gare Routière → La Verronière)

Lignes bloquant les itinéraires partiellement tarifés :

- chambery-aix / Ondéa Aix-les-Bains : 419
- thonon-bons / Star't Thonon : 142, L
- voiron-voreppe / Mobilités M - SNCF : C6

Correspondances bloquant les itinéraires partiellement tarifés : Ondéa Aix-les-Bains (34), Star't Thonon (26), Mobilités M - SNCF (1).

Portions sans prix par opérateur (toutes sources) : SNCF (195), Ondéa Aix-les-Bains (36), Star't Thonon (36), Cars Région Ain (34), Cars Région Haute-Savoie (32), Cars Région Isère (28), SNCF VOYAGEURS (21), But (16), SBB (11), TPG (9), SNCF (Société Nationale des Chemins de fer Français) (4), AFO (4), FlixBus-eu (3), Evian (2), Cars Région Savoie (2), BlaBlaCar Bus (1), Mobilités M - SNCF (1).

| Axe | Trajets | Prix vérifié | Marches calculées | Réalisables | 1er résultat | Total | Sources | Erreurs | Attendus non vus |
|---|---|---|---|---|---|---|---|---|---|
| Annecy → Genève | 34 | 0 | 26 | 26 | 0.4 s | 11.5 s | TripGo, Suisse (transport.opendata.ch), SNCF (GTFS officiel), Cars Région Haute-Savoie (GTFS) | — | — |
| Annemasse → Saint-Julien-en-Genevois | 56 | 41 | 24 | 16 | 0.3 s | 13.5 s | Suisse (transport.opendata.ch), TripGo, SNCF (GTFS officiel), TAC Annemasse (GTFS) | — | — |
| Ambérieu-en-Bugey → Lyon Part-Dieu | 13 | 0 | 11 | 6 | 0.1 s | 3.5 s | SNCF (GTFS officiel), TripGo | — | — |
| Chambéry → Aix-les-Bains | 53 | 6 | 17 | 16 | 0.2 s | 9.0 s | Synchro Bus Chambéry (GTFS), SNCF (GTFS officiel), TripGo, Ondéa Aix-les-Bains (GTFS) | — | — |
| Grenoble → Crolles | 12 | 5 | 12 | 12 | 0.1 s | 6.2 s | Mobilités M, SNCF (GTFS officiel) | — | — |
| Rumilly → Annecy | 9 | 1 | 9 | 8 | 0.2 s | 4.0 s | Sibra (GTFS), SNCF (GTFS officiel), TripGo | — | — |
| Thonon-les-Bains → Genève | 17 | 0 | 15 | 8 | 0.1 s | 8.7 s | SNCF (GTFS officiel), Suisse (transport.opendata.ch) | — | — |
| Voiron → Grenoble | 20 | 0 | 20 | 20 | 0.2 s | 5.4 s | SNCF (GTFS officiel), TripGo, Mobilités M, Cars Région Isère (GTFS) | — | — |
| Aix-les-Bains gare → Technolac (Ondéa 01) | 53 | 40 | 19 | 8 | 0.4 s | 9.2 s | Ondéa Aix-les-Bains (GTFS), SNCF (GTFS officiel), TripGo | — | — |
| Thonon → Bons-en-Chablais (Star’t 142) | 58 | 8 | 24 | 16 | 0.3 s | 14.3 s | Star't Thonon (GTFS), SNCF (GTFS officiel), TripGo, Suisse (transport.opendata.ch) | — | — |
| Rumilly Hôpital → Base de loisirs (J’y bus 1) | 31 | 31 | 7 | 7 | 0.5 s | 1.8 s | J'y bus Rumilly (GTFS) | — | — |
| Ambérieu gare → Cabrol (TAM 2) | 67 | 40 | 16 | 15 | 0.1 s | 10.1 s | TAM Ambérieu-en-Bugey (GTFS), SNCF (GTFS officiel), Cars Région Ain (GTFS) | — | — |
| Chambéry → Chamoux-sur-Gelon (Cars Savoie S05) | 15 | 0 | 13 | 11 | 0.1 s | 4.6 s | Cars Région Savoie (GTFS), SNCF (GTFS officiel), TripGo | — | — |
| Bourg-en-Bresse → Ambérieu (Cars Ain / TER) | 16 | 0 | 0 | 0 | 0.0 s | 2.3 s | SNCF (GTFS officiel), TripGo, Cars Région Ain (GTFS) | — | — |
| Voiron → Voreppe (M réso Voironnais) | 19 | 2 | 4 | 4 | 0.1 s | 1.2 s | Mobilités M, TripGo, SNCF (GTFS officiel), Cars Région Isère (GTFS) | — | — |

Exemples (3 meilleures propositions par axe) :

**Annecy → Genève**
- Meilleur compromis · Plus rapide : 2026-11-16T10:24:12.000Z → 2026-11-16T11:20:50.000Z · marche 57 m › BlaBlaCar Bus BlaBlaCar Bus › marche 389 m · Prix à confirmer · Réalisable

**Annemasse → Saint-Julien-en-Genevois**
- Moins cher · Meilleur compromis : 2026-11-16T07:48:47.707Z → 2026-11-16T08:51:41.077Z · marche 102 m › TAC B 4 › marche 640 m · 1,70 € · Réalisable
- Plus rapide : 2026-11-16T10:11:53.000Z → 2026-11-16T10:32:25.000Z · marche 9 m › SNCF (Société Nationale des Chemins de fer Français) TER › marche 570 m · Prix à confirmer · Réalisable

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
- Moins cher · Meilleur compromis : 2026-11-16T07:01:00.000Z → 2026-11-16T07:50:00.000Z · Star't Thonon 142 · 2,20 € · Réalisable
- Plus rapide : 2026-11-16T07:28:02.877Z → 2026-11-16T07:54:10.713Z · marche 154 m › SNCF C33 › marche 804 m · Prix à confirmer · Réalisable

**Rumilly Hôpital → Base de loisirs (J’y bus 1)**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-16T07:18:00.000Z → 2026-11-16T07:43:00.000Z · J'y bus Rumilly 1 · 1,00 € · Réalisable

**Ambérieu gare → Cabrol (TAM 2)**
- Moins cher · Meilleur compromis · Plus rapide : 2026-11-16T07:00:00.000Z → 2026-11-16T07:17:00.000Z · TAM Ambérieu-en-Bugey TAM 2 · 1,10 € · Réalisable

**Chambéry → Chamoux-sur-Gelon (Cars Savoie S05)**
- Meilleur compromis · Plus rapide : 2026-11-16T11:30:00.000Z → 2026-11-16T12:38:00.000Z · Cars Région Savoie S05 · Prix à confirmer · Réalisable

**Bourg-en-Bresse → Ambérieu (Cars Ain / TER)**
- Meilleur compromis · Plus rapide : 2026-11-16T09:45:00.000Z → 2026-11-16T10:01:00.000Z · SNCF K13 · Prix à confirmer · Transport non confirmé (marche depuis l’adresse exacte de départ non calculée · marche jusqu’à l’adresse exacte d’arrivée non calculée)

**Voiron → Voreppe (M réso Voironnais)**
- Moins cher · Meilleur compromis : 2026-11-16T07:07:40.000Z → 2026-11-16T07:34:07.000Z · marche 389 m › M Réso - Métropole Grenobloise C13 › marche 61 m · 2,00 € · Réalisable
- Plus rapide : 2026-11-16T07:10:26.000Z → 2026-11-16T07:35:43.000Z · marche 358 m › Mobilités M - SNCF C6 › marche 89 m › M Réso - Métropole Grenobloise C13 › marche 40 m · Prix à confirmer · Réalisable

