# I4-T2 — Placing a requested hold is refused once a block covers its period, and the hold stays Requested

## Specification

| Item | Content |
|---|---|
| Test Case ID | I4-T2 |
| Test Scenario | Placing a requested hold is refused once a block covers its period, and the hold stays Requested |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The coordinator has requested a hold at `Lee Kong Chian Auditorium`, 2 December 2026 14:00–18:00, reminder 60 minutes. It is Requested.<br>4. A block then recorded at the venue, 2 December 2026 16:00–19:00, Maintenance, `Stage rigging inspection` (I2).<br>5. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Hold requests".<br>2. On the hold's row, set the expiry to 1 December 2026 at 18:00 and click "Place hold".<br>3. In the SQL editor, read the hold's status and whether a venue slot exists for it. |
| Test Data | Expiry 1 December 2026 18:00 |
| Expected Result | Placing is refused with a message naming the block's reason type, description and period, and saying the hold stays Requested. The hold is `REQUESTED` with no slot, and still listed under "Hold requests". |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | On the hold's row: "Lee Kong Chian Auditorium is unavailable for Maintenance, “Stage rigging inspection” (Wednesday 2 December 2026, 16:00–19:00), so HLD-000547 can't be placed for this period. It stays Requested.". The hold is REQUESTED with no slot, still listed under Hold requests. |
| Status | Pass |
| Remarks | Commit: 1a6f807 · Evidence: tests/I4/evidence/I4-T2.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-24 |
