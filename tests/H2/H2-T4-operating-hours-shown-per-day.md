# H2-T4 — Opening hours are shown for each day of the week

## Specification

| Item | Content |
|---|---|
| Test Case ID | H2-T4 |
| Test Scenario | Opening hours are shown for each day of the week |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed; signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click "Venues", then "View" on `Lee Kong Chian Auditorium`.<br>2. Look at "Operating hours". |
| Test Data | Standard venue hours |
| Expected Result | Seven rows, Monday to Sunday: Monday to Friday 08:00–22:00, Saturday 09:00–18:00, Sunday Closed. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Seven rows: Monday 08:00–22:00; Tuesday 08:00–22:00; Wednesday 08:00–22:00; Thursday 08:00–22:00; Friday 08:00–22:00; Saturday 09:00–18:00; Sunday Closed. |
| Status | Pass |
| Remarks | Commit: ca285fa · Evidence: tests/H2/evidence/H2-T4.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-05 |
