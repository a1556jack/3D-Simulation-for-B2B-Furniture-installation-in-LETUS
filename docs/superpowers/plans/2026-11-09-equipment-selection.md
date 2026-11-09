# Equipment selection extension Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans and preserve the already implemented delivery planner. Do not restart the app or re-apply the old viewer work.

**Goal:** Fulfil the user's latest explicit request: selectable vehicle tonnage, count and body type; selectable forklift, ladder truck or other handling equipment, with relevant checks and fields.

**Architecture:** Extend the just-built typed planner to schema v2, retaining v1 import migration. Use a generic handling equipment slot instead of a forklift-only slot. Vehicle count is 1–20; reduced profiles move into a retained inactive list so changing count does not erase entered specs. Tonnage is metadata and never substitutes for dimensions. Current six 11t wing-body trucks / 3t forklift remain initial values, not fixed requirements.

**Spec:** User message: '차량 톤 수 및 대수 종류, 지게차 혹은 사다리차 등등 반입 차량 및 장비도 내가 선택할 수 있도록 반영해줘'. Continue original agreed route/unloading/work-sheet improvements.

## Implementation choices

- Truck body types: wing body, box body, cargo. Nominal tonnage is editable, including a direct numeric value. Each truck may have a different type/tonnage/model. Side unloading of a non-wing body needs explicit side-access confirmation; wing dimensions are not imposed on a cargo/box truck. Rear lift extension accepts explicit 0 when absent.
- Handling choices: forklift, ladder truck, other (name and geometry). Front/rear steering is explicit, defaulting to rear for forklift and front for ladder truck. Switching keeps each kind's entered profile in a retained equipment collection rather than destroying it.
- Forklift retains loaded-body/aisle/ramp logic. Ladder truck uses its road-vehicle geometry for approach, its own route endpoint for setup, outrigger width/length and reference offset, actual target height, required horizontal reach and manufacturer's limit records. A height/reach/load combination needs explicit manufacturer work-chart confirmation; independent maximum height and reach never establish actual operating capability. Elevated working-area clearance is a separate explicit confirmation, not inferred from the map. Unknown other equipment does not receive automatic operating approval.
- Ladder installation and approach checks are distinct from the delivery truck and transfer working area. Never run forklift fork/load-dimension requirements against a ladder truck. E/V and structural/lifting stability remain excluded.
- Result text, 3D display, work sheet, imports, defaults and count limits all use the selected equipment. Existing site/legacy observation records remain recoverable. V1 files migrate without fabricated dimensions or silently confirmed new values.

## Tasks

- [ ] Add failing tests for variable fleet/count retention, tonnage/type preservation, forklift/ladder switches, v1 migration, ladder setup-space and work-chart insufficiency, type-specific report output.
- [ ] Implement schema/helpers/evaluation. Preserve fixed safety cases from first planner review and all 62 existing unit tests.
- [ ] Add UI selectors and type-specific fields; update every hard-coded six/forklift presentation and existing fixtures.
- [ ] Verify actual selection, switching/reloading and work sheet flows in desktop/mobile browser; full tests and production/portable build.
- [ ] Fresh review of this newly requested extension only (the previous planner review is already complete); address important findings then publish one latest combined version.

## Prior stage ledger

Delivery planner implementation commit ba0afc3; review fixes are currently uncommitted. They cover pitched horizontal collision envelope, per-item known-failure precedence, and clearly marked stale work-sheet exports. Unit suite 62 passed; full browser suite 21 passed after fixes (verify log .data/planning-browser-final.log). First production build passed before review fixes, so final build/portable regeneration still required. Existing raw external viewer pin is still 1158a83 (old viewer); no new link should be advertised until the final artifact is committed/pushed and verified.
