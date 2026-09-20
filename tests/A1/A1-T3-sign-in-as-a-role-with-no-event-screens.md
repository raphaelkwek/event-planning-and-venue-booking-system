# A1-T3 — Sign in as a role that has no event screens (Venue Staff)

## Specification

| Item | Content |
|---|---|
| Test Case ID | A1-T3 |
| Test Scenario | Sign in as a role that has no event screens (Venue Staff) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed out: the sign-in screen is showing. |
| Test Steps | 1. Go to http://localhost:5173 and enter the email and password.<br>2. Click "Sign in". |
| Test Data | Account: `venuestaff@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | The "Direct API console" screen opens. The header shows `venuestaff@connectsphere.test · Venue Staff`. (The role was shown as the code `VENUE_STAFF` until 2026-09-17.) |
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "Direct API console" opened. Header: "venuestaff@connectsphere.test · Venue Staff". |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/A1/evidence/A1-T3.png · Defect: — |
| Executed By | Seann Khoo |
| Date of Execution | 2026-09-20 |
