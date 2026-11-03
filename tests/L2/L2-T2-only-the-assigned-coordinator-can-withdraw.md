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
| Actual Result | |
| Status | Not Executed |
| Remarks | Expected result revised for A4 (CR-05) on 2026-11-02; the earlier run checked the superseded behaviour. Re-run against the A4 build. |
| Executed By | |
| Date of Execution | |
