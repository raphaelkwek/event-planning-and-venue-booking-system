# I4-T7 — A block at one venue doesn't refuse a hold at another venue (partition: a different venue)

## Specification

| Item | Content |
|---|---|
| Test Case ID | I4-T7 |
| Test Scenario | A block at one venue doesn't refuse a hold at another venue (partition: a different venue) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. A block recorded at `Seminar Room 2-1`, 2 December 2026 14:00–18:00, Maintenance, `Whiteboard replacement`.<br>4. Signed in as FX-BOOKING's assigned coordinator. |
| Test Steps | 1. Request a hold at `Lee Kong Chian Auditorium`, 2 December 2026, 14:00–18:00, reminder 60 minutes. |
| Test Data | Block at `Seminar Room 2-1` only |
| Expected Result | The hold is requested: the block belongs to another venue. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | HLD-000552 at Lee Kong Chian Auditorium was requested; the block belongs to Seminar Room 2-1. |
| Status | Pass |
| Remarks | Commit: 1a6f807 · Evidence: tests/I4/evidence/I4-T7.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-24 |
