# J2-T1 — A partial, case-insensitive match on the venue name returns every matching active venue

## Specification

| Item | Content |
|---|---|
| Test Case ID | J2-T1 |
| Test Scenario | A partial, case-insensitive match on the venue name returns every matching active venue |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `audit` in “Search by name or building”.<br>3. Click “Search”.<br>4. Change it to `HALL` and click “Search”.<br>5. Change it to `ecture` and click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Auditorium, FX Seminar Room, FX Lecture Hall, FX Old Gym (inactive) and FX Late Studio |
| Expected Result | `audit`: FX Auditorium. `HALL`: FX Lecture Hall. `ecture`: FX Lecture Hall (a match in the middle of a word). Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
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
