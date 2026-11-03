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
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused with VALIDATION_FAILED, "email and password are both required.", HTTP 400; the sign-in screen remained. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/a-sign-in-and-access.spec.ts › A1-T11 signing in with the email left empty is refused, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
