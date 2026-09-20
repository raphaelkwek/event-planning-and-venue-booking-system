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
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Blocked: needs an equipment request and a reservation (O1, Q1) — the Equipment service does not exist yet. |
| Status | Blocked |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: — · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
