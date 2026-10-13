# J2-T8 — A search that matches nothing gives an empty list and a message naming the search, not an error

## Specification

| Item | Content |
|---|---|
| Test Case ID | J2-T8 |
| Test Scenario | A search that matches nothing gives an empty list and a message naming the search, not an error |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `zzzz-no-such-venue` in “Search by name or building”.<br>3. Click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` |
| Expected Result | The list is empty and a message says no venue matches the search `zzzz-no-such-venue`. It is not shown as an error. |
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
