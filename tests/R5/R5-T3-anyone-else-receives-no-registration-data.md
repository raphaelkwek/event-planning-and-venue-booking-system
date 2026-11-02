# R5-T3 — Another organiser, an unassigned coordinator and an attendee receive no registration data

## Specification

| Item | Content |
|---|---|
| Test Case ID | R5-T3 |
| Test Scenario | Another organiser, an unassigned coordinator and an attendee receive no registration data |
| Pre-conditions | 1. R5-T1's pre-conditions 1–3. |
| Test Steps | 1. Sign in as `organiser2@connectsphere.test` and open the list as in R5-T1.<br>2. Sign in as `coordinator2@connectsphere.test` and open it.<br>3. Sign in as `attendee@connectsphere.test` and open it. |
| Test Data | Organiser Two (not the owner), Coordinator Two (not assigned), Attendee One |
| Expected Result | Steps 1 and 2: `This event's registrations are not available to you`, no names, rows or totals (404 from the API). Step 3: the attendee has no route to the screen, and the API refuses the role (403). No response carries any registration. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven at API level by backend/services/registration/tests/api/r5Cards.test.ts › R5-T3 gives another organiser, an unassigned coordinator and an attendee no registration data, which passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 (commit d7abf51). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
