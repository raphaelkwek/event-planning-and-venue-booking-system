# L1-T11 — Only the coordinator assigned to the event can raise a booking request for it; nothing is stored for anyone else

## Specification

| Item | Content |
|---|---|
| Test Case ID | L1-T11 |
| Test Scenario | Only the coordinator assigned to the event can raise a booking request for it; nothing is stored for anyone else |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed. Note the event's id, and which coordinator is assigned. |
| Test Steps | 1. Sign in as the other seeded coordinator and look for the request in "All events".<br>2. Open the API console and send `POST /venue/api/v1/booking-requests` with L1-T10's body, without `replacesBookingId`.<br>3. Sign out, sign in as `organiser@connectsphere.test` (the owner), and send the same request.<br>4. In the SQL editor, count the event's booking requests. |
| Test Data | Accounts: the other seeded coordinator; `organiser@connectsphere.test` |
| Expected Result | The request is not in the other coordinator's "All events". The API refuses them with `404` `EVENT_NOT_FOUND`, "No event with that reference is assigned to you.", and refuses the organiser with `403` `ROLE_NOT_AUTHORISED`. The event has no booking requests. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

> **Revised for A4 (CR-05) on 2 Nov 2026.** The other coordinator no longer sees the event at all, and the API answers 404 as for an unknown event.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Expected result revised for A4 (CR-05) on 2026-11-02; the earlier run checked the superseded behaviour. Re-run against the A4 build. |
| Executed By | |
| Date of Execution | |
