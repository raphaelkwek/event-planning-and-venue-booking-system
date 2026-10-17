# L1-T11 — Only the coordinator assigned to the event can raise a booking request for it; nothing is stored for anyone else

## Specification

| Item | Content |
|---|---|
| Test Case ID | L1-T11 |
| Test Scenario | Only the coordinator assigned to the event can raise a booking request for it; nothing is stored for anyone else |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed. Note the event's id, and which coordinator is assigned. |
| Test Steps | 1. Sign in as the other seeded coordinator, open the request from "All events", and look for "Venue requests".<br>2. Open the API console and send `POST /venue/api/v1/booking-requests` with L1-T10's body, without `replacesBookingId`.<br>3. Sign out, sign in as `organiser@connectsphere.test` (the owner), and send the same request.<br>4. In the SQL editor, count the event's booking requests. |
| Test Data | Accounts: the other seeded coordinator; `organiser@connectsphere.test` |
| Expected Result | The unassigned coordinator's page offers no "Venue requests". The API refuses the unassigned coordinator with `403` `ROLE_NOT_AUTHORISED`, saying only the event's assigned coordinator can request a venue, and refuses the organiser with `403` `ROLE_NOT_AUTHORISED`. The event has no booking requests. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | coordinator2@connectsphere.test's review page offered no "Venue requests". The API refused them with 403 ROLE_NOT_AUTHORISED: "Only the event's assigned coordinator can request a venue for it." and the organiser with 403 ROLE_NOT_AUTHORISED. The event had no booking requests. |
| Status | Pass |
| Remarks | Commit: ff9e786 · Evidence: tests/L1/evidence/L1-T11.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-18 |
