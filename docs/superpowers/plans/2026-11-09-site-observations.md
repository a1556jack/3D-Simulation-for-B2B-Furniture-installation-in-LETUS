# Site observation records and measured-condition checks

> Execute inline with executing-plans/TDD. User already approved the system plan and asked for autonomous continuation; no new design approval requested.

Goal: Attach ramp, parking, unloading and E/V observations to the pilot site with values, units, source, date, method and local review status. Use reviewed selected measurements for individual width/height comparisons only. Retain actual geographic viewer as the main screen.
Spec: User's approved B2B plan, especially source observations, unknown-state rules, no automatic elevator pass, no overwritten field measurements.
Architecture: TypeScript domain functions and a React inspection panel inside the existing static/portable application. Local records are explicitly local, not authenticated team sharing. No unverified public provider is portrayed as connected.

1. Domain/tests: validate and normalize 20 condition/spec fields; maintain immutable observations and explicit selected IDs; import new records pending, preserve selections, deduplicate identical IDs, expose conflicting IDs, reject different site IDs and malformed input. Tests for mm/m and t/kg, missing sources/dates, malformed values, conflict preservation, E/V exclusion, failure dominance and absent margin.
2. UI/tests: observations form, per-field selected and pending records, explicit local review, margin entry, itemized results, missing-data checklist, JSON import/export, local persistence. Preserve old stored fields as legacy notes without auto-verifying them. Browser tests perform record→review→compare→save→reload→export/import and reject wrong site.
3. Verify/publish: run full domain/browser tests, typecheck/build/portable; one fresh review, fix important issues; publish updated work branch and stable delivery links. Mark overall goal blocked on authoritative pilot building identity/measurements and official API authentication/network access; do not equate this foundation with a full driving/collision simulator.

Constraints: Source metadata required before local approval. Imported approvals never trusted automatically. Public updates cannot replace selected measurements. No inferred safety margin or tonnage-derived dimensions. No E/V automatic pass, floor structural pass or forklift stability pass. No API keys in client code. Exact pilot building remains unconfirmed.
Review focus: malformed/local corrupted data, unit mismatch, imported review escalation, ID collisions across different sites, full-route success incorrectly implied by individual checks.

Progress:
- Base c8f96fa. Runtime revision2 remains restricted; no configured secret bindings. Provider activation/source lookup blockers unchanged; no repeated denied requests.
- Domain complete: 17 new observation/merge/scope cases plus 9 existing cases pass (26 total). Millimetres/metres and tonnes/kilograms normalize explicitly; missing metadata or margin cannot pass; elevator data is excluded from automatic passage comparisons.
- Ruling: file cap is 8MB instead of an initial 1MB, with explicit byte-length checking, so the maximum supported 500-record Unicode history can round-trip. Verified with a failing maximum-history test before raising the cap. Cost: larger, still-bounded client parse memory.
- Initial UI/full regression verification: 12/12 real-data browser cases passed. Fresh reviewer then reproduced three important defects: stale asynchronous file import overwrites newer edits; saving after invalid local restore replaces the original payload; local restore accepts another site's ID. New regression cases added and reproduced. Fix pass will lock import controls/cancel unmounted reads, preserve downloadable recovery backups before replacement, and enforce the pilot identity on local restore.
- Final: Ruling: enum arrays accepted by coercive key lookup are treated as Important (reviewer labeled minor) because an imported record can disappear from rendered lists. Reject non-string enums at the input boundary. Cost if left unfixed: invisible records occupy capacity and cannot be reviewed through the form.

- Review fix pass complete: stale imports canceled on panel unmount and controls locked during reads; corrupt/mismatched local records backed up before replacement and original recovery download survives reload; pilot site enforced on restore; array enum values rejected. The three browser regressions and enum unit test went RED→GREEN. Added quota fault injection to verify failed backup does not replace original.

- Final verification: 28/28 unit tests, 16/16 actual-map browser tests, typecheck, production static build and portable build all pass. No new unresolved reviewer findings after the fix pass. Current official-provider network/authentication and authoritative pilot measurements remain absent; the overall requested system is not declared complete.
