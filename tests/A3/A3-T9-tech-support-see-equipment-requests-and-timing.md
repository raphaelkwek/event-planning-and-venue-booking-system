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

> **Deferred 2026-09-20 to O1 (Sprint 2) and Q1 (Sprint 3).** Nothing in this case can be split off
> and run now: equipment requests and reservations are Equipment Service records, and that service
> does not exist. Re-read this case when Q1 lands.

## Execution record

| Item | Content |
|---|---|
| Actual Result | Not run: the Equipment service, equipment requests and reservations (O1 Sprint 2, Q1 Sprint 3) do not exist, so there is nowhere to perform the steps. |
| Status | Not Executed |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: — · Defect: — · Was recorded Blocked on 2026-09-20; re-recorded as Not Executed because the case depends on unbuilt future stories rather than on something broken. |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
