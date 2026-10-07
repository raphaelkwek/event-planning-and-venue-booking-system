# I1-T1 — An Event Coordinator selects a venue and a week and sees each day's committed and free periods

## Specification

| Item | Content |
|---|---|
| Test Case ID | I1-T1 |
| Test Scenario | An Event Coordinator selects a venue and a week and sees each day's committed and free periods |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-CALENDAR completed (`tests/I1/README.md`). Note the references it returns.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click "Venues".<br>2. Click "View" on `Lee Kong Chian Auditorium`.<br>3. Click "Availability".<br>4. Set From to 7 December 2026 and To to 13 December 2026.<br>5. Click "Show". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` · The standard venue · Range Monday 7 to Sunday 13 December 2026 · The FX-CALENDAR week (`tests/I1/README.md`) |
| Expected Result | Seven days are shown in order, Monday 7 December to Sunday 13 December 2026. Each day has a "Committed" list and a "Free" list. The free periods are exactly: Monday 08:00–09:30, 12:30–13:45 and 16:45–22:00; Tuesday 08:00–09:00 and 13:00–22:00; Wednesday 08:00–18:00; Thursday 12:00–22:00; Friday 08:00–22:00; Saturday 09:00–15:00; Sunday none ("No free periods"). Every committed period in the README's table is listed under its day. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Seven days were shown, Monday 7 December 2026 to Sunday 13 December 2026, each with a Committed and a Free list. Free periods: Monday 08:00–09:30, 12:30–13:45, 16:45–22:00; Tuesday 08:00–09:00, 13:00–22:00; Wednesday 08:00–18:00; Thursday 12:00–22:00; Friday 08:00–22:00; Saturday 09:00–15:00; Sunday "No free periods". Every committed period in the README's table was listed under its day. |
| Status | Pass |
| Remarks | Commit: ac840b7 · Evidence: tests/I1/evidence/I1-T1.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-07 |
