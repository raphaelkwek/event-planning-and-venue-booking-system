# I4-T4 — A hold whose period only touches a block is requested and placed (boundary: exactly touching)

## Specification

| Item | Content |
|---|---|
| Test Case ID | I4-T4 |
| Test Scenario | A hold whose period only touches a block is requested and placed (boundary: exactly touching) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed, with setup and turnaround 0 at `Lee Kong Chian Auditorium`.<br>3. A block recorded at the venue, 2 December 2026 12:00–14:00, Maintenance, `Stage rigging inspection`.<br>4. Signed in as FX-BOOKING's assigned coordinator. |
| Test Steps | 1. Request a hold at `Lee Kong Chian Auditorium`, 2 December 2026, 14:00–18:00, reminder 60 minutes.<br>2. As `venuestaff@`, place it with expiry 1 December 2026 18:00. |
| Test Data | Hold 14:00–18:00 · Block 12:00–14:00, touching at 14:00 |
| Expected Result | The hold is requested, then placed: it is Held with the expiry given. The block does not overlap it, because the periods only touch at 14:00. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | HLD-000548 was requested, then placed: it is HELD with a slot. The block 12:00–14:00 only touches it at 14:00. |
| Status | Pass |
| Remarks | Commit: 1a6f807 · Evidence: tests/I4/evidence/I4-T4.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-24 |
