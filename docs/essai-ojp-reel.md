# Test réel OJP 1.0 / OJP Fare — départs de Genève

Exécuté le 2026-11-15T13:55:33.700Z (GitHub Actions, API réelles opentransportdata.swiss).
Prix OJP Fare : **indicatifs** (système d’intégration, non contractuels, non réservables par cette API).

- Secret `OJP_1_API_KEY` (OJP 1.0, itinéraires) : **absent**
- Secret `OJP_FARE_API_KEY` (OJP Fare, prix) : présent

Lieux « Genève » : Genève [StopPlaceRef ch:1:sloid:1008] ; Genève CGN [StopPlaceRef ch:1:sloid:1237] ; Genève, Gos [StopPlaceRef ch:1:sloid:92776] ; Genève, Dôle [StopPlaceRef ch:1:sloid:92818]

## Genève → Lausanne

Lieux « Lausanne » : Lausanne [StopPlaceRef ch:1:sloid:1120] ; Lausanne-Flon [StopPlaceRef ch:1:sloid:1181] ; Lausanne, CHUV [StopPlaceRef ch:1:sloid:92017] ; Lausanne, Cour [StopPlaceRef ch:1:sloid:92024]
Références utilisées : StopPlaceRef ch:1:sloid:1008 → StopPlaceRef ch:1:sloid:1120. Trajets reçus : 3.

- **07:54 → 08:37** (PT43M, 0 correspondance(s))
  - IR15 (rail, opérateur ojp:11) : Genève 07:54 [ch:1:sloid:1008:3:4] → Lausanne 08:37 [ch:1:sloid:1120:0:668579]
  - Offres plein tarif reçues : 20.2 CHF « Sparbillett » second [portions 1–1] ; 40.6 CHF « Streckenbillett » first [portions 1–1]
  - Offres demi-tarif reçues : aucune
  - Plein tarif 2e classe retenu : **Prix à consulter** — aucun billet ordinaire plein tarif 2e classe ne couvre le trajet complet
  - Demi-tarif 2e classe retenu : **Prix à consulter** — erreur API — OJP HTTP 500 : Internal Server Error
- **08:05 → 08:44** (PT39M, 0 correspondance(s))
  - IR90 (rail, opérateur ojp:11) : Genève 08:05 [ch:1:sloid:1008:3:4] → Lausanne 08:44 [ch:1:sloid:1120:0:276884]
  - Offres plein tarif reçues : 23.8 CHF « Streckenbillett » second [portions 1–1] ; 40.6 CHF « Streckenbillett » first [portions 1–1]
  - Offres demi-tarif reçues : aucune
  - Plein tarif 2e classe retenu : 23.80 CHF (« Streckenbillett », portions 1 à 1 = trajet complet, indicatif)
  - Demi-tarif 2e classe retenu : **Prix à consulter** — erreur API — OJP HTTP 500 : Internal Server Error
- **08:08 → 08:59** (PT51M, 0 correspondance(s))
  - RE33 (rail, opérateur ojp:11) : Genève 08:08 [ch:1:sloid:1008:2:2] → Lausanne 08:59 [ch:1:sloid:1120:0:860143]
  - Offres plein tarif reçues : 23.8 CHF « Streckenbillett » second [portions 1–1] ; 40.6 CHF « Streckenbillett » first [portions 1–1]
  - Offres demi-tarif reçues : aucune
  - Plein tarif 2e classe retenu : 23.80 CHF (« Streckenbillett », portions 1 à 1 = trajet complet, indicatif)
  - Demi-tarif 2e classe retenu : **Prix à consulter** — erreur API — OJP HTTP 500 : Internal Server Error

## Genève → Nyon

Lieux « Nyon » : Nyon [StopPlaceRef ch:1:sloid:1030] ; Nyon (lac) [StopPlaceRef ch:1:sloid:1227] ; Nyon, gare [StopPlaceRef ch:1:sloid:70000] ; Nyon, plage [StopPlaceRef ch:1:sloid:88656]
Références utilisées : StopPlaceRef ch:1:sloid:1008 → StopPlaceRef ch:1:sloid:1030. Trajets reçus : 3.

