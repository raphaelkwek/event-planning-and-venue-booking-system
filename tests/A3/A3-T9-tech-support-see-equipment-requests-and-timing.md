# A3-T9 — Technical Support Staff see equipment requests, reservations and the event timing they depend on

## Specification

| Item | Content |
|---|---|
| Test Case ID | A3-T9 |
| Test Scenario | Technical Support Staff see equipment requests, reservations and the event timing they depend on |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. An event with an equipment request and a reservation. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `techsupport@connectsphere.test`.<br>2. Open the equipment requests list.<br>3. Open the request. |
| Test Data | Account: `techsupport@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | The equipment request and reservation are listed with the event's date, start and end time, and not the full internal event record. |
| Created By | Seann, via Claude |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Blocked |
| Remarks | Blocked: the Equipment service (O1–Q2) is not built. Identity already resolves the rule: `GET /identity/api/v1/access-scope/equipment_requests` returns `STAFF_OWNED_EQUIPMENT`. |
| Executed By | |
| Date of Execution | |
