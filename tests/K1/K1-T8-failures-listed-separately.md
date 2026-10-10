# K1-T8 — Several failing conditions are each listed as their own reason

## Specification

| Item | Content |
|---|---|
| Test Case ID | K1-T8 |
| Test Scenario | Several failing conditions are each listed as their own reason |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUITABILITY loaded (see README).<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open **Venues** and select `K1 Test Hall`.<br>2. In the "Suitability" section choose the event from the list.<br>3. Click **Check suitability**. |
| Test Data | Event `K1-E-ALLWRONG`: 150 attendees, Theatre layout, needs Simultaneous interpretation, needs Braille signage, Monday 7 Dec 2026 07:00–09:00 |
| Expected Result | **Not suitable**. Four separate reasons are listed, one each for attendance (150 against 120), facility (Simultaneous interpretation), accessibility (Braille signage) and operating hours (07:00–09:00 against 08:00–22:00). They are not merged into one generic message. |
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
