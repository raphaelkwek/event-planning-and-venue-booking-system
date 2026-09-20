# D4-T8 — A rejected request cannot be approved

## Specification

| Item | Content |
|---|---|
| Test Case ID | D4-T8 |
| Test Scenario | A rejected request cannot be approved |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-REJECTED completed; note the request id.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click "API console". Set Method to `POST` and Path to `/event/api/v1/events/<id>/approve`, leave Body empty, and click "Send".<br>2. Go to http://localhost:5173/#/review/<id>. |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` · id: from the pre-condition |
| Expected Result | Step 1 is refused with HTTP 409. In step 2 the request is still "Rejected", with reason "No suitable venue is available.". |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | HTTP 409 (This event is Rejected and cannot move to Approved.). The request is still "Rejected" with the reason "No suitable venue is available.". |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D4/evidence/D4-T8.png · Defect: — |
| Executed By | Raphael Kwek |
| Date of Execution | 2026-09-20 |
