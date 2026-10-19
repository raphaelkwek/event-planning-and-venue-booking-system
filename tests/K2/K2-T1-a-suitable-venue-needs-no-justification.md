# K2-T1 — A request for a suitable venue needs no justification

## Specification

| Item | Content |
|---|---|
| Test Case ID | K2-T1 |
| Test Scenario | A request for a suitable venue needs no justification |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. Signed in as the assigned coordinator, on the event's "Request a venue" form (the event → "Venue requests" → "Request a venue"). |
| Test Steps | 1. Choose Venue `Lee Kong Chian Auditorium`. Leave Room layout `Theatre`, the date, times and attendance as the event's.<br>2. Click "Submit request".<br>3. Sign out, sign in as `venuestaff@connectsphere.test` and open "Booking requests". |
| Test Data | Account: the assigned coordinator, then `venuestaff@connectsphere.test` |
| Expected Result | Step 1 shows no Justification box. Step 2 returns to the event's venue requests with "Booking request BKR-… submitted." and the request Pending. In step 3 the request's row shows the suitability "Suitable" and no justification. |
| Created By | Yichen, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | |
| Executed By | |
| Date of Execution | |
