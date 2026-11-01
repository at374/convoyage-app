# Missing toll coverage: findings, not a national denominator

The current runtime gap audit is reproducible with `node scripts/audit-toll-runtime-gaps.cjs`. It compares all 20,412 stored overlay pair rows with the same strict endpoint resolution as the actual route calculator. There are 280 endpoint labels without a usable name binding, affecting 4,789 stored pair rows. The other 15,623 rows have name bindings, but are not thereby certified as complete, current or feasible routes. These counts are tariff labels and stored rows, not physical tolls, unique journeys or missing price amounts. Alternate names and tariff boundaries can represent the same physical facility.

The report retains source-file SHA-256 hashes and a full named worklist. The two fixed-barrier class-1/2 gaps reported for ARCOS are context-dependent prices, not proof that the operator has no tariff: the separate scheduled lookup already exists. No missing price is replaced with zero.

## AURA and border priorities

| Area | Observed gap | Evidence / next requirement |
| --- | --- | --- |
| A79 Le Montet, Montbeugny, Molinet | Nine endpoint labels used by 21 stored price rows have no runtime station identity/coordinates. The checked-in ministry coordinates have no A79 road records. | ALIAE confirms free-flow tolling; Annex XII gives ten named branch products and distinguishes VL categories e/ne and heavy-vehicle Euro groups. Existing generic pairs must not stand in for this conditional branch model. Exact gantry/access identities and category definitions still require review. |
| A41N Copponex / Cruseilles | Official source amounts are present, but both open-system source rows remain without fixed-barrier bindings. Copponex is also an unresolved stored pair endpoint. | Operator/network and commune sources identify Copponex as a half-interchange toward Geneva. A location match must preserve direction; no fabricated reverse access. The A410 Cruseilles identity is separate. |
| A43 Chignin Bretelle | Source price is known but no fixed-barrier binding; old station geometry includes a point close to Chignin Barriere. | Separate exact lane identities before charging it as a fixed passage or adding it to a closed-system sum. |
| A71 Gerzat-Ville / A6 Villefranche-Ville | Source prices are known, but the open-system rows have no reviewed fixed-barrier binding. | Distinguish interchange/open-system passages from nearby mainline closed-system barriers. |
| A43 Saint-Michel amont | Separate ministry identity is unresolved; BAR/ECH correction does not resolve it. | No inheritance of temporary historical free travel or automatic mapping to Modane. |
| Grand-Saint-Bernard | Native-category/source-side/product prices are archived and queryable; automatic trace linkage is absent. | Verify precise crossing, native category and purchase product. No CHF/EUR conversion or extra vignette. |
| Munt La Schera | Operator prices are published, but the tariff page supplies no verified edition/effective date. | Preserve season, weekday, channel and vehicle distinctions; no invented effective date. |

Outside the priority region, Dordives is the sixth APRR/AREA open-source row lacking a fixed-barrier binding. The audit also exposes numerous unresolved SANEF/SAPN labelled endpoints (for example Boulogne and Calais/Setques), despite stored pair prices. National completeness cannot be inferred from having a price table. Prado Sud still lacks a confirmed current numeric primary-source price in the reviewed register; a secondary price is not promoted to an official operational tariff.

Sources checked on 1 November 2026:
- ALIAE operator: https://www.aliae.com/en (six physical free-flow gates described; not nine gates merely because nine stored labels are unbound).
- A79 Annex XII: https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000053417638
- ALIAE 2026 OD publication located: https://www.aliae.com/files/live/sites/aliae/files/Documents/TARIFS_ALIAE-2026.pdf (not claimed fully downloaded/reconciled).
- ADELAC network: https://www.a41-adelac.com/le-reseau
- Copponex commune directional access: https://www.copponex.fr/la-vie-%C3%A0-copponex/autoroute/
- ADELAC 2025 SET declaration: https://www.autorite-transports.fr/wp-content/uploads/2025/08/declaration-secteur-set_adelac_20250506.pdf (historical sector evidence, not a 2026 access certificate).
- APRR/AREA 2026 open systems: `data/tolls/reviewed/aprr-area-open-2026.json` retains the exact source URL and review limits.
- Munt La Schera: https://www.tunnelticket.ch/en/page/prices
- Prado Sud operator: https://www.tunnelsprado.com/nos-ouvrages/tunnel-prado-sud (no readable numerical price recovered).

The Swiss motorway vignette remains in existing user toll inputs. No additional motorway or vignette charge is introduced. This investigation changes no operational prices, mission data, auth, synchronization, deployment or paid service.
