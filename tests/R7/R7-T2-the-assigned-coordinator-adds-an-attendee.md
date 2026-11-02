# R7-T2 — The assigned coordinator can add an attendee manually too, without a reason

## Specification

| Item | Content |
|---|---|
| Test Case ID | R7-T2 |
| Test Scenario | The assigned coordinator can add an attendee manually too, without a reason |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with its defaults, then FX-R-MANAGED.<br>3. Signed in as `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. As R7-T1 steps 1–3, leaving the reason empty. |
| Test Data | Attendee One; no reason |
| Expected Result | The row reads `Added by Coordinator One`, with no reason. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven at API level by backend/services/registration/tests/api/r7Cards.test.ts › R7-T2 adds an attendee for the assigned coordinator, with no reason, which passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 (commit d7abf51). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
