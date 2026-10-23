# I4-T3 — CR-01: a hold is refused when its occupied period, widened by the venue's setup time, overlaps a block its own period doesn't

## Specification

| Item | Content |
|---|---|
| Test Case ID | I4-T3 |
| Test Scenario | CR-01: a hold is refused when its occupied period, widened by the venue's setup time, overlaps a block its own period doesn't |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. `Lee Kong Chian Auditorium`'s setup time set to 30 minutes (H3-T1).<br>4. A block recorded at the venue, 2 December 2026 13:00–13:45, Maintenance, `Projector replacement` (I2).<br>5. Signed in as FX-BOOKING's assigned coordinator. |
| Test Steps | 1. Request a hold at `Lee Kong Chian Auditorium`, 2 December 2026, 14:00–18:00, reminder 60 minutes. |
| Test Data | Setup 30 · Hold 14:00–18:00, occupied from 13:30 · Block 13:00–13:45 |
| Expected Result | The request is refused, naming the block "Projector replacement" and its period 13:00–13:45: the hold's occupied period starts at 13:30, before the block ends, although its own period starts at 14:00. No hold is stored. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
