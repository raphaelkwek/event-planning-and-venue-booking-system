# A1-T1 — Sign in as an Event Organiser

## Specification

| Item | Content |
|---|---|
| Test Case ID | A1-T1 |
| Test Scenario | Sign in as an Event Organiser |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed out: the sign-in screen is showing. |
| Test Steps | 1. Go to http://localhost:5173 and enter the email and password for `organiser@connectsphere.test`.<br>2. Click "Sign in". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | The "My requests" screen opens. The header shows `organiser@connectsphere.test · Event Organiser` and a "Sign out" button. (The role was shown as the code `EVENT_ORGANISER` until 2026-09-17, when the header was changed to name the role in words.) |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "My requests" opened. Header: "organiser@connectsphere.test · Event Organiser". A "Sign out" button is shown. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/A1/evidence/A1-T1.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
