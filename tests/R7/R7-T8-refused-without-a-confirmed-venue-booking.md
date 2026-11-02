# R7-T8 — Negative: a manual addition is refused when the event has no confirmed venue booking

## Specification

| Item | Content |
|---|---|
| Test Case ID | R7-T8 |
| Test Scenario | Negative: a manual addition is refused when the event has no confirmed venue booking |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-NO-VENUE, then FX-R-MANAGED.<br>3. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Add Attendee One as in R7-T1 steps 1–2. |
| Test Data | An event with no confirmed booking |
| Expected Result | 422 `REGISTRATION_NO_CONFIRMED_BOOKING`: `… has no confirmed venue booking, so its capacity is not known yet …`. Nothing stored. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven at API level by backend/services/registration/tests/api/r7Cards.test.ts › R7-T8 refuses an addition while the event has no confirmed venue booking, which passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 (commit d7abf51). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
