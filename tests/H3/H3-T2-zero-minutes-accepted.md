# H3-T2 — A setup and turnaround time of 0 minutes is accepted (boundary, exactly at)

## Specification

| Item | Content |
|---|---|
| Test Case ID | H3-T2 |
| Test Scenario | A setup and turnaround time of 0 minutes is accepted (boundary, exactly at) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed, then H3-T1's steps on it (setup 30, turnaround 45). Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Venues", then "Edit" on the venue.<br>2. Enter `0` in both "Setup time (minutes)" and "Turnaround time (minutes)".<br>3. Click "Save venue". |
| Test Data | Setup `0` · Turnaround `0` |
| Expected Result | "Venue saved." is shown, and the form shows 0 for both. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "Venue saved." was shown and both times showed 0. |
| Status | Pass |
| Remarks | Commit: 6514ab8 · Evidence: tests/H3/evidence/H3-T2.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
