# J1-T1 — The search offers every filter J1 lists, and with none chosen lists the active venues

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T1 |
| Test Scenario | The search offers every filter J1 lists, and with none chosen lists the active venues |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Look at the form.<br>3. Without choosing anything, click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` |
| Expected Result | The form has From and To (date and time), Minimum capacity, Building / location, Layout, a Facilities group and an Accessibility features group, besides J2's “Search by name or building”. The results list FX Auditorium, FX Seminar Room, FX Lecture Hall and FX Late Studio, each once. FX Old Gym is not listed because it is inactive. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
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
