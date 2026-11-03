# R7-T10 — Negative: adding an attendee who already holds an active registration is refused, naming it

## Specification

| Item | Content |
|---|---|
| Test Case ID | R7-T10 |
| Test Scenario | Negative: adding an attendee who already holds an active registration is refused, naming it |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with its defaults, then FX-R-MANAGED; Attendee One registers (R2-T1).<br>3. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Add Attendee One as in R7-T1 steps 1–3. |
| Test Data | Attendee One's registration REG-… |
| Expected Result | 409 `REGISTRATION_DUPLICATE`, naming Attendee One's registration `REG-…`. Still one registration. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven at API level by backend/services/registration/tests/api/r7Cards.test.ts › R7-T10 refuses a duplicate addition, naming the existing registration, which passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 (commit d7abf51). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
