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
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused on the sign-in screen with INVALID_CREDENTIALS, "email or password is incorrect", HTTP 401; no header and no navigation. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/a-sign-in-and-access.spec.ts › A1-T4 a wrong password is refused without saying which field was wrong, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
