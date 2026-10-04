# T2-T9 — An action that does not complete creates no notification

## Specification

| Item | Content |
|---|---|
| Test Case ID | T2-T9 |
| Test Scenario | An action that does not complete creates no notification |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-REJECTED completed; note the request's id. Signed in as the coordinator who rejected it. |
| Test Steps | 1. Open "API console". Send `POST /event/api/v1/events/<id>/approve`.<br>2. Wait two seconds.<br>3. Sign in as `organiser@connectsphere.test` and click "Notifications". |
| Test Data | The rejected request |
| Expected Result | Step 1 is refused (`409`, the request is already decided). The organiser has a rejection notification and no approval notification for the request. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
