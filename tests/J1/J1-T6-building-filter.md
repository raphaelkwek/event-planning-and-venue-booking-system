# J1-T6 — Filtering by building or location returns only venues there, ignoring case

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T6 |
| Test Scenario | Filtering by building or location returns only venues there, ignoring case |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `science` in Building / location.<br>3. Click “Search”.<br>4. Change it to `FX ARTS BUILDING` and click “Search”.<br>5. Change it to `Nowhere Hall` and click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Auditorium and FX Seminar Room are in FX Science Block; FX Lecture Hall and the inactive FX Old Gym in FX Arts Building |
| Expected Result | `science`: FX Auditorium and FX Seminar Room. `FX ARTS BUILDING`: FX Lecture Hall only (FX Old Gym is inactive). `Nowhere Hall`: no venue and the empty-result message. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
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
