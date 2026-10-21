# L4-T6 — Withdrawing one venue's request leaves the event's other arrangements unchanged

## Specification

| Item | Content |
|---|---|
| Test Case ID | L4-T6 |
| Test Scenario | Withdrawing one venue's request leaves the event's other arrangements unchanged |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. A confirmed booking at `Lee Kong Chian Auditorium` 14:00–18:00 (L4-T5 pre-condition 3), and pending requests for `Seminar Room 2-1`, Classroom, 40, and `Mochtar Riady Hall`, Theatre, 150, both 14:00–18:00.<br>4. Signed in as FX-BOOKING's coordinator. |
| Test Steps | 1. Open the event's Venue requests.<br>2. Withdraw the `Seminar Room 2-1` request (L2).<br>3. Read every arrangement's status. |
| Test Data | Withdraw `Seminar Room 2-1` only |
| Expected Result | `Seminar Room 2-1` is Withdrawn. The `Mochtar Riady Hall` request is still Pending and the `Lee Kong Chian Auditorium` booking still Confirmed, with their periods unchanged. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-21 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | After withdrawing BKR-003319: Lee Kong Chian Auditorium APPROVED, Seminar Room 2-1 WITHDRAWN, Mochtar Riady Hall PENDING; BKR-003320 is still Pending and the Lee Kong Chian Auditorium booking still CONFIRMED, 14:00–18:00. |
| Status | Pass |
| Remarks | Commit: 333eb08 · Evidence: tests/L4/evidence/L4-T6.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-21 |
