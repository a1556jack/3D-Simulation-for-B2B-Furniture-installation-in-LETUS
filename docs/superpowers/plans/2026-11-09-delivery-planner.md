# Delivery decision planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Let an installation manager compare measured route and unloading candidates, inspect vehicle/forklift geometry and reasons, and issue a fixed-condition work sheet.

**Architecture:** Preserve the existing Next static app and MapLibre regional viewer. Add a pure TypeScript planning/geometry engine and a dedicated planning panel. Shared results drive summary, map overlays, candidate ranking and a versioned printable report. No public-map height is silently promoted to survey data.

**Tech Stack:** Existing TypeScript, React, Next, MapLibre, Vitest and Playwright; no extra server or credentials required for calculation.

**Spec:** User's implementation plan and approval following `docs/audits/2026-11-09-functional-gap.md`; implementation choices below.

## Design and constraints

- Continue the existing `work` checkout; preserve audit and existing browser data. User has already delegated routine decisions and publication, so no repeat design/permission gate.
- New `DeliveryPlan` has six separately identified trucks, one forklift, named routes with ordered georeferenced waypoints and segment conditions, rectangular surveyed obstacles, and unloading zones linked to a truck route and a forklift route. Routes end at the forklift work end / E/V front; no elevator ride verdict.
- Dimensions are nullable, never inferred from tonnage. Each equipment/segment/obstacle/zone has source/date/confirmed provenance; group provenance applies explicitly to its entered fields. Editing measurements or geometry clears confirmation. Site/building identity is separately confirmed with provenance.
- Validated dimensions describe a simplified rigid-box low-speed geometry model. Straight motion sweeps continuously. Circular corner paths use the non-steered axle as reference, with front/rear steering reflected in body overhangs. Rotating sweep uses bounded subdivisions plus a conservative inflation guard; any unresolved guard-only overlap returns unknown, never pass.
- Need explicit clearance margins. Route checks cover section width/height, steering-radius compatibility, reversing, obstacle intersections with height ranges, and idealized ground-clearance ramp transitions. Structural loading, real lift capacity, stability, operating permissions remain listed separately; confirmed access/obstacle completeness are required to recommend.
- Candidate comparison evaluates all six actual trucks and the forklift route, plus side/rear unloading envelope with wings/lift and forklift aisle. Concurrency is explicit (default 1 at a time, total six). Compare 0/90 degree rectangle layouts. Capacity is a conservative aligned envelope count, not dispatch optimization.
- Candidates originate from user-designated measured spaces; no road network, pavement ownership or verified access is inferred from unregistered map gaps. Unknown candidates are explicitly review candidates and are never advertised as recommended. Only fully checked candidates may be recommended; sort by feasible capacity then route distance.
- Pilot starts empty/unknown. A visibly separate synthetic example demonstrates calculation, and cannot become a real pilot pass. Existing simple observations keep their own comparison, but summary/export share the same result.
- Plan records use a separate versioned browser key with validated imports and recoverable invalid data. Reports capture exact plan/results, creation time and condition revision; edits mark old reports stale. HTML work sheet includes route diagrams, equipment, failures/missing values and sources and supports browser PDF printing. No shared backend/auth/offline photos claim.

## Review focus

1. Missing/zero/malformed dimensions, unconfirmed source and synthetic mode cannot produce a real-site recommendation.
2. Short legs, sharp turns, thin obstacles and reversing must not evade swept geometry checks.
3. Equipment/route/site changes invalidate confirmations and old reports, including imports.
4. Competing routes/zones and six distinct trucks must not reuse another candidate's condition or result.
5. Work sheet and overview cannot conceal a confirmed failure; importing a malformed record must preserve prior work.

## Task 1: Pure geometry and candidate evaluator

