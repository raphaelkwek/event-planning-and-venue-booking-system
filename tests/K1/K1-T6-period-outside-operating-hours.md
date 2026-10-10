# K1-T6 — A period starting before opening or ending after closing is Not suitable, with the period and the day's hours shown

## Specification

| Item | Content |
|---|---|
| Test Case ID | K1-T6 |
| Test Scenario | A period starting before opening or ending after closing is Not suitable, with the period and the day's hours shown |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUITABILITY loaded (see README).<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open **Venues** and select `K1 Test Hall`.<br>2. In the "Suitability" section choose the event from the list.<br>3. Click **Check suitability**. |
| Test Data | Event `K1-E-EARLY`: Monday 7 Dec 2026 07:30–10:00 (Monday hours 08:00–22:00).<br>Event `K1-E-LATE`: Monday 7 Dec 2026 20:00–22:30.<br>Event `K1-E-SUNDAY`: Sunday 13 Dec 2026 10:00–12:00 (closed).<br>Run the check once per event. |
| Expected Result | Each reads **Not suitable** with one reason naming the requested period and the hours it was compared with: Monday 08:00–22:00 for the first two, and "closed" for Sunday. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | UI walk-through in Chrome pending at the sprint review |
| Executed By | |
| Date of Execution | |
