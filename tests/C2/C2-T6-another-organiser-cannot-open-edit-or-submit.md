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
| Created By | Raphael Kwek |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Opening it was refused with "DRAFT_NOT_FOUNDNo draft with that reference is available to you.HTTP 404 · correlation 265126ad-0694-4bf6-81c0-b40a512740b7"; the edit and the submit each returned HTTP 404 DRAFT_NOT_FOUND. The owner's row is unchanged: —Private draftDraft9/20/2026, 3:26:31 PM——Open draft |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/C2/evidence/C2-T6.png · Defect: — |
| Executed By | Shawmya |
| Date of Execution | 2026-09-20 |
