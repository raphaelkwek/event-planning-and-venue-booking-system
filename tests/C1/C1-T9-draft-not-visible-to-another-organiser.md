# C1-T9 — A draft is not visible to another organiser

## Specification

| Item | Content |
|---|---|
| Test Case ID | C1-T9 |
| Test Scenario | A draft is not visible to another organiser |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-DRAFT with Event name `Not ready to be seen` completed; note the id; sign out. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `organiser2@connectsphere.test`.<br>2. Click "My requests".<br>3. In the address bar, go to http://localhost:5173/#/drafts/<id>. |
| Test Data | Account: `organiser2@connectsphere.test` / `ConnectSphere-Test-1234!` · id: from the pre-condition |
| Expected Result | Step 2 does not list "Not ready to be seen". Step 3 shows a refusal titled `DRAFT_NOT_FOUND` reading "No draft with that reference is available to you.", and every form field is empty. |
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
