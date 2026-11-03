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
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused with ACCOUNT_DEACTIVATED, "This account has been deactivated. Contact an administrator.", HTTP 403; no INVALID_CREDENTIALS message and no header. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/a-sign-in-and-access.spec.ts › A1-T6 a deactivated account is refused with a different message, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
