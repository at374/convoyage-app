# Essai réel OJP 1.0 / OJP Fare — Genève → Lausanne

Exécuté le 2026-11-15T13:49:07.660Z (GitHub Actions).

- Jeton OJP 1.0 (`OJP_API_KEY`) : **absent**
- Jeton OJP Fare (`OJP_FARE_API_KEY`) : présent

- Lieux « Genève » : échec par « OJP 1.0 + jeton OJP Fare » — OJP HTTP 403 : { "error": "Access to this API has been disallowed" }
- Lieux « Genève » : réponse par « OJP Fare + jeton OJP Fare »
## Lieux pour « Genève »

| Nom | Type de référence (réponse) | Référence | Utilisable |
|---|---|---|---|
| Genève | StopPlaceRef | ch:1:sloid:1008 | oui |
| Genève CGN | StopPlaceRef | ch:1:sloid:1237 | oui |
| Genève, Gos | StopPlaceRef | ch:1:sloid:92776 | oui |
| Genève, Dôle | StopPlaceRef | ch:1:sloid:92818 | oui |
| Genève, Guye | StopPlaceRef | ch:1:sloid:92835 | oui |
| Genève, Lyon | StopPlaceRef | ch:1:sloid:92850 | oui |
| Genève, Môle | StopPlaceRef | ch:1:sloid:92863 | oui |
| Genève, Rieu | StopPlaceRef | ch:1:sloid:92894 | oui |
| Genève, Rive | StopPlaceRef | ch:1:sloid:87061 | oui |

- Lieux « Lausanne » : échec par « OJP 1.0 + jeton OJP Fare » — fetch failed
- Lieux « Lausanne » : réponse par « OJP Fare + jeton OJP Fare »
## Lieux pour « Lausanne »

| Nom | Type de référence (réponse) | Référence | Utilisable |
|---|---|---|---|
| Lausanne | StopPlaceRef | ch:1:sloid:1120 | oui |
| Lausanne-Flon | StopPlaceRef | ch:1:sloid:1181 | oui |
| Lausanne, CHUV | StopPlaceRef | ch:1:sloid:92017 | oui |
| Lausanne, Cour | StopPlaceRef | ch:1:sloid:92024 | oui |
| Lausanne, Flon | StopPlaceRef | ch:1:sloid:91818 | oui |
| Lausanne, gare | StopPlaceRef | ch:1:sloid:92050 | oui |
| Lausanne, Grey | StopPlaceRef | ch:1:sloid:92057 | oui |
| Lausanne, Ours | StopPlaceRef | ch:1:sloid:79237 | oui |

- Trajets : échec par « OJP 1.0 + jeton OJP Fare » — OJP HTTP 403 : { "error": "Access to this API has been disallowed" }
- Trajets : réponse par « OJP Fare + jeton OJP Fare »
## Trajets (StopPlaceRef ch:1:sloid:1008 → StopPlaceRef ch:1:sloid:1120, départ après 2026-11-16T07:00:00.000Z)

Trajets reçus : 3

- 2026-11-16T06:54:00Z → 2026-11-16T07:37:00Z (PT43M, 0 correspondance(s)) : IR15 Genève 2026-11-16T06:54:00Z → Lausanne 2026-11-16T07:37:00Z
  - Prix : erreur API — OJP HTTP 500 : Internal Server Error
- 2026-11-16T07:05:00Z → 2026-11-16T07:44:00Z (PT39M, 0 correspondance(s)) : IR90 Genève 2026-11-16T07:05:00Z → Lausanne 2026-11-16T07:44:00Z
  - Prix : erreur API — OJP HTTP 500 : Internal Server Error
- 2026-11-16T07:08:00Z → 2026-11-16T07:59:00Z (PT51M, 0 correspondance(s)) : RE33 Genève 2026-11-16T07:08:00Z → Lausanne 2026-11-16T07:59:00Z
  - Prix : erreur API — OJP HTTP 500 : Internal Server Error
