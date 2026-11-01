# Official toll source collector

Run `node scripts/refresh-toll-sources.cjs` to download the five public VINCI price feeds listed in `data/tolls/sources-2026.json`.

The collector downloads in parallel, bounds each download to 20 seconds and 4 MiB, rejects redirects and non-success HTTP responses, decodes the published character set, validates CSV headers/row widths/prices and writes each snapshot atomically. Snapshots retain source URL, effective date, review year, retrieval day, SHA-256 of downloaded bytes, all published vehicle classes and tariff conditions. A failed refresh preserves the last valid snapshot but marks the attempt stale/unavailable in the manifest and exits unsuccessfully.

The GitHub workflow runs on collector changes and manual dispatch, with seven-day artifacts and read-only repository permissions. It does not push refreshed prices, change the app's operational catalogue, deploy or activate a paid service. Recurring production refresh remains to wire after review.

`toll-official-catalogue.cjs` exposes a source-price lookup for ASF, ESCOTA and Cofiroute/Arcour. Both endpoints must include the motorway and station name; the published direction is respected. Exit identifiers, when supplied, must be published in that source. Missing or contradictory amounts cannot be quoted. Zero is retained as a valid published price. Source data older than seven days, future retrieval timestamps, dates before the source version and dates outside the reviewed year are rejected. This seven-day limit is a local freshness policy, not an operator guarantee.

ARCOS and Duplex A86 schedules are collected intact, including time, day, badge and Euro-group fields. They cannot be quoted as an unconditional fixed price. Calendar-aware lookup remains to implement. No route, access or availability is verified merely by finding a published price.

The source page is https://www.vinci-autoroutes.com/fr/conseils/autoroute-mode-demploi/tarifs-peage-vinci-autoroutes/ . The current reviewed effective dates are ASF 1 June 2026, ESCOTA/Cofiroute/ARCOS 1 February 2026, Duplex A86 1 January 2026. HTTP success and a new hash establish retrieval, not a new effective date; a future annual edition still needs source-date review. National missing-tariff counts remain `null`: five feeds do not establish an exhaustive France/border inventory.

## Connection to the existing route calculator

Run `node scripts/build-toll-route-prices.cjs` after refreshing the sources. The checked-in index currently contains 3,082 directed rows and 237 station bindings. A binding requires an unambiguous normalized station name, the published motorway, and every existing catalogue coordinate within 60 m of a ministry point for that station and motorway. Cross-motorway ambiguities are excluded. Runtime attachment also requires the exact same catalogue coordinates. No coordinates, road distances or reverse tariffs are generated.

Both the actual Blob worker and direct route calculator load `data/tolls/route-prices.json` once with the rest of their catalogue. This optional request is cancelled after four seconds. On download failure the existing catalogue remains available. After a record is attached, an expired, contradictory or unavailable price blocks use of that directed record; it does not silently revert to an old price. The seven-day freshness check runs at each calculation, including offline use.

A fresh directed source price can replace the amount used for an already recognized section, while retaining its independent distance check. The stored historical amount is unchanged. Existing legacy contradictions are still blocked and a source price alone cannot supply a missing distance or certify an incomplete route. This does not mean that all 3,082 rows produce a complete road itinerary.

The renderer shows the contributing source identifier, effective date and retrieval day in its existing source text. The vehicle route button now copies its existing departure/pickup timestamp into an ISO `dateTarif`, converted to the Europe/Paris calendar day, without mutating the shared route response. This date reaches ticket pricing, fixed-barrier pricing and the paid sections of mixed-route searches. A malformed provided date refuses a price instead of substituting today's date. A route without a supplied departure uses the current French day. This does not validate mission identity, circulation or actual access. Scheduled production refresh and the hourly pricing of ARCOS/A86 remain unfinished.

Validation uses synthetic forward/reverse/different-year cases as well as the existing recorded public traces. Synthetic prices are labelled as such and are not published as real fares. No physical Android or real mission validation is implied.
