# R5-T4 — Totals for registered, withdrawn and places remaining are derived from the registration records

## Specification

| Item | Content |
|---|---|
| Test Case ID | R5-T4 |
| Test Scenario | Totals for registered, withdrawn and places remaining are derived from the registration records |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with `<SEATS>` 4, FX-R-MANAGED, then FX-R-TAKEN with `<N>` = 3.<br>3. One of those three withdrawn: FX-R-WITHDRAW-ONE.<br>4. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. open `#/events/<EVENT_ID>/registrations` (the "Registrations" button on the event).<br>2. Read the totals. |
| Test Data | 4 seats · 3 registrations, 1 of them withdrawn |
| Expected Result | `Registered 2`, `Withdrawn 1`, `Places remaining 2`, `Capacity 4`. Three rows: two `Registered`, one `Withdrawn`. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven at API level by backend/services/registration/tests/api/r5Cards.test.ts › R5-T4 totals registered, withdrawn and places remaining from the records, which passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 (commit d7abf51). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
