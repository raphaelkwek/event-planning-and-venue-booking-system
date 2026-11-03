# A1-T10 — After signing out, the next user starts on their own screen, not the previous user's

## Specification

| Item | Content |
|---|---|
| Test Case ID | A1-T10 |
| Test Scenario | After signing out, the next user starts on their own screen, not the previous user's |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `coordinator@connectsphere.test` on "Review queue". |
| Test Steps | 1. Click "Sign out".<br>2. Sign in as `organiser@connectsphere.test`. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | "My requests" opens and the address bar ends in `#/requests`. The review queue is not shown at any point. |
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | After the coordinator signed out and the organiser signed in, "My requests" opened at `#/requests`; a page observer confirmed the review queue was never drawn. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/a-sign-in-and-access.spec.ts › A1-T10 after signing out, the next user starts on their own screen, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
