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
| Actual Result | Organiser Two and Coordinator Two each saw `This event's registrations are not available to you`, with no table, totals or attendee name; the screen's registrations and waitlist requests both answered 404 `EVENT_NOT_FOUND` with no items or totals. Attendee One opening the address was sent to Events (no Registrations screen), and the API console's GET of the event's registrations answered 403 `ROLE_NOT_AUTHORISED` with no registration data. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: a406635 · Evidence: tests/e2e/r-management.spec.ts › R5-T3 another organiser, an unassigned coordinator and an attendee receive no registration data, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41773031885 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
