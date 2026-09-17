# A2-T6 — A coordinator's direct API call to create a request is refused and creates nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | A2-T6 |
| Test Scenario | A coordinator's direct API call to create a request is refused and creates nothing |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click "API console". Set Method to `POST` and Path to `/event/api/v1/event-drafts`, enter the Body from Test Data, and click "Send".<br>2. Click "API console". Set Method to `GET` and Path to `/event/api/v1/events`, leave Body empty, and click "Send". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!`<br>Body: `{"name": "Created by a coordinator"}` |
| Expected Result | Step 1 returns HTTP 403 with error code `ROLE_NOT_AUTHORISED`. Step 2 returns HTTP 200, and no item is named "Created by a coordinator". |
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
