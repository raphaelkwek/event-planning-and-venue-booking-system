# D4-T3 — Approving a request not yet under review is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | D4-T3 |
| Test Scenario | Approving a request not yet under review is refused |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SUBMITTED completed; note the request id. Do not open it as a coordinator.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click "API console". Set Method to `POST` and Path to `/event/api/v1/events/<id>/approve`, leave Body empty, and click "Send".<br>2. Sign out, sign in as `organiser@connectsphere.test`, and open the request. |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` · id: from the pre-condition |
| Expected Result | Step 1 returns HTTP 409 with message "This event is Submitted and cannot move to Approved.". In step 2 the status is still "Submitted" and Decision reads "None yet". |
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
