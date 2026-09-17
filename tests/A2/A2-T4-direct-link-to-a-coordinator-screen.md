# A2-T4 — An organiser following a direct link to a coordinator screen is sent to their own screen

## Specification

| Item | Content |
|---|---|
| Test Case ID | A2-T4 |
| Test Scenario | An organiser following a direct link to a coordinator screen is sent to their own screen |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed; note the request id.<br>3. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. In the address bar, go to http://localhost:5173/#/queue.<br>2. In the address bar, go to http://localhost:5173/#/review/<id>. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · id: from the pre-condition |
| Expected Result | Both times "My requests" opens and the address bar ends in `#/requests`. No review queue rows, no clarification form, and no "Approve" or "Reject" button appear. |
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
