# J1-T19 — Inactive venues are never returned, however well they match

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T19 |
| Test Scenario | Inactive venues are never returned, however well they match |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `400` in Minimum capacity.<br>3. Click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Old Gym is inactive and holds 500 with every facility and accessibility feature |
| Expected Result | No venue among the FX rows: FX Old Gym is not listed although it is the only FX venue that holds 400. The empty-result message appears. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
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
