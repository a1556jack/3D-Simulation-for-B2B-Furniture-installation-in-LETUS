# Source-backed regional 3D viewer implementation plan

> Execute inline using executing-plans. This continues the user's approved implementation, including publication.

Goal: Make actual Korean regional building footprints browsable in 3D immediately, with a visible source and honest uncertainty for the requested Yongin address.
Architecture: Next.js/TypeScript static export, MapLibre and PMTiles. Download immutable, attributed public regional archives into the local app. Preserve the source manifest and hashes. A separate offline searchable road/place index comes from those same tiles. No API credentials required for this map layer.
Spec: User's regional 3D request and pilot address in this conversation.

Constraints: Eight requested provinces/cities. Do not fabricate coordinates for 111-73 or geometry/height. Map geometry and display heights cannot determine equipment clearance. Public map coverage may have gaps. Use local static files to avoid third-party runtime requests. Exclude private data and credentials from git.

## Tasks
1. Data and domain: record source/coverage, extract real roads/places for search; verify archive hashes; tests for confidence, coordinate search and missing clearance. Keep exact pilot match unresolved unless source supplies it.
2. Viewer: Next/MapLibre terrain-flat geographic 3D, region buttons, road/place search, source/height legend, model inspection, 2D/3D, measurement route and site checklist. Persist local notes. Test actual local tile rendering, region switches, failed data load and mobile UI.
3. Delivery: static build and GitHub Pages workflow; test browser/build/types; fresh branch review; publish authorized new branch without overwriting main and verify delivery state.

## Review focus
- Missing height and incomplete addresses must never become confirmed measurements or pass results.
- Dissolved multipolygons cannot be mistaken for one building's dimensions.
- Source load failure must be displayed, not an empty success.
- Search must preserve coordinate/address confidence and support no results.
- Public release must contain no secrets or unlicensed/private source material.

## Progress / decisions
- Repository at eef4726 only contains README after environment replacement; old ca386c0 object unavailable. Implement this requested geographic viewer here; do not claim the previous full operational system is restored.
- Downloaded 3 PMTiles archives from PLAYX1/playx-raven-maps at a30620ace8a174a0d7474c4785f564f22cdac064. Attribution OSM/Protomaps. Regional bounds, maxzoom and hashes retained.
- Nampeong-ro is present around 127.28–127.32 / 37.23. No 111-73 address match found in the source tiles. Show road vicinity, explicitly unresolved exact building.
- Ruling: Unknown height uses an optional, visibly labeled 6m display extrusion, never a clearance input. Default visible to make footprint context legible; user can disable. Cost if wrong: appearance could be mistaken for survey, mitigated by persistent legend and inspected-property warning.
- Task 1 complete: 9 domain/style tests pass; 10,038 actual source tiles indexed into 140,071 road/place entries. Hashes match recorded source manifest.
- Task 2 verification in progress: Next build/typecheck pass; first 3 browser tests pass using real local archive tiles. Add an end-of-camera movement assertion before final screenshots.
- Delivery observation: sites-preview recognizes .openai/hosting.json but its preview relay is unavailable. GitHub Pages enablement requires an administration token, absent here. Prepare a portable HTML with the same real sources as a fallback, not an unverified public URL.
- Fresh review: one P2 fixed via failed browser test then pass: preserve map failure status during 2D/3D camera interaction. Review also found minor coordinate-range/index-failure coupling and the source-tab connectivity badge; recorded for grading.
- Region-switch test exposed a separate real-data failure during long animated flyovers: dozens of canceled PMTiles Range requests followed by a fetch failure. Switch named region navigation directly to the requested view, avoiding loading unnecessary intermediate tiles. Manual orbit/pan remain available.
- Root cause refinement: direct navigation alone did not fix the local failure. Chromium reused overlapping partial HTTP responses (Next dev supplies weak ETags). PMTiles' existing no-store fetch option fixed the reproducible failure with identical tile requests; its own directory cache remains enabled. Portable source-origin test independently rendered all eight regions with 117–2,477 on-screen polygon parts. These are viewport-dependent parts, not unique building inventories.
- Final review grading: coordinate clamping and the permanently connected source badge are Important because they misstate displayed location/data readiness. Both reproduced as failing browser tests, then fixed: remove hidden camera coordinate clamping; derive source badge from actual map status.
- Final minor (deferred): coordinate search is disabled if the places index fails. Local/portable index is bundled, and the error requests reload; the independent coordinate fallback can be separated later.
- Task 2 complete: 8/8 real-data browser tests, 9/9 unit tests, TypeScript and final production build pass. Portable HTML verified over HTTP with original source requests and all eight regions; managed file:// navigation blocked by browser policy.
- Ruling: publish a new `work` branch with reviewed source and the portable HTML, preserving `main`. The user has already authorized publication and asked for a program link; no repeated permission prompt. Cost if wrong: public exposure of the supplied pilot address; no credentials or private operational records are included.
