# J1-T10 — Only venues meeting every selected filter are returned

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T10 |
| Test Scenario | Only venues meeting every selected filter are returned |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `science` in Building / location.<br>3. Enter `100` in Minimum capacity.<br>4. Choose `Classroom` in Layout.<br>5. Tick `Projector` under Facilities.<br>6. Tick `Hearing loop` under Accessibility features.<br>7. Set From to 16 December 2026, 10:00 and To to 16 December 2026, 11:00.<br>8. Click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Auditorium meets all of these; FX Seminar Room is in the building but its Classroom layout holds 40 and it has no hearing loop |
| Expected Result | FX Auditorium only. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
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
