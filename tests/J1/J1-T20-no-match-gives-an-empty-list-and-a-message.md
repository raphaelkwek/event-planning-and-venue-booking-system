# J1-T20 — When nothing matches, the list is empty and a message restates the filters, not an error

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T20 |
| Test Scenario | When nothing matches, the list is empty and a message restates the filters, not an error |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `science` in Building / location.<br>3. Enter `500` in Minimum capacity.<br>4. Choose `Theatre` in Layout.<br>5. Tick `Projector` under Facilities.<br>6. Set From to 14 December 2026, 12:00 and To to 14 December 2026, 14:00.<br>7. Click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` |
| Expected Result | The list is empty. A message states that no venue matches and names every filter applied: the building `science`, a minimum capacity of 500, the layout Theatre, the facility Projector and the window 14 December 2026 12:00–14:00. It is an informational message, not a red error, and no error code is shown. Changing a filter and clicking “Search” shows the new result. |
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
