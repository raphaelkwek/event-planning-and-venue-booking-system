# R7-T4 — A manual addition is permitted after the registration window has closed, and takes a place

## Specification

| Item | Content |
|---|---|
| Test Case ID | R7-T4 |
| Test Scenario | A manual addition is permitted after the registration window has closed, and takes a place |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with `<OPENS>` `now() - interval '7 days'` and `<CLOSES>` `now() - interval '1 day'`, then FX-R-MANAGED.<br>3. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Add Attendee One as in R7-T1 steps 1–3. |
| Test Data | 3 seats, registration closed yesterday |
| Expected Result | Added: a `Registered` row, `Added by Organiser One`. `Places remaining 2`. (Attendee One registering themselves would be refused for the window.) |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven at API level by backend/services/registration/tests/api/r7Cards.test.ts › R7-T4 adds an attendee after registration closed, taking a place, which passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 (commit d7abf51). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
