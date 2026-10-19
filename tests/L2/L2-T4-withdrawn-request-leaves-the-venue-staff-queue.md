# L2-T4 — A withdrawn request no longer appears in the Venue Staff queue

## Specification

| Item | Content |
|---|---|
| Test Case ID | L2-T4 |
| Test Scenario | A withdrawn request no longer appears in the Venue Staff queue |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator has submitted a request for `Lee Kong Chian Auditorium`. Note its booking reference.<br>4. `venuestaff@connectsphere.test` sees it under "Booking requests" (L1-T5). |
| Test Steps | 1. As the assigned coordinator, withdraw the request.<br>2. As `venuestaff@connectsphere.test`, open "Booking requests" again. |
| Test Data | Accounts: the assigned coordinator, then `venuestaff@connectsphere.test` |
| Expected Result | The queue no longer lists the booking reference. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Before the withdrawal the queue listed BKR-001390; afterwards it didn't. |
| Status | Pass |
| Remarks | Commit: 73c1d60 · Evidence: tests/L2/evidence/L2-T4.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
