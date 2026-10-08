# I1-T12 — Boundary: a one-day range shows only that day, and a block that started the day before is shown from midnight

## Specification

| Item | Content |
|---|---|
| Test Case ID | I1-T12 |
| Test Scenario | Boundary: a one-day range shows only that day, and a block that started the day before is shown from midnight |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-CALENDAR completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open the venue's availability, as in I1-T1 steps 1 to 3.<br>2. Set From and To both to 10 December 2026.<br>3. Click "Show". |
| Test Data | Account: `coordinator@connectsphere.test` · The renovation block, Wednesday 9 December 18:00 to Thursday 10 December 12:00 |
| Expected Result | Exactly one day is shown, Thursday 10 December 2026. Its "Committed" list has `00:00–12:00` marked "Renovation" with `Seat replacement`, and `22:00–24:00` marked "Outside operating hours". Its only free period is `12:00–22:00`. Wednesday is not shown. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Only Thursday 10 December 2026 was shown. Its Committed list was 00:00–08:00 Outside operating hours; 00:00–12:00 Renovation Seat replacement; 22:00–24:00 Outside operating hours, and its only free period 12:00–22:00. |
| Status | Pass |
| Remarks | Commit: ac840b7 · Evidence: tests/I1/evidence/I1-T12.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-07 |
