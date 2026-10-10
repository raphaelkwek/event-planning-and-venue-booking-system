# K1-T3 — Boundary: expected attendance exactly equal to the layout's capacity is not a failure

## Specification

| Item | Content |
|---|---|
| Test Case ID | K1-T3 |
| Test Scenario | Boundary: expected attendance exactly equal to the layout's capacity is not a failure |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUITABILITY loaded (see README).<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open **Venues** and select `K1 Test Hall`.<br>2. In the "Suitability" section choose the event from the list.<br>3. Click **Check suitability**. |
| Test Data | Event `K1-E-EXACT`: 120 attendees, Theatre layout (capacity 120), otherwise meeting every requirement.<br>Then repeat for `K1-E-ONEOVER`: 121 attendees, Theatre layout. |
| Expected Result | `K1-E-EXACT` reads **Suitable** with no reasons. `K1-E-ONEOVER` reads **Not suitable** with one reason: expected attendance 121 against layout capacity 120. |
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
