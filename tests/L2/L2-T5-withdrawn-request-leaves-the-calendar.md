# L2-T5 — A withdrawn request no longer appears as pending on the availability calendar

## Specification

| Item | Content |
|---|---|
| Test Case ID | L2-T5 |
| Test Scenario | A withdrawn request no longer appears as pending on the availability calendar |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator has submitted a request for `Lee Kong Chian Auditorium` with the event's times, and it shows as Pending on 2 December 2026 (L1-T6). |
| Test Steps | 1. As the assigned coordinator, withdraw the request.<br>2. Open `Lee Kong Chian Auditorium`'s availability for 2 December 2026 again. |
| Test Data | Account: the assigned coordinator |
| Expected Result | Wednesday 2 December 2026 has no Pending row, and 08:00–22:00 is free. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | After withdrawing BKR-000429, Wednesday 2 December 2026 had no Pending row (Committed: 00:00–08:00 Outside operating hours; 22:00–24:00 Outside operating hours) and was free 08:00–22:00. |
| Status | Pass |
| Remarks | Commit: ff9e786 · Evidence: tests/L2/evidence/L2-T5.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-18 |
