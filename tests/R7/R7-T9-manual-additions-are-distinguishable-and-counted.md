# R7-T9 — Manually added attendees appear in R5's list distinguishable from self-registered ones, and count in the totals and places remaining

## Specification

| Item | Content |
|---|---|
| Test Case ID | R7-T9 |
| Test Scenario | Manually added attendees appear in R5's list distinguishable from self-registered ones, and count in the totals and places remaining |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with `<SEATS>` 3, FX-R-MANAGED, then FX-R-TAKEN with `<N>` = 1.<br>3. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. Add Attendee One (R7-T1 steps 1–3). |
| Test Steps | 1. open `#/events/<EVENT_ID>/registrations` (the "Registrations" button on the event) and read the rows and totals.<br>2. As an attendee, open the event from "Events". |
| Test Data | 1 self-registration, 1 manual addition |
| Expected Result | Step 1: one row `Self-registered`, one `Added by Organiser One`; `Registered 2`, `Places remaining 1`. Step 2: `1 place remaining`. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven at API level by backend/services/registration/tests/api/r7Cards.test.ts › R7-T9 lists a manual addition apart from self-registrations, counted in the totals and places remaining, which passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 (commit d7abf51). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
