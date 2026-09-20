# A1-T4 — A wrong password is refused without saying which field was wrong

## Specification

| Item | Content |
|---|---|
| Test Case ID | A1-T4 |
| Test Scenario | A wrong password is refused without saying which field was wrong |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed out: the sign-in screen is showing. |
| Test Steps | 1. Go to http://localhost:5173 and enter the email and password.<br>2. Click "Sign in". |
| Test Data | Account: `organiser@connectsphere.test` / `WrongPassword-1` |
| Expected Result | Sign-in is refused. A message titled `INVALID_CREDENTIALS` reads "email or password is incorrect" (HTTP 401). The sign-in screen remains, with no navigation and no header. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused on the sign-in screen: "INVALID_CREDENTIALSemail or password is incorrectHTTP 401 · correlation b933339f-1b40-4ce5-8e81-4ae0065fe2e2". No header and no navigation. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/A1/evidence/A1-T4.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
