# H2-T5 — Technical Support Staff and Event Organisers can view a venue's details

## Specification

| Item | Content |
|---|---|
| Test Case ID | H2-T5 |
| Test Scenario | Technical Support Staff and Event Organisers can view a venue's details |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed. |
| Test Steps | 1. Sign in as `techsupport@connectsphere.test`; click "Venues", then "View" on the venue.<br>2. Sign out; sign in as `organiser@connectsphere.test`; click "Venues", then "View" on the venue. |
| Test Data | Accounts: `techsupport@connectsphere.test`, `organiser@connectsphere.test` |
| Expected Result | Both see the venue's page with its details (for example maximum capacity 300 and the three layouts). Neither sees an "Edit venue" button. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Both techsupport and organiser saw the venue's page (maximum capacity 300, three layouts), and neither saw an "Edit venue" button. |
| Status | Pass |
| Remarks | Commit: ca285fa · Evidence: tests/H2/evidence/H2-T5.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-05 |
