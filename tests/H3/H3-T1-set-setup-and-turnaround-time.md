# H3-T1 — Venue Staff set a venue's setup and turnaround time

## Specification

| Item | Content |
|---|---|
| Test Case ID | H3-T1 |
| Test Scenario | Venue Staff set a venue's setup and turnaround time |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-VENUE completed; signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Venues", then "Edit" on `Lee Kong Chian Auditorium`.<br>2. Enter `30` in "Setup time (minutes)" and `45` in "Turnaround time (minutes)".<br>3. Click "Save venue". |
| Test Data | Setup `30` · Turnaround `45` |
| Expected Result | "Venue saved." is shown, and the form shows setup time 30 and turnaround time 45 minutes. Every other field is unchanged. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "Venue saved." was shown; the form showed setup 30 and turnaround 45 minutes, and the other fields unchanged. |
| Status | Pass |
| Remarks | Commit: 6514ab8 · Evidence: tests/H3/evidence/H3-T1.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
