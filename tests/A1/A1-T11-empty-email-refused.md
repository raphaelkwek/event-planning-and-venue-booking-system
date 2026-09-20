# A1-T11 — Signing in with the email left empty is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | A1-T11 |
| Test Scenario | Signing in with the email left empty is refused |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed out: the sign-in screen is showing. |
| Test Steps | 1. Go to http://localhost:5173.<br>2. Clear the Email field and enter the password.<br>3. Click "Sign in". |
| Test Data | Email: *(empty)* · Password: `ConnectSphere-Test-1234!` |
| Expected Result | Sign-in is refused with a message titled `VALIDATION_FAILED` reading "email and password are both required." (HTTP 400). The sign-in screen remains. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused on the sign-in screen: "VALIDATION_FAILEDemail and password are both required.HTTP 400 · correlation fea6df46-12aa-4ba4-8edd-64af6e4fc812". |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/A1/evidence/A1-T11.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
