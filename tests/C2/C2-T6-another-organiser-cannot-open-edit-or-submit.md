# C2-T6 — Another organiser cannot open, edit or submit the draft

## Specification

| Item | Content |
|---|---|
| Test Case ID | C2-T6 |
| Test Scenario | Another organiser cannot open, edit or submit the draft |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-DRAFT with Event name `Private draft` completed; note the id; sign out. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `organiser2@connectsphere.test`.<br>2. In the address bar, go to http://localhost:5173/#/drafts/<id>.<br>3. Click "API console". Set Method to `PUT` and Path to `/event/api/v1/event-drafts/<id>`, enter the Body from Test Data, and click "Send".<br>4. Click "API console". Set Method to `POST` and Path to `/event/api/v1/event-drafts/<id>/submit`, leave Body empty, and click "Send".<br>5. Sign out, sign in as `organiser@connectsphere.test`, and click "My requests". |
| Test Data | Account: `organiser2@connectsphere.test` / `ConnectSphere-Test-1234!` · id: from the pre-condition<br>Body: `{"name": "Taken over"}` |
| Expected Result | Step 2 shows a refusal titled `DRAFT_NOT_FOUND` and no draft content. Steps 3 and 4 each return HTTP 404 with error code `DRAFT_NOT_FOUND`. In step 5 "Private draft" is still listed as a Draft under its original name. |
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
