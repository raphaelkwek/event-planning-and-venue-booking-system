# I4-T5 — Holds that exist when a block is created are flagged, not refused or released (I2)

## Specification

| Item | Content |
|---|---|
| Test Case ID | I4-T5 |
| Test Scenario | Holds that exist when a block is created are flagged, not refused or released (I2) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The coordinator has requested two holds at `Lee Kong Chian Auditorium`: one for 2 December 2026 14:00–18:00, placed by `venuestaff@` with expiry 1 December 2026 18:00 (Held), and one for 3 December 2026 14:00–18:00, left Requested.<br>4. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Record a block at the venue on 2 December 2026, 16:00–19:00, Maintenance, `Stage rigging inspection`, confirming the review of what it disrupts (I2).<br>2. In the SQL editor, read each hold's status and its slot's status and Requires Reconfirmation flag. |
| Test Data | Block 16:00–19:00 on 2 December · Held hold on 2 December · Requested hold on 3 December |
| Expected Result | The block is created. The Held hold is still `HELD` with its slot flagged Requires Reconfirmation, and the coordinator is notified (I2). The hold on 3 December is untouched, still `REQUESTED`: it reserves nothing, so the block doesn't disrupt it. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | After the block: HLD-000549 is HELD with its slot HELD and flagged Requires Reconfirmation; HLD-000550, at another venue and Requested, is untouched. |
| Status | Pass |
| Remarks | Commit: 1a6f807 · Evidence: tests/I4/evidence/I4-T5.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-24 |
