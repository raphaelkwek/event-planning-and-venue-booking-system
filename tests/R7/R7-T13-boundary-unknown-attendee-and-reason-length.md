# R7-T13 — Boundary: an email with no attendee account is refused, and the reason may be up to 500 characters

## Specification

| Item | Content |
|---|---|
| Test Case ID | R7-T13 |
| Test Scenario | Boundary: an email with no attendee account is refused, and the reason may be up to 500 characters |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with its defaults, then FX-R-MANAGED.<br>3. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Add `nobody@connectsphere.test`.<br>2. Add `organiser2@connectsphere.test` (staff, not an attendee).<br>3. Add Attendee One with a 501-character reason.<br>4. Add Attendee One with a 500-character reason. |
| Test Data | As listed |
| Expected Result | Steps 1 and 2: 422 `ATTENDEE_NOT_FOUND`, nothing stored. Step 3: 400 `VALIDATION_FAILED` naming `reason`. Step 4: added, with the whole reason. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven at API level by backend/services/registration/tests/api/r7Cards.test.ts › R7-T13 refuses an email with no attendee account and a reason over 500 characters, and keeps one of 500, which passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 (commit d7abf51). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
