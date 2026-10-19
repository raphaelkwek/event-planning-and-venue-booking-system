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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
