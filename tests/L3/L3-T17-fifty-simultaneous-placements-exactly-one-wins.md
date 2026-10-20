# L3-T17 — Fifty placements of overlapping holds on one venue at the same moment: exactly one is placed, and the other 49 are refused naming it

## Specification

| Item | Content |
|---|---|
| Test Case ID | L3-T17 |
| Test Scenario | Fifty placements of overlapping holds on one venue at the same moment: exactly one is placed, and the other 49 are refused naming it |
| Pre-conditions | 1. A throwaway local Postgres (CI's integration job), never the shared database. |
| Test Steps | 1. Run `npm test -w @connectsphere/planning-core -- tests/race/invariants.test.ts`. |
| Test Data | 50 Requested holds for 50 events, the same venue and period, placed at once through `placeHold` |
| Expected Result | The L3 race test passes: in each of ten rounds exactly one hold is Held, 49 are refused with `VENUE_SLOT_CONFLICT` naming the winner, and the venue has exactly one HELD slot. |
| Created By | Yichen Chai, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | `npm test -w @connectsphere/planning-core -- tests/race/invariants.test.ts` ran against a throwaway local Postgres: 1 file, 10 tests, all passed (14.7 s). The L3 race test passed in each of its ten rounds: exactly one hold Held, 49 refused with VENUE_SLOT_CONFLICT naming the winner, and exactly one HELD slot at the venue. CI's integration job on the branch also passes. |
| Status | Pass |
| Remarks | Commit: 01a891e · Evidence: CI integration job (throwaway Postgres) and the local vitest output · Environment: local throwaway Postgres · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |