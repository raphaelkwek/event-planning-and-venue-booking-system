# I1-T6 — Periods outside the venue's operating hours are shown as unavailable, including a closed day

## Specification

| Item | Content |
|---|---|
| Test Case ID | I1-T6 |
| Test Scenario | Periods outside the venue's operating hours are shown as unavailable, including a closed day |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-CALENDAR completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open the venue's availability, as in I1-T1 steps 1 to 3.<br>2. Show 11 December 2026 to 13 December 2026. |
| Test Data | Account: `coordinator@connectsphere.test` · The standard venue's hours: Monday to Friday 08:00–22:00, Saturday 09:00–18:00, Sunday closed |
| Expected Result | Friday's "Committed" list has `00:00–08:00` and `22:00–24:00`, both marked "Outside operating hours", and its only free period is `08:00–22:00`. Saturday's has `00:00–09:00` and `18:00–24:00` marked "Outside operating hours". Sunday's has `00:00–24:00` marked "Outside operating hours" (closed), and Sunday shows "No free periods". |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Friday: 00:00–08:00 Outside operating hours; 22:00–24:00 Outside operating hours, free 08:00–22:00. Saturday began "00:00–09:00 Outside operating hours" and ended "18:00–24:00 Outside operating hours". Sunday: "00:00–24:00 Outside operating hours Closed all day", and "No free periods". |
| Status | Pass |
| Remarks | Commit: ac840b7 · Evidence: tests/I1/evidence/I1-T6.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-07 |
