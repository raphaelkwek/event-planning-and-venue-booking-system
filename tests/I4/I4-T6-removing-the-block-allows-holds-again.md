# I4-T6 — Once the block is removed, a hold over its period can be requested and placed again

## Specification

| Item | Content |
|---|---|
| Test Case ID | I4-T6 |
| Test Scenario | Once the block is removed, a hold over its period can be requested and placed again |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. A block recorded at `Lee Kong Chian Auditorium`, 2 December 2026 16:00–19:00, Maintenance, `Stage rigging inspection`.<br>4. A hold request for 14:00–18:00 refused over it (I4-T1). |
| Test Steps | 1. As `venuestaff@`, remove the block (I2).<br>2. As the coordinator, request a hold at the venue for 2 December 2026, 14:00–18:00, reminder 60 minutes.<br>3. As `venuestaff@`, place it with expiry 1 December 2026 18:00. |
| Test Data | Block removed |
| Expected Result | The request is created, and placing it succeeds: the hold is Held. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The request was refused over the block (VENUE_UNAVAILABLE). After its removal HLD-000551 was requested and placed: HELD. |
| Status | Pass |
| Remarks | Commit: 1a6f807 · Evidence: tests/I4/evidence/I4-T6.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-24 |
