# A2-T3 — Roles with no event functions are offered none

## Specification

| Item | Content |
|---|---|
| Test Case ID | A2-T3 |
| Test Scenario | Roles with no event functions are offered none |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`). |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `venuestaff@connectsphere.test`. Read the navigation bar.<br>2. Sign out, sign in as the second account and read the navigation bar.<br>3. Sign out, sign in as the third account and read the navigation bar. |
| Test Data | Accounts: `venuestaff@connectsphere.test`, `techsupport@connectsphere.test`, `attendee@connectsphere.test` — all `ConnectSphere-Test-1234!` |
| Expected Result | For each of the three accounts the navigation shows only "API console". |
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Each account was offered only the API console — venuestaff@connectsphere.test: API console · techsupport@connectsphere.test: API console · attendee@connectsphere.test: API console. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/A2/evidence/A2-T3.png · Defect: — |
| Executed By | Seann Khoo |
| Date of Execution | 2026-09-20 |
