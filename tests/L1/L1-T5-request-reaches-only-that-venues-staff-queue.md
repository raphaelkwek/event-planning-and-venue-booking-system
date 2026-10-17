# L1-T5 — The request appears in the queue of the venue's own Venue Staff, and not for a venue they don't look after

## Specification

| Item | Content |
|---|---|
| Test Case ID | L1-T5 |
| Test Scenario | The request appears in the queue of the venue's own Venue Staff, and not for a venue they don't look after |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed, including `Mochtar Riady Hall`, which `venuestaff@connectsphere.test` doesn't look after.<br>3. The assigned coordinator has submitted two requests: `Lee Kong Chian Auditorium` (Theatre) and `Mochtar Riady Hall` (Theatre), both with the event's times. |
| Test Steps | 1. Sign in as `venuestaff@connectsphere.test` and open "Booking requests". |
| Test Data | Account: `venuestaff@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | The queue lists the `Lee Kong Chian Auditorium` request with its booking reference and the event's reference. It doesn't list the `Mochtar Riady Hall` request. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The queue listed BKR-000412 for Lee Kong Chian Auditorium with the event's reference EVT-007962, and did not list BKR-000413 for Mochtar Riady Hall. |
| Status | Pass |
| Remarks | Commit: ff9e786 · Evidence: tests/L1/evidence/L1-T5.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-17 |
