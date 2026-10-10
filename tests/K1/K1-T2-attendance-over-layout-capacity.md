# K1-T2 — Expected attendance above the selected layout's capacity is Not suitable, with both numbers shown

## Specification

| Item | Content |
|---|---|
| Test Case ID | K1-T2 |
| Test Scenario | Expected attendance above the selected layout's capacity is Not suitable, with both numbers shown |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUITABILITY loaded (see README).<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open **Venues** and select `K1 Test Hall`.<br>2. In the "Suitability" section choose the event from the list.<br>3. Click **Check suitability**. |
| Test Data | Event `K1-E-BIG`: 150 attendees, Theatre layout (capacity 120 at `K1 Test Hall`), otherwise meeting every requirement |
| Expected Result | The result reads **Not suitable**. One reason is listed: expected attendance 150 against layout capacity 120 (layout Theatre). No other reason is listed. |
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
