# J1-T22 — Pre-filled filters can be changed and the search run again

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T22 |
| Test Scenario | Pre-filled filters can be changed and the search run again |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. FX-SEARCH-EVENT completed.<br>4. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open `FX Symposium` and click “Find a venue”, as in J1-T21.<br>2. Clear Layout (choose “Any layout”).<br>3. Change Minimum capacity to `50`.<br>4. Untick `Wireless microphones` and `Hearing loop`.<br>5. Click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` |
| Expected Result | The fields accept the changes. The results are FX Auditorium, FX Seminar Room and FX Late Studio (window 12:00–14:00 on 14 December; FX Lecture Hall is still excluded by its maintenance block). Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
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
