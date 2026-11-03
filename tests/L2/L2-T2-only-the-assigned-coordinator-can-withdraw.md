# L2-T2 — Only the event's assigned coordinator can withdraw its pending request; anyone else is refused and nothing changes

## Specification

| Item | Content |
|---|---|
| Test Case ID | L2-T2 |
| Test Scenario | Only the event's assigned coordinator can withdraw its pending request; anyone else is refused and nothing changes |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator has submitted a request for `Lee Kong Chian Auditorium`. Note its id (the last part of `POST`'s response, or the SQL editor). |
| Test Steps | 1. Sign in as the other seeded coordinator. Open the API console and send `POST /venue/api/v1/booking-requests/<id>/withdraw`.<br>2. Sign out, sign in as `organiser@connectsphere.test`, and send the same request.<br>3. Sign out, sign in as `venuestaff@connectsphere.test`, and send the same request.<br>4. In the SQL editor, read the request's status. |
| Test Data | Accounts: the other seeded coordinator, `organiser@connectsphere.test`, `venuestaff@connectsphere.test` |
| Expected Result | The coordinator is refused with `404` `BOOKING_REQUEST_NOT_FOUND`, "No booking request with that id is on an event assigned to you.". The organiser and Venue Staff are refused with `403` `ROLE_NOT_AUTHORISED`. The request is still `PENDING`, with no withdrawal recorded. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

> **Revised for A4 (CR-05) on 2 Nov 2026.** The other coordinator gets 404, as for an unknown request, rather than 403.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The other coordinator's withdrawal returned 404 BOOKING_REQUEST_NOT_FOUND with `No booking request with that id is on an event assigned to you.`; the organiser and Venue Staff each got 403 ROLE_NOT_AUTHORISED; SQL showed the request still PENDING with no withdrawal recorded. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/e-access-and-console.spec.ts › L2-T2 only the event's assigned coordinator can withdraw its pending request; anyone else is refused, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
