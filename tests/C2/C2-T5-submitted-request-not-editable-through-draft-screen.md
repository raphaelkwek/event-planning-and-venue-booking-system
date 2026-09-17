# C2-T5 — A submitted request can no longer be edited through the draft screen

## Specification

| Item | Content |
|---|---|
| Test Case ID | C2-T5 |
| Test Scenario | A submitted request can no longer be edited through the draft screen |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`.<br>3. "New request" → enter the standard request → "Save draft" → note the id → "Submit request". |
| Test Steps | 1. In the address bar, go to http://localhost:5173/#/drafts/<id>.<br>2. Click "API console". Set Method to `PUT` and Path to `/event/api/v1/event-drafts/<id>`, enter the Body from Test Data, and click "Send".<br>3. Click "My requests", then "View" on the request. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · id: from the pre-condition<br>Body: `{"name": "Edited after submission"}` |
| Expected Result | Step 1 shows a refusal titled `DRAFT_NOT_FOUND` with every form field empty. Step 2 returns HTTP 404 with error code `DRAFT_NOT_FOUND`. In step 3 the name is still "Annual Research Symposium". |
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
