# J2-T7 — Boundary: spaces only, a single character, and the wildcard characters % and _

## Specification

| Item | Content |
|---|---|
| Test Case ID | J2-T7 |
| Test Scenario | Boundary: spaces only, a single character, and the wildcard characters % and _ |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Type three spaces in “Search by name or building”.<br>3. Click “Search”.<br>4. Change it to `x` and click “Search”.<br>5. Change it to `%` and click “Search”.<br>6. Change it to `_` and click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` |
| Expected Result | Spaces only: treated as an empty search, so all active venues are listed with no error. `x`: every active venue whose name or building contains an x, including all the FX venues (“FX”). `%` and `_`: only venues whose name or building actually contains that character; none of the FX venues appear, so the characters are not treated as wildcards. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
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
