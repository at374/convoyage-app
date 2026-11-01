# Official toll source collector

Run `node scripts/refresh-toll-sources.cjs` to download the five public VINCI price feeds listed in `data/tolls/sources-2026.json`.

The collector downloads in parallel, bounds each download to 20 seconds and 4 MiB, rejects redirects and non-success HTTP responses, decodes the published character set, validates CSV headers/row widths/prices and writes each snapshot atomically. Snapshots retain source URL, effective date, review year, retrieval day, SHA-256 of downloaded bytes, all published vehicle classes and tariff conditions. A failed refresh preserves the last valid snapshot but marks the attempt stale/unavailable in the manifest and exits unsuccessfully.

The GitHub workflow runs on collector changes and manual dispatch, with seven-day artifacts and read-only repository permissions. It does not push refreshed prices, change the app's operational catalogue, deploy or activate a paid service. Recurring production refresh remains to wire after review.

`toll-official-catalogue.cjs` exposes a source-price lookup for ASF, ESCOTA and Cofiroute/Arcour. Both endpoints must include the motorway and station name; the published direction is respected. Exit identifiers, when supplied, must be published in that source. Missing or contradictory amounts cannot be quoted. Zero is retained as a valid published price. Source data older than seven days, future retrieval timestamps, dates before the source version and dates outside the reviewed year are rejected. This seven-day limit is a local freshness policy, not an operator guarantee.

ARCOS and Duplex A86 schedules are collected intact, including time, day, badge and Euro-group fields. They cannot be quoted as an unconditional fixed price. Calendar-aware lookup remains to implement. No route, access or availability is verified merely by finding a published price.

The source page is https://www.vinci-autoroutes.com/fr/conseils/autoroute-mode-demploi/tarifs-peage-vinci-autoroutes/ . The current reviewed effective dates are ASF 1 June 2026, ESCOTA/Cofiroute/ARCOS 1 February 2026, Duplex A86 1 January 2026. HTTP success and a new hash establish retrieval, not a new effective date; a future annual edition still needs source-date review. National missing-tariff counts remain `null`: five feeds do not establish an exhaustive France/border inventory.
