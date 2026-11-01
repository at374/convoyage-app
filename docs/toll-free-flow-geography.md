# Historical free-flow geography: candidate diagnostics

The downloaded Windows-1252 CSV published by Maxime Lopes contains 37 point records across A79, A13, A154, A131, A14, A29, A4, A10 and A387. Seven A79 records comprise the six free-flow gantry positions plus the traditional Deux-Chaises barrier. The nine historical A79 endpoint labels are therefore not nine physical gantries.

Source: https://www.data.gouv.fr/datasets/autoroutes-et-peages-en-flux-libre

Exact resource: https://static.data.gouv.fr/resources/autoroutes-et-peages-en-flux-libre/20251025-160412/portiques-free-flow-25-10-2025.csv

The original downloaded CSV is retained as `data/tolls/reviewed/free-flow-gantries-2025.csv`. The JSON snapshot records its raw SHA-256, publication date (25 October 2025), retrieval date (1 November 2026), publisher, reuse conditions and indicative status. This is third-party compiled geography, not a government/operator survey or a guarantee of 2026 currency. A centered bidirectional point is not two surveyed lane positions; missing direction or PK stays null. No prices, vehicle categories, lane access or current traffic are supplied by this source. Overpass corroboration was attempted but rejected HTTP 406; no independent current OSM check is claimed.

`node scripts/import-free-flow-gantries.cjs` regenerates the reviewed JSON offline. `--write` additionally attaches only `portiques_source` and `portiques_candidats` to the overlay; no ticket identities, legacy pairs, prices or fixed-barrier definitions are changed. The parser rejects unexpected headers, malformed coordinates, unsupported directions/types and points outside the reviewed metropolitan extent. Attribute Maxime Lopes; the published terms permit bundled application reuse and exclude charging for a standalone gantry-alert option. No purchase or paid option is introduced.

## Existing toll renderer

When a provider road trace has toll sections and the existing calculator cannot quote a complete price, the renderer can now name nearby candidates in its existing card. It displays the historical source date and publisher, describes the records as indicative, says that proximity establishes neither passage nor price, and reminds the user that an actual payable passage must be paid. This is diagnostic context, not an exact toll quote or an A79 automatic route integration.

The local proximity policy is 60 m to a sampled vertex or a polyline segment no longer than 1 km, inside the provider toll window. It is not an operator access guarantee. Long straight gaps are not interpolated into evidence. The renderer disables this diagnostic for interpolated Google fallback geometry. Bounding checks skip distant points before trigonometric calculations. No additional network request is made: the 37 records arrive with the overlay already used by the calculator. Candidate names are HTML-escaped.

Known complete prices, vehicle-class sums and Swiss vignette accounting are unchanged. Candidate proximity does not silently make an itinerary free or produce a partial total. The candidate records are intentionally not added to `P.g`, the fixed-barrier engine, or the A79 passage-price module. They do not reduce the 280 unresolved endpoint-label count. The remaining steps are a current lane/access corroboration, explicit interchange topology, selection of Ouest/Est/Transit and verified native vehicle context before automatic charging.

Tests cover raw-source reproducibility, seven A79 records, missing direction, malformed input, idempotent imports, actual segment proximity in both trace orders, distant paths, long gaps, restricted windows, invalid points and unsupported source status. Synthetic A79 renderer cases run with actual Blob worker and direct fallback in mobile Chromium; they verify the explanation and absence of a quoted/free total, not a real mission or physical road access. Android physical validation and deployment are separate.
