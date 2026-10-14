# J1-T7 — A required layout keeps only venues that offer it

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T7 |
| Test Scenario | A required layout keeps only venues that offer it |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Choose `Boardroom` in Layout.<br>3. Click “Search”.<br>4. Choose `Theatre` and click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · Boardroom is offered only by FX Seminar Room; Theatre by FX Auditorium, FX Lecture Hall and FX Late Studio |
| Expected Result | `Boardroom`: FX Seminar Room only. `Theatre`: FX Auditorium, FX Lecture Hall and FX Late Studio. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
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
