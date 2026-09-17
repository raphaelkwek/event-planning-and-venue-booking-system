# C2-T7 — A coordinator cannot open an organiser's draft

## Specification

| Item | Content |
|---|---|
| Test Case ID | C2-T7 |
| Test Scenario | A coordinator cannot open an organiser's draft |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-DRAFT with Event name `Private draft` completed; note the id; sign out.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click "API console". Set Method to `GET` and Path to `/event/api/v1/event-drafts/<id>`, leave Body empty, and click "Send". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` · id: from the pre-condition |
| Expected Result | HTTP 403 with error code `ROLE_NOT_AUTHORISED`. The body contains no draft name or other draft field. |
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
