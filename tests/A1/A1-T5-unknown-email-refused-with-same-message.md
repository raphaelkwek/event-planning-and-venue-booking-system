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
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused with INVALID_CREDENTIALS, exactly "email or password is incorrect", HTTP 401; no header. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/a-sign-in-and-access.spec.ts › A1-T5 an unknown email is refused with the same message as a wrong password, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
