# A1-T6 — A deactivated account is refused with a message that differs from wrong credentials

## Specification

| Item | Content |
|---|---|
| Test Case ID | A1-T6 |
| Test Scenario | A deactivated account is refused with a message that differs from wrong credentials |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed out: the sign-in screen is showing. |
| Test Steps | 1. Go to http://localhost:5173 and enter the email and password.<br>2. Click "Sign in". |
| Test Data | Account: `deactivated@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | Sign-in is refused with a message titled `ACCOUNT_DEACTIVATED` reading "This account has been deactivated. Contact an administrator." (HTTP 403). The title and wording differ from the refusal in A1-T4. |
| Created By | Seann, via Claude |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
