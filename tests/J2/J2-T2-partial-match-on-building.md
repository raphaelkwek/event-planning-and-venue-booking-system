# J2-T2 — A partial, case-insensitive match on the building returns every active venue there

## Specification

| Item | Content |
|---|---|
| Test Case ID | J2-T2 |
| Test Scenario | A partial, case-insensitive match on the building returns every active venue there |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `SCIENCE block` in “Search by name or building”.<br>3. Click “Search”.<br>4. Change it to `arts` and click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Science Block: FX Auditorium, FX Seminar Room. FX Arts Building: FX Lecture Hall and the inactive FX Old Gym |
| Expected Result | `SCIENCE block`: FX Auditorium and FX Seminar Room. `arts`: FX Lecture Hall only; FX Old Gym is not listed. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
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
