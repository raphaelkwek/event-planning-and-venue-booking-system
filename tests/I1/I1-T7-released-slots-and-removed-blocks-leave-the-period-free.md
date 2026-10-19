# I1-T7 — A released slot and a removed block do not commit the venue

## Specification

| Item | Content |
|---|---|
| Test Case ID | I1-T7 |
| Test Scenario | A released slot and a removed block do not commit the venue |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-CALENDAR completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open the venue's availability, as in I1-T1 steps 1 to 3.<br>2. Show 11 December 2026 to 11 December 2026. |
| Test Data | Account: `coordinator@connectsphere.test` · Guest Lecture's released slot, Friday 11 December 10:00–12:00 · A removed Safety block `Fire drill`, Friday 11 December 14:00–15:00 |
| Expected Result | Friday's "Committed" list has only the two "Outside operating hours" rows. Neither the guest lecture's reference nor `Fire drill` appears anywhere. The free period is `08:00–22:00`. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Friday's Committed list had only 00:00–08:00 Outside operating hours and 22:00–24:00 Outside operating hours. Neither EVT-006671 nor "Fire drill" appeared. The free period was 08:00–22:00. |
| Status | Pass |
| Remarks | Commit: ac840b7 · Evidence: tests/I1/evidence/I1-T7.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-07 |
