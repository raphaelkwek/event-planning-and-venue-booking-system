# D5-T5 — Try to amend or resubmit a request that has already been rejected

## Specification

| Item | Content |
|---|---|
| Test Case ID | D5-T5 |
| Test Scenario | Try to amend or resubmit a request that has already been rejected |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-REJECTED completed; note the request id; sign out. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `organiser@connectsphere.test`. Click "My requests", then "View" on the request.<br>2. In the address bar, go to http://localhost:5173/#/drafts/<id>.<br>3. Click "API console". Set Method to `PUT` and Path to `/event/api/v1/event-drafts/<id>`, enter the Body from Test Data, and click "Send".<br>4. Click "API console". Set Method to `POST` and Path to `/event/api/v1/event-drafts/<id>/submit`, leave Body empty, and click "Send".<br>5. Click "My requests", then "View" on the request. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · id: from the pre-condition<br>Body: `{"name": "Revived"}` |
| Expected Result | Step 1 shows no control for editing any field. Step 2 shows a refusal titled `DRAFT_NOT_FOUND` with every form field empty. Step 3 returns HTTP 404. Step 4 returns HTTP 409 with error code `DRAFT_ALREADY_SUBMITTED`. In step 5 the request is still "Rejected" under its original name. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The request page offered no editable control; the draft screen refused with "DRAFT_NOT_FOUNDNo draft with that reference is available to you.HTTP 404 · correlation 1b803fd2-d64b-47df-89b7-d29481033079" and empty fields; the edit returned HTTP 404 and the resubmission HTTP 409 DRAFT_ALREADY_SUBMITTED. The request is still "Rejected" under its original name. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D5/evidence/D5-T5.png · Defect: — |
| Executed By | Raphael Kwek |
| Date of Execution | 2026-09-20 |
