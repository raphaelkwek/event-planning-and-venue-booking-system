# J2-T3 — A search never returns an inactive venue

## Specification

| Item | Content |
|---|---|
| Test Case ID | J2-T3 |
| Test Scenario | A search never returns an inactive venue |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `old gym` in “Search by name or building”.<br>3. Click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Old Gym is inactive |
| Expected Result | No venue among the FX rows, and the empty-result message names the search `old gym`. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
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
