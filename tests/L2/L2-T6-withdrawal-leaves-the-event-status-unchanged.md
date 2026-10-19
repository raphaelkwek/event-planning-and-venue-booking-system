# L2-T6 — Withdrawing a request doesn't change the event's status

## Specification

| Item | Content |
|---|---|
| Test Case ID | L2-T6 |
| Test Scenario | Withdrawing a request doesn't change the event's status |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed; the event is Approved.<br>3. FX-SEEDED run with `'PLANNING'` ending `now() + interval '30 days'`, then an assignment added for it with the L2 assignment statement, naming the coordinator assigned to FX-BOOKING's event. Both events have a pending request for `Lee Kong Chian Auditorium` at their own times. |
| Test Steps | 1. As the assigned coordinator, withdraw both requests.<br>2. Open each event and note its status. |
| Test Data | Account: the coordinator assigned to both events · Statuses Approved and Planning |
| Expected Result | The Approved event is still Approved and the Planning event still Planning. Neither event's status history has a new entry. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | After both withdrawals the events showed Approved and Planning, and neither had a new status history entry. |
| Status | Pass |
| Remarks | Commit: ba2d786 · Evidence: tests/L2/evidence/L2-T6.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
