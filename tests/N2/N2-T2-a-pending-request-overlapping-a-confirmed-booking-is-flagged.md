# N2-T2 — A pending request whose period overlaps a confirmed booking at the venue is flagged, naming the booking and its period

## Specification

| Item | Content |
|---|---|
| Test Case ID | N2-T2 |
| Test Scenario | A pending request whose period overlaps a confirmed booking at the venue is flagged, naming the booking and its period |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The N1 booking statement run with start 13:00, end 15:00, setup 0 and turnaround 0. The booking's reference is `N1-FX-` followed by the returned event reference.<br>4. FX-BOOKING's coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00.<br>5. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests".<br>2. Read the request's row. |
| Test Data | The confirmed booking is 13:00–15:00 |
| Expected Result | The row shows "Conflict" and reads "Conflicts with N1-FX-EVT-… (confirmed booking), Wednesday 2 December 2026, 13:00–15:00". |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-21 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
