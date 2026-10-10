# J1-T17 — CR-01: an existing booking blocks its setup and turnaround time, not just its own period

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T17 |
| Test Scenario | CR-01: an existing booking blocks its setup and turnaround time, not just its own period |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `FX Science` in Building / location.<br>3. Set From to 15 December 2026, 13:00 and To to 15 December 2026, 13:45.<br>4. Click “Search”.<br>5. Change the window to 15 December 2026, 16:00–18:00 and click “Search”.<br>6. Change the window to 15 December 2026, 13:00–13:30 and click “Search”.<br>7. Change the window to 15 December 2026, 16:30–18:30 and click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Auditorium has a confirmed booking on 15 December 2026, 14:00–16:00 with 30 minutes' setup and 30 minutes' turnaround (J1-FX-OCCUPIED), so it is occupied 13:30–16:30 |
| Expected Result | 13:00–13:45: FX Seminar Room only (the window overlaps the setup time although the event starts at 14:00). 16:00–18:00: FX Seminar Room only (overlaps the turnaround). 13:00–13:30: FX Auditorium and FX Seminar Room (touches the occupied period's start). 16:30–18:30: FX Auditorium and FX Seminar Room (starts exactly where the occupied period ends). Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
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
