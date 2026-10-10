# J1-T8 — Every required facility must be present; a venue missing one is excluded

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T8 |
| Test Scenario | Every required facility must be present; a venue missing one is excluded |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Tick `Stage lighting` under Facilities.<br>3. Click “Search”.<br>4. Untick it, tick `Projector` and `Wireless microphones`, and click “Search”.<br>5. Also tick `Stage lighting` and click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · Stage lighting: FX Lecture Hall only. Wireless microphones: FX Auditorium and FX Lecture Hall. Projector: all four active FX venues |
| Expected Result | `Stage lighting`: FX Lecture Hall only. `Projector` and `Wireless microphones`: FX Auditorium and FX Lecture Hall (FX Seminar Room and FX Late Studio lack the microphones). All three: FX Lecture Hall only, because FX Auditorium lacks stage lighting. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
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
