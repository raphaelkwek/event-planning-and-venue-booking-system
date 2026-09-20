# A1-T5 — An unknown email is refused with the same message as a wrong password

## Specification

| Item | Content |
|---|---|
| Test Case ID | A1-T5 |
| Test Scenario | An unknown email is refused with the same message as a wrong password |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed out: the sign-in screen is showing. |
| Test Steps | 1. Go to http://localhost:5173 and enter the email and password.<br>2. Click "Sign in". |
| Test Data | Account: `nobody@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | Sign-in is refused with a message titled `INVALID_CREDENTIALS` reading "email or password is incorrect" (HTTP 401) — word for word the same as in A1-T4, so nothing reveals that the email is the wrong part. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Unknown email refused with "INVALID_CREDENTIALSemail or password is incorrectHTTP 401 · correlation be76a596-5276-4f1b-8333-aa032c953df6", word for word the refusal a wrong password gives (correlation id aside). |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/A1/evidence/A1-T5.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
