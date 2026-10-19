# H2-T8 — Venue Staff can go from a venue's page to editing it

## Specification

| Item | Content |
|---|---|
| Test Case ID | H2-T8 |
| Test Scenario | Venue Staff can go from a venue's page to editing it |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed; signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Venues", then "View" on the venue.<br>2. Click "Edit venue". |
| Test Data | Account: `venuestaff@connectsphere.test` |
| Expected Result | The venue's page shows an "Edit venue" button, which opens the venue form with the venue's values filled in. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "Edit venue" opened the venue form with its values filled in (name Lee Kong Chian Auditorium, maximum capacity 300). |
| Status | Pass |
| Remarks | Commit: ca285fa · Evidence: tests/H2/evidence/H2-T8.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-05 |
