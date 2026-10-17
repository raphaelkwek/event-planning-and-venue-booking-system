# L1-T4 — Changing the times or attendance flags the request as differing from the event, and Venue Staff see the differing values

## Specification

| Item | Content |
|---|---|
| Test Case ID | L1-T4 |
| Test Scenario | Changing the times or attendance flags the request as differing from the event, and Venue Staff see the differing values |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. Signed in as the assigned coordinator, on the event's "Request a venue" form. |
| Test Steps | 1. Choose Venue `Lee Kong Chian Auditorium` and Room layout `Theatre`.<br>2. Change End time to `19:00` and Expected attendance to `180`, and click "Submit request".<br>3. Sign out, sign in as `venuestaff@connectsphere.test`, and open "Booking requests". |
| Test Data | Account: the assigned coordinator, then `venuestaff@connectsphere.test` · The event ends at 18:00 with attendance 150 |
| Expected Result | The coordinator's list marks the request "Differs from the event". In the Venue Staff queue the request is marked "Differs from the event" and shows each differing value against the event's: end 19:00 (event 18:00) and attendance 180 (event 150). The unchanged start time is not listed as differing. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The coordinator's list marked BKR-000411 "Differs from the event". The Venue Staff queue marked it too and listed "End 19:00 (event 18:00)" and "Attendance 180 (event 150)", and no start time. |
| Status | Pass |
| Remarks | Commit: ff9e786 · Evidence: tests/L1/evidence/L1-T4.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-17 |
