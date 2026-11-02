# R6-T5 — Waitlist entries are kept in the order they were created, and the owning organiser and assigned coordinator see that order

## Specification

| Item | Content |
|---|---|
| Test Case ID | R6-T5 |
| Test Scenario | Waitlist entries are kept in the order they were created, and the owning organiser and assigned coordinator see that order |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with `<SEATS>` 1, FX-R-MANAGED, FX-R-TAKEN with `<N>` = 1, then FX-R-WAITLISTED with `<N>` = 2.<br>3. Attendee One joins the waitlist (R6-T1 step 1), third. |
| Test Steps | 1. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. Open the list as in R5-T1 and read the Waitlist section.<br>2. Sign in as `coordinator@connectsphere.test` and do the same.<br>3. Sign in as `organiser2@connectsphere.test` and do the same. |
| Test Data | 3 waitlisted attendees, Attendee One last |
| Expected Result | Steps 1 and 2: positions 1, 2, 3 in the order joined, Attendee One at 3, each `Waitlisted` with its time. Step 3: no waitlist data. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven at API level by backend/services/registration/tests/api/r6Cards.test.ts › R6-T5 shows the owning organiser and the assigned coordinator the waitlist in the order it was joined, and nobody else, which passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 (commit d7abf51). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
