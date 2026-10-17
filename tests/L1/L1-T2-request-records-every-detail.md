# L1-T2 — The request records the venue, date, start and end time, room layout, expected attendance, and the required facilities and accessibility features

## Specification

| Item | Content |
|---|---|
| Test Case ID | L1-T2 |
| Test Scenario | The request records the venue, date, start and end time, room layout, expected attendance, and the required facilities and accessibility features |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. Signed in as the assigned coordinator, on the event's "Request a venue" form. |
| Test Steps | 1. Choose Venue `Lee Kong Chian Auditorium` and Room layout `Classroom`.<br>2. Tick Facilities `Projector` and `Wireless microphones`, and Accessibility features `Step-free access` and `Hearing loop`.<br>3. Click "Submit request".<br>4. Sign out, sign in as `venuestaff@connectsphere.test`, and open "Booking requests". |
| Test Data | Account: the assigned coordinator, then `venuestaff@connectsphere.test` |
| Expected Result | The Venue Staff queue's row for the new request shows `Lee Kong Chian Auditorium`, Wednesday 2 December 2026 14:00–18:00, layout Classroom, 150 attending, facilities Projector and Wireless microphones, accessibility Step-free access and Hearing loop. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The Venue Staff queue's row for BKR-000409 read: "BKR-000409EVT-007959Lee Kong Chian AuditoriumWednesday 2 December 2026, 14:00–18:00Classroom150 attendingProjector, Wireless microphonesStep-free access, Hearing loopCoordinator One10/18/2026, 1:31:06 AMApprove Reject". |
| Status | Pass |
| Remarks | Commit: ff9e786 · Evidence: tests/L1/evidence/L1-T2.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-17 |
