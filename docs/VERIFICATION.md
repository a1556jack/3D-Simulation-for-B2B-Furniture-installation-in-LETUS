# Verification — 2026-11-09

- `npm test`: 28/28 domain, style, observation and merge tests passed.
- `npm run typecheck`: passed.
- `npm run build`: static Next.js production build passed; local map hashes verified again.
- `npm run test:browser`: 16/16 Playwright cases passed using actual source files, including all eight region buttons, mobile layout, address-vicinity search, missing data, failure preservation, no silent coordinate clamping, truthful source status, reviewed observation comparison, persistence, duplicate imports, mobile record forms, asynchronous import cancellation, recoverable corrupted storage, rejected site mismatches, and backup quota failure.
- Portable HTML served over local HTTP: pinned public GitHub PMTiles requests succeeded (206 / CORS), no page errors. All eight regional centers rendered. Viewport samples: 서울 2,477, 인천 1,191, 경기 2,270, 강원 158, 대전 619, 세종 117, 충북 279, 충남 582 polygon parts. These are display samples, not unique building counts or comprehensive coverage statistics.
- `npm audit --omit=dev`: 0 vulnerabilities.
- Fresh independent code review completed. Failure-state bug reproduced RED→GREEN. Coordinate clamping and source-status badge findings were regraded Important, reproduced with tests and fixed. Deferred minor: if the bundled place index fails, the search button also disables coordinate entry; reload guidance remains available.

Tests verify rendering and application behavior, not the dimensional accuracy of source data or real construction safety. Pilot house number 111-73 remains unverified. No site survey or real equipment clearance validation was performed.

The portable HTML's direct `file://` navigation could not be verified in the managed browser because its administrator policy blocks local-file navigation. Its identical HTML was verified over HTTP. The cloud `sites-preview` relay was unavailable. Public source publication and hosted URL availability must be recorded separately from these local tests.

Source-observation extension: fresh independent review exposed and then verified regressions for import races, original-record loss, local site-ID bypass and coercive enum parsing. All were fixed; browser and unit suites pass. The schema supports 500 records and an 8MB UTF-8 file cap, including a tested maximum-size Korean text history. No authentic field measurements were added during tests; synthetic fixtures remain in test contexts only.
