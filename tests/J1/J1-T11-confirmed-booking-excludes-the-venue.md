# J1-T11 — A venue with a confirmed booking overlapping the window is excluded

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T11 |
| Test Scenario | A venue with a confirmed booking overlapping the window is excluded |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `FX Science` in Building / location.<br>3. Set From to 14 December 2026, 10:30 and To to 14 December 2026, 11:30.<br>4. Click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Auditorium has a confirmed booking on 14 December 2026, 10:00–12:00 (J1-FX-CONFIRMED) |
| Expected Result | FX Seminar Room only. FX Auditorium is not listed, because its confirmed booking covers the whole window. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
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