- **07:54 → 08:07** (PT13M, 0 correspondance(s))
  - IR15 (rail, opérateur ojp:11) : Genève 07:54 [ch:1:sloid:1008:3:4] → Nyon 08:07 [ch:1:sloid:1030:2:2]
  - Offres plein tarif reçues : 7 CHF « Sparbillett » second [portions 1–1] ; 16 CHF « Streckenbillett » first [portions 1–1]
  - Offres demi-tarif reçues : aucune
  - Plein tarif 2e classe retenu : **Prix à consulter** — aucun billet ordinaire plein tarif 2e classe ne couvre le trajet complet
  - Demi-tarif 2e classe retenu : **Prix à consulter** — erreur API — OJP HTTP 500 : Internal Server Error
- **08:08 → 08:24** (PT16M, 0 correspondance(s))
  - RE33 (rail, opérateur ojp:11) : Genève 08:08 [ch:1:sloid:1008:2:2] → Nyon 08:24 [ch:1:sloid:1030:2:2]
  - Offres plein tarif reçues : 9.4 CHF « Streckenbillett » second [portions 1–1] ; 9.8 CHF « Sparbillett » first [portions 1–1]
  - Offres demi-tarif reçues : aucune
  - Plein tarif 2e classe retenu : 9.40 CHF (« Streckenbillett », portions 1 à 1 = trajet complet, indicatif)
  - Demi-tarif 2e classe retenu : **Prix à consulter** — erreur API — OJP HTTP 500 : Internal Server Error
- **08:24 → 08:38** (PT14M, 0 correspondance(s))
  - IR95 (rail, opérateur ojp:11) : Genève 08:24 [ch:1:sloid:1008:3:4] → Nyon 08:38 [ch:1:sloid:1030:2:2]
  - Offres plein tarif reçues : 16 CHF « Streckenbillett » first [portions 1–1] ; 6.2 CHF « Sparbillett » second [portions 1–1]
  - Offres demi-tarif reçues : aucune
  - Plein tarif 2e classe retenu : **Prix à consulter** — aucun billet ordinaire plein tarif 2e classe ne couvre le trajet complet
  - Demi-tarif 2e classe retenu : **Prix à consulter** — erreur API — OJP HTTP 500 : Internal Server Error

## Genève → Annemasse

Lieux « Annemasse » : Annemasse [StopPlaceRef 8774549] ; Annemasse, gare [StopPlaceRef ch:1:sloid:1401854] ; Annemasse, Léman [StopPlaceRef ch:1:sloid:1401681] ; Annemasse, Drague [StopPlaceRef ch:1:sloid:1401673]
Références utilisées : StopPlaceRef ch:1:sloid:1008 → StopPlaceRef 8774549. Trajets reçus : 3.

- **07:53 → 08:18** (PT25M, 0 correspondance(s))
  - RE33 (rail, opérateur ojp:11) : Genève 07:53 [ch:1:sloid:1008:2:2] → Annemasse 08:18 [8774549]
  - Offres plein tarif reçues : 8.3 CHF « Léman Pass Einzelbillett Multizonen » first [portions 1–1] ; 4.6 CHF « Léman Pass Einzelbillett Multizonen » second [portions 1–1]
  - Offres demi-tarif reçues : aucune
  - Plein tarif 2e classe retenu : 4.60 CHF (« Léman Pass Einzelbillett Multizonen », portions 1 à 1 = trajet complet, indicatif)
  - Demi-tarif 2e classe retenu : **Prix à consulter** — erreur API — OJP HTTP 500 : Internal Server Error
- **08:01 → 08:25** (PT24M, 0 correspondance(s))
  - RL4 (rail, opérateur ojp:11) : Genève 08:01 [ch:1:sloid:1008:2:2] → Annemasse 08:25 [8774549]
  - Offres plein tarif reçues : 4.6 CHF « Léman Pass Einzelbillett Multizonen » second [portions 1–1] ; 8.3 CHF « Léman Pass Einzelbillett Multizonen » first [portions 1–1]
  - Offres demi-tarif reçues : aucune
  - Plein tarif 2e classe retenu : 4.60 CHF (« Léman Pass Einzelbillett Multizonen », portions 1 à 1 = trajet complet, indicatif)
  - Demi-tarif 2e classe retenu : **Prix à consulter** — erreur API — OJP HTTP 500 : Internal Server Error
