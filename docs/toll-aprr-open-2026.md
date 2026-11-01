# APRR/AREA open-system source and existing barrier completion

The official one-page table effective 1 February 2026 is transcribed in `data/tolls/reviewed/aprr-area-open-2026.json`: 20 station-code rows and 100 class 1-5 amounts. These are counts of this source's rows and prices, not an exhaustive inventory of France or AURA tolls.

Source: https://voyage.aprr.fr/sites/default/files/2026-02/2026-%20Syst%C3%A8mes%20Ouverts%20APRR-AREA.pdf

Verification on 1 November 2026 used the rendered official PDF page and indexed table. Local download returned HTTP 403, so no downloaded-byte/hash verification is claimed. The PDF metadata includes an old presentation title; its visible tariff heading explicitly states 1 February 2026. Published tariff kilometres are archived separately and never supplied as measured road distances.

`toll-aprr-open.cjs` quotes by exact published motorway and station code, preserving leading zeroes and the TML designation. An exact class 1-5, valid date within the reviewed 2026 tariff period and a source check within seven days are required. It never asserts physical passage, discounts or route feasibility. The six rows without a reviewed operational barrier binding still have source prices, but are explicitly geography-unbound: Gerzat-Ville, Villefranche-Ville, Dordives, Cruseilles A41N, Copponex and Chignin Bretelle. Nearby closed-system or open-system gates must not be merged to force coverage.

`node scripts/complete-aprr-open.cjs` previews completion; `--write` writes the overlay only after validating every overlapping amount for all 14 previously bound barriers. A disagreement, unsupported tariff context, missing barrier or duplicate barrier aborts without writing. Existing prices, names, geometry and vignette accounting remain intact. Missing classes are added through 31 December 2026, with source code/road and review proof. Initial completion adds 42 amounts (classes 3-5) and is idempotent. The existing versioned barrier engine can then quote these classes without changing the class-1/2 UI.

La Boisse A432 and Saint-Exupery are separate source codes; La Cotiere and the closed-system La Boisse remain distinct. Source completeness for these 20 rows is not route-wide completeness. Runtime refresh of this PDF, real approach traces and the six geography bindings remain unfinished. No Android physical test or deployment is implied.

## Saint-Exupery A432 fixed-gate calculation

A reproduced calculation treated the same Saint-Exupery gate both as a fixed-price barrier and as an unexplained ticket station. This blocked even a synthetic short component through that gate. The overlay now binds station code 03070 to `SAINT EXUPERY` and `aprr-area-ouvert-saint-exupery`, with the two exact `Saint Exupery`/`A0432` ministry lane points. The existing close-position override and strict identical-coordinate fixed-gate rules apply in both loaders, leaving all source amounts intact. Synthetic direct/worker and mobile-renderer tests exercise the existing class-1/2 display. These tests are component validation, not a complete A432 drive or proof of real access. La Boisse/La Cotiere remain distinct and are not excluded by this binding.