Files: `src/lib/planning/{types,geometry,evaluate,persistence,example}.ts`, `tests/planning.test.ts`.
Interfaces: `evaluatePlan(plan):PlanResult`, `routeMotion(route,equipment):Motion`, `poseAt(motion,t)`, `parsePlan(raw):DeliveryPlan`, `createPlan()`, `createExample()`.
- [ ] Write and run failing tests: unknown/no false pass; generous/low/narrow route; front/rear/reverse; thin obstacle and overhead range; turn radius/short leg; crest ramp; wing and unloading space; fleet capacity; recommendation ordering; invalid file/stale report.
- [ ] Implement typed provenance and finite, bounded domain validation, continuous geometry, per-item checks, candidate rankings and snapshot primitives.
- [ ] Run full unit suite and typecheck. Record limitations and algorithm bounds.

## Task 2: Planning UI and map integration

Files: `src/components/{planning-panel,planning-fields,planning-report}.tsx`, modify `workspace.tsx`, `map-canvas.tsx`, CSS; browser tests `tests/browser/planning.spec.ts`.
Interfaces: shared plan state/result; route capture from map; scene features for candidate lines, zone/obstacle volumes, selected truck/forklift and playback; callback world points.
- [ ] Reproduce overview failure mismatch and add browser flows for named routes, explicit dimensions, recommendations, invalidation and printed snapshot.
- [ ] Build equipment, route/section, zone, obstacle and result editing with visible provenance, missing item navigation, selected candidate and replay.
- [ ] Share verdict in overview and export; avoid class collision for unknown status. Preserve existing observation/storage tests.
- [ ] Verify desktop/mobile and existing 16 browser tests with real map data; inspect screenshots.

## Task 3: Work sheets, delivery and review

Files: report/persistence tests, docs/DELIVERY.md, docs/REMAINING.md, release HTML.
- [ ] Verify report snapshots and staleness, HTML escaping, route diagrams, import rejection/recovery and data provenance.
- [ ] Run production build/typecheck/unit/browser tests and portable artifact browser check.
- [ ] One independent final code review; fix important findings with regression tests.
- [ ] Publish updated `work` source and self-contained execution file using existing authorized delivery; verify raw artifact hash and give latest link with accurate limitations.

## Ledger

Pre-flight: evaluator types are the single contract shared by UI/map/report. Existing `Inspection` remains a separate legacy condition store, not auto-bound to new route segments.
Ruling: preserve current work checkout and use existing static architecture, per saved environment guidance; do not create a second project or pretend API credentials are available.

Task 1: implementation and 49/49 unit tests passed; 21 planning cases include continuous thin-obstacle detection, actual stop envelope, parked-truck/forklift interference, and no real-site recommendation from unknown conditions. Typecheck passed.
Ruling: simultaneous capacity is a conservative area count; until individual slot approach paths exist, concurrent >1 stays unknown rather than claiming six simultaneous maneuvers verified. This preserves useful capacity comparison without a false geometric pass.
Task 2: UI/map/report integrated; overview/export failure regression and mobile invalid import pass. Investigating one real-browser workflow timeout before final acceptance.

Final review: one independent read-only review at ba0afc3 found three Important issues. All accepted.
Final: fixed pitched horizontal footprint — four ascending/descending/forward/reverse regressions RED→GREEN; conservative longitudinal expansion added to swept geometry and corner width. Inclined unloading remains unknown pending a suitable model.
Final: fixed unrelated missing dimension hiding a known failure — height and straight collision regressions RED→GREEN; required inputs are checked per item, while other missing equipment fields remain unknown.
Final: fixed stale work sheet download — historical export regression RED→GREEN; exported file has explicit use-stop banner, no operational print button or current recommendation wording, and original snapshot remains immutable. Browser export coverage added.
Ruling: distance is the first tie-breaker between fully passing candidates, capacity second — sequential unloading gains no practical value from surplus empty slots; this is documented in PLANNER.md. If concurrent dispatch becomes required, its optimization priorities need a separate model.
Final reviewer accepted the documented exclusions and conservative concurrency handling; no additional deferred behavior was silently omitted. Unit suite after fixes: 62/62, typecheck passed.
