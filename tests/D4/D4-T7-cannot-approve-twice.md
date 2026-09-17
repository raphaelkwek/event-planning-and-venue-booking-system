# D4-T7 — A request that already carries a decision cannot be approved again, and no second approval time is written

## Specification

| Item | Content |
|---|---|
| Test Case ID | D4-T7 |
| Test Scenario | A request that already carries a decision cannot be approved again, and no second approval time is written |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-APPROVED completed; note the request id and the "Decided" time shown. The coordinator is on the review screen. |
| Test Steps | 1. Check the "Approve" button.<br>2. Click "API console". Set Method to `POST` and Path to `/event/api/v1/events/<id>/approve`, leave Body empty, and click "Send".<br>3. Go to http://localhost:5173/#/review/<id>. |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` · id: from the pre-condition |
| Expected Result | In step 1 "Approve" is disabled. Step 2 is refused with HTTP 409. In step 3 the "Decided" time is exactly the one noted. |
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
