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
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Signed in through the form: "My requests" opened, the header showed `organiser@connectsphere.test · Event Organiser` and a "Sign out" button. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/a-sign-in-and-access.spec.ts › A1-T1 an Event Organiser signs in and lands on My requests, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
