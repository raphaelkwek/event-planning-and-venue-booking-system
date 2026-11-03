# R7-T12 — Race: a seat freed by a withdrawal goes first to an attendee added over capacity, so places remaining never shows a place that is not free

## Specification

| Item | Content |
|---|---|
| Test Case ID | R7-T12 |
| Test Scenario | Race: a seat freed by a withdrawal goes first to an attendee added over capacity, so places remaining never shows a place that is not free |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`. Attendee Two's account (`tests/R5/README.md`).<br>2. FX-R-EVENT with `<SEATS>` 2, FX-R-MANAGED; Attendee Two registers; FX-R-TAKEN with `<N>` = 1.<br>3. As the organiser, add Attendee One over capacity (R7-T5 steps 1–2). |
| Test Steps | 1. As Attendee Two, withdraw.<br>2. As Attendee Two, open the event and try to register again.<br>3. As the organiser, open the list (R5-T1). |
| Test Data | 2 seats, 3 attendees |
| Expected Result | Step 2: still `Full`, and refused for capacity: the freed seat went to Attendee One, added over capacity, so the total is back to capacity, not below it. Step 3: `Registered 2`, `Withdrawn 1`, `Places remaining 0`. Under concurrent withdrawals, additions and registrations, the number of attendees never exceeds the seats plus those added over capacity. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven at API level by backend/services/registration/tests/api/r7Cards.test.ts › R7-T12 gives a freed seat to an addition over capacity first, under concurrent withdrawals, additions and registrations, which passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 (commit d7abf51). It needs a second attendee account (tests/R5/README.md). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
