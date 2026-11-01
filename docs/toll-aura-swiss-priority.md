# Priority: missing AURA and Swiss charges

The working order is Auvergne-Rhone-Alpes and Switzerland first, then broader France. `scripts/audit-aura-toll-coverage.cjs` separates known fixed gates from name/position mismatches and unresolved identities in the checked-in ministry data. Its 106 groups are records grouped by name/road, not a certified count of physical tolls. The source dates to 2025 and does not prove 2026 completeness. No total number of missing tariffs is inferred.

The current report contains 66 name/position matches, 19 nearby identities to check, 4 named positions to check, 16 fixed-gate groups with class-1/2 prices, and one unresolved identity, St Michel amont. Cluses and Scionzier were already present as fixed barriers; they must not be counted as missing fares merely because their names are absent from the ticket-station list. Known positions still require route-wide price and access checks.

Tarare Est open-system entry/exit points were missing from fixed-barrier detection. Their published ASF row is distinct from TARARE EST F (closed system). The two ministry points on route 69A908910CD are now linked as one fixed crossing group. The current official ASF feed gives classes 1/2/3/4/5 at 1.80/2.80/5.10/6.80/1.00 EUR; exact row, source hash and ministry names are retained in `barrieres_preuves`. No closed-system station is renamed, no old price is overwritten, and no route distance is invented. New versions are restricted to the reviewed 2026 period. Synthetic gate tests establish component behavior, not physical road access or a complete real mission.

Swiss vignette accounting follows the user's existing toll inputs. **Do not add the vignette a second time, and do not add a Swiss motorway price per kilometre.** `toll-swiss-prices.cjs` exposes the 40 CHF reference and edition validity with a zero additional budget contribution. It does not write mission or budget data, buy a vignette or verify vehicle entitlement. The route renderer explains that the vignette is already accounted for, instead of suggesting another 40 CHF purchase. Paid tunnels remain separate charges to verify.

`data/tolls/reviewed/aura-swiss-prices-2026-11-01.json` archives the official 2026 vignette reference, Grand-Saint-Bernard categories/products and native CHF/EUR charges, and Munt La Schera's published seasonal/payment products. Grand-Saint-Bernard lookup requires the operator's native category, side of departure and product. An A2 one-way purchase is 32 CHF from the Swiss side or 33.50 EUR from the Italian side; this is not currency conversion. French vehicle classes are not automatically mapped. Round-trip and multipassage purchase prices are not divided into an inferred per-leg cost. The lookup does not certify access or rights to an existing pass.

Munt La Schera's page has seasonal, Saturday, payment-channel and vehicle distinctions, but no explicit effective date was extracted. These prices are archived as published observations and are not automatically applied. Its local/tourist prepaid products remain eligibility-dependent.

Sources:
- ASF public feed: https://public-content.vinci-autoroutes.com/PDF/Tarifs-peage-asf/Tarifs_ASF.txt
- Ministry station coordinates: https://www.data.gouv.fr/datasets/gares-de-peage-du-reseau-routier-national-concede
- Swiss customs: https://www.bazg.admin.ch/fr/faq-vignette-et-achat-d-e-vignette
- Grand-Saint-Bernard operator: https://letunnel.com/fr/
- Munt La Schera operator: https://www.tunnelticket.ch/en/page/prices

Further work: establish all remaining AURA identity/position bindings, distinguish the Saint-Michel A43 barrier and interchange, validate live/public road traces, connect verified Swiss tunnel crossings, and then widen the geographical audit. Do not equate this worklist or source discovery with 100% coverage.
