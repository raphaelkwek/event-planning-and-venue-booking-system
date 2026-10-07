# I1-T4 — Recorded unavailability is shown with its type and reason, including a block that runs past midnight

## Specification

| Item | Content |
|---|---|
| Test Case ID | I1-T4 |
| Test Scenario | Recorded unavailability is shown with its type and reason, including a block that runs past midnight |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-CALENDAR completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open the venue's availability, as in I1-T1 steps 1 to 3.<br>2. Show 8 December 2026 to 10 December 2026.<br>3. Look at the "Committed" lists for Tuesday, Wednesday and Thursday. |
| Test Data | Account: `coordinator@connectsphere.test` · Maintenance `Stage lighting rewiring`, Tuesday 8 December 09:00–13:00 · Renovation `Seat replacement`, Wednesday 9 December 18:00 to Thursday 10 December 12:00 |
| Expected Result | Tuesday lists `09:00–13:00` marked "Maintenance" with `Stage lighting rewiring`. Wednesday lists `18:00–24:00` and Thursday lists `00:00–12:00`, each marked "Renovation" with `Seat replacement`. None of these is marked as a booking. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Tuesday listed "09:00–13:00 Maintenance Stage lighting rewiring". Wednesday listed "18:00–24:00 Renovation Seat replacement" and Thursday "00:00–12:00 Renovation Seat replacement". None was marked as a booking. |
| Status | Pass |
| Remarks | Commit: 69e657d · Evidence: tests/I1/evidence/I1-T4.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-07 |