- **08:16 → 08:40** (PT24M, 0 correspondance(s))
  - RL4 (rail, opérateur ojp:11) : Genève 08:16 [ch:1:sloid:1008:2:2] → Annemasse 08:40 [8774549]
  - Offres plein tarif reçues : 4.6 CHF « Léman Pass Einzelbillett Multizonen » second [portions 1–1] ; 8.3 CHF « Léman Pass Einzelbillett Multizonen » first [portions 1–1]
  - Offres demi-tarif reçues : aucune
  - Plein tarif 2e classe retenu : 4.60 CHF (« Léman Pass Einzelbillett Multizonen », portions 1 à 1 = trajet complet, indicatif)
  - Demi-tarif 2e classe retenu : **Prix à consulter** — erreur API — OJP HTTP 500 : Internal Server Error

## Genève → Saint-Julien-en-Genevois

Lieux « Saint-Julien-en-Genevois » : Saint-Julien-en-Genevois [StopPlaceRef 8774543] ; Saint-Julien-en-Genevois - SNCF Station [StopPlaceRef bla:SJG]
Références utilisées : StopPlaceRef ch:1:sloid:1008 → StopPlaceRef 8774543. Trajets reçus : 3.

- **07:53 → 08:35** (PT42M, 1 correspondance(s))
  - RE33 (rail, opérateur ojp:11) : Genève 07:53 [ch:1:sloid:1008:2:2] → Lancy-Bachet 08:02 [ch:1:sloid:17142:1:1]
  - 80 (bus, opérateur ojp:881) : Lancy-Bachet, gare 08:13 [ch:1:sloid:87075:0:439820] → Saint-Julien, gare 08:33 [ch:1:sloid:1401852:0:232037]
  - Passage entre opérateurs : ojp:11 → ojp:881
  - Offres plein tarif reçues : 7.7 CHF « Léman Pass Einzelbillett Multizonen » first [portions 1–3] ; 4.6 CHF « Léman Pass Einzelbillett Multizonen » second [portions 1–3]
  - Offres demi-tarif reçues : aucune
  - Plein tarif 2e classe retenu : 4.60 CHF (« Léman Pass Einzelbillett Multizonen », portions 1 à 3 = trajet complet, indicatif)
  - Demi-tarif 2e classe retenu : **Prix à consulter** — erreur API — OJP HTTP 500 : Internal Server Error
- **08:01 → 08:42** (PT41M, 1 correspondance(s))
  - RL4 (rail, opérateur ojp:11) : Genève 08:01 [ch:1:sloid:1008:2:2] → Lancy-Bachet 08:10 [ch:1:sloid:17142:1:1]
  - 80 (bus, opérateur ojp:881) : Lancy-Bachet, gare 08:20 [ch:1:sloid:87075:0:439820] → Saint-Julien, gare 08:40 [ch:1:sloid:1401852:0:232037]
  - Passage entre opérateurs : ojp:11 → ojp:881
  - Offres plein tarif reçues : 7.7 CHF « Léman Pass Einzelbillett Multizonen » first [portions 1–3] ; 4.6 CHF « Léman Pass Einzelbillett Multizonen » second [portions 1–3]
  - Offres demi-tarif reçues : aucune
  - Plein tarif 2e classe retenu : 4.60 CHF (« Léman Pass Einzelbillett Multizonen », portions 1 à 3 = trajet complet, indicatif)
  - Demi-tarif 2e classe retenu : **Prix à consulter** — erreur API — OJP HTTP 500 : Internal Server Error
- **08:16 → 08:56** (PT40M, 1 correspondance(s))
  - RL4 (rail, opérateur ojp:11) : Genève 08:16 [ch:1:sloid:1008:2:2] → Lancy-Bachet 08:25 [ch:1:sloid:17142:1:1]
  - 80 (bus, opérateur ojp:881) : Lancy-Bachet, gare 08:34 [ch:1:sloid:87075:0:439820] → Saint-Julien, gare 08:54 [ch:1:sloid:1401852:0:232037]
  - Passage entre opérateurs : ojp:11 → ojp:881
  - Offres plein tarif reçues : 4.6 CHF « Léman Pass Einzelbillett Multizonen » second [portions 1–3] ; 7.7 CHF « Léman Pass Einzelbillett Multizonen » first [portions 1–3]
  - Offres demi-tarif reçues : aucune
  - Plein tarif 2e classe retenu : 4.60 CHF (« Léman Pass Einzelbillett Multizonen », portions 1 à 3 = trajet complet, indicatif)
  - Demi-tarif 2e classe retenu : **Prix à consulter** — erreur API — OJP HTTP 500 : Internal Server Error

## Accès

Accès ayant répondu : adresse OJP Fare + jeton OJP Fare.
