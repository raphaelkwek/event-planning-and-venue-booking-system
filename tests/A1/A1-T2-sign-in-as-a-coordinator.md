# A1-T2 — Sign in as an Event Coordinator

## Specification

| Item | Content |
|---|---|
| Test Case ID | A1-T2 |
| Test Scenario | Sign in as an Event Coordinator |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed out: the sign-in screen is showing. |
| Test Steps | 1. Go to http://localhost:5173 and enter the email and password.<br>2. Click "Sign in". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | The "Review queue" screen opens. The header shows `coordinator@connectsphere.test · Event Coordinator`. (The role was shown as the code `EVENT_COORDINATOR` until 2026-09-17.) |
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Signed in through the form: "Review queue" opened and the header showed `coordinator@connectsphere.test · Event Coordinator`. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/a-sign-in-and-access.spec.ts › A1-T2 an Event Coordinator signs in and lands on the Review queue, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
