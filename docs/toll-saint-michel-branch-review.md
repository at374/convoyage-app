# Saint-Michel-de-Maurienne: different branches at a shared catalogue position

The original base catalogue distinguishes `ST MICHEL MAURIENNE BAR` and `ST MICHEL MAURIENNE ECH`, but assigns them the same coordinates. From Aiton, the stored class-1/2 amounts are 10.20/15.00 EUR for the barrier and 8.20/11.90 EUR for the interchange. Those amounts and the original base file are preserved.

Two explicit position overrides in the overlay now retain the ministry's exact lane points: `St Michel Barriere` on route `A0043`, and `St Michel Echangeur` on `73A904370CD`. Both the direct loader and actual worker apply the reviewed identities without changing station indices or prices. Every imported point is checked against its source name and road in tests. Corrections must be close to the original position (150 m), have explicit provenance and a unique catalogue name; no fuzzy identity inference is used.

The 2026 operator guide separately names Saint-Michel Barriere, Saint-Michel Echangeur and the Modane approach. The SFTRF sector declaration published by the transport regulator likewise distinguishes a closed-system full-road barrier and interchange at PK 177.1, and directional open-system exchanges at PK 177.5. That declaration describes the situation in October 2022 and is not treated as a 2026 coordinates certificate.

Sources:
- https://www.sftrf.fr/wp-content/uploads/2026/02/Tarifs_autoroute_2026_2.pdf
- https://www.sftrf.fr/wp-content/uploads/2026/02/Tarifs_autoroute_2026_1.pdf
- https://www.autorite-transports.fr/wp-content/uploads/2022/12/2022_10_sftrf_declaration_secteur_set.pdf

Previously, `prixExact` returned the first distance-compatible candidate among neighbouring station identities. This could select the barrier price for an interchange journey, or the reverse, according to catalogue order. It now examines the viable candidates and refuses the result if either class differs in cents. Equal prices remain usable. For a group whose positions all have explicit reviewed overrides, a closest distance of at most 8 m to the trace and a separation margin of at least 5 m from the next candidate allow one identity to be selected. Distances are measured to polyline segments, not just sampled vertices. These conservative thresholds are an implementation policy, not an operator access guarantee. Unverified groups and near-ties do not get this exception.

An ambiguity discovered while trying a longer pair also prevents presenting a shorter partial sum as a complete price. Diagnostics are cleared at the start of each calculation, returned by the actual Blob worker and direct fallback, and explained by the existing toll renderer. An independent route remains priced and does not inherit a previous warning.

Tests include synthetic branches in both directions and reversed catalogue order, a class-2-only discrepancy, equal prices, an independent route, a candidate rejected on distance, source lane coordinates, actual Saint-Michel amounts, segment interpolation, unresolved near-ties, worker/direct parity and mobile rendering. The endpoint-only catalogue components are not road traces or real mission validation.

Remaining work: validate real/public approach and exit traces and resolve the separate directional open-system `St Michel amont` gates. The ministry's 2025 coordinates and the route proximity policy do not prove 2026 access or circulation. The AURA report recognizes the interchange identity but retains the unresolved amont record. Swiss vignette accounting is unchanged: no additional automatic charge.
