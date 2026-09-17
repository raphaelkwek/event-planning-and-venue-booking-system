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
