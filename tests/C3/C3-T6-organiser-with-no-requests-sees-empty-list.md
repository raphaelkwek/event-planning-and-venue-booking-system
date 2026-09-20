# C3-T6 — An organiser with no requests sees an empty list, not an error

## Specification

| Item | Content |
|---|---|
| Test Case ID | C3-T6 |
| Test Scenario | An organiser with no requests sees an empty list, not an error |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. `organiser2@connectsphere.test` has no requests. |
| Test Steps | 1. Sign in as `organiser2@connectsphere.test` and click "My requests".<br>2. Click "Drafts only".<br>3. Click "Submitted and later". |
| Test Data | Account: `organiser2@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | Each of the three views shows "No requests yet. Create one to get started." and no error message. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Each of All, Drafts only, Submitted and later showed "No requests yet. Create one to get started." with no error message. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/C3/evidence/C3-T6.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
