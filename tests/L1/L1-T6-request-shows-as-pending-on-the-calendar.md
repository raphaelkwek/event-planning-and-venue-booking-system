# L1-T6 — The request appears as pending on the venue's availability calendar, labelled with the event reference

## Specification

| Item | Content |
|---|---|
| Test Case ID | L1-T6 |
| Test Scenario | The request appears as pending on the venue's availability calendar, labelled with the event reference |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed. Note the event's reference.<br>3. The assigned coordinator has submitted a request for `Lee Kong Chian Auditorium` with the event's times. |
| Test Steps | 1. As the assigned coordinator, open "Venues", "View" on `Lee Kong Chian Auditorium`, then "Availability".<br>2. Show 2 December 2026 to 2 December 2026. |
| Test Data | Account: the assigned coordinator |
| Expected Result | Wednesday 2 December 2026's Committed list has `14:00–18:00` marked "Pending" and labelled with the event's reference. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Wednesday 2 December 2026's Committed list read: 00:00–08:00 Outside operating hours; 14:00–18:00 Pending EVT-007963; 22:00–24:00 Outside operating hours. |
| Status | Pass |
| Remarks | Commit: ff9e786 · Evidence: tests/L1/evidence/L1-T6.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-18 |
