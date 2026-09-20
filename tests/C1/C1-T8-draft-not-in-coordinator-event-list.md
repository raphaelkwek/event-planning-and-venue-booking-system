# C1-T8 — A draft does not appear in a coordinator's event list

## Specification

| Item | Content |
|---|---|
| Test Case ID | C1-T8 |
| Test Scenario | A draft does not appear in a coordinator's event list |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-DRAFT with Event name `Not ready to be seen` completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click "API console". Set Method to `GET` and Path to `/event/api/v1/events`, leave Body empty, and click "Send". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | HTTP 200, and no item is named "Not ready to be seen". |
| Created By | Raphael Kwek |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | HTTP 200 and no item named "Not ready to be seen" in the coordinator's event list. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/C1/evidence/C1-T8.png · Defect: — |
| Executed By | Shawmya |
| Date of Execution | 2026-09-20 |
