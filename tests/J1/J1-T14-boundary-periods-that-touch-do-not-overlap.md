# J1-T14 — Boundary: a window that starts where a booking ends, or ends where a hold starts, is not excluded

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T14 |
| Test Scenario | Boundary: a window that starts where a booking ends, or ends where a hold starts, is not excluded |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Set From to 14 December 2026, 12:00 and To to 14 December 2026, 14:00.<br>3. Click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Auditorium's confirmed booking ends at 12:00; FX Seminar Room's hold starts at 14:00; FX Lecture Hall's maintenance block runs 09:00–13:00; FX Late Studio opens 12:00 |
| Expected Result | FX Auditorium, FX Seminar Room and FX Late Studio are listed. FX Lecture Hall is not, because its block overlaps 12:00–13:00. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
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
