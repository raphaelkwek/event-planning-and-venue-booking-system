# I4-T1 — Requesting a hold over an active block is refused, naming the block, its period and its reason type, and nothing is stored

## Specification

| Item | Content |
|---|---|
| Test Case ID | I4-T1 |
| Test Scenario | Requesting a hold over an active block is refused, naming the block, its period and its reason type, and nothing is stored |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`).<br>3. A block recorded at `Lee Kong Chian Auditorium`, 2 December 2026 16:00–19:00, reason type Maintenance, description `Stage rigging inspection` (I2).<br>4. Signed in as FX-BOOKING's assigned coordinator. |
| Test Steps | 1. Open the event and click "Venue requests", then "Request a hold".<br>2. Choose `Lee Kong Chian Auditorium`, date 2 December 2026, start 14:00, end 18:00, reminder 60 minutes, and click "Request hold".<br>3. In the SQL editor, count the event's holds. |
| Test Data | Hold 14:00–18:00 · Block 16:00–19:00 |
| Expected Result | The request is refused with a message naming the venue, the reason type "Maintenance", "Stage rigging inspection" and the period Wednesday 2 December 2026, 16:00–19:00. The form stays open. The event has no holds. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The form showed "Lee Kong Chian Auditorium is unavailable for Maintenance, “Stage rigging inspection” (Wednesday 2 December 2026, 16:00–19:00), so a hold can't be requested for this period. Choose another time or venue.". The form stayed open and the event has no holds. |
| Status | Pass |
| Remarks | Commit: 1a6f807 · Evidence: tests/I4/evidence/I4-T1.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-24 |
