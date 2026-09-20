# A3-T6 — An attendee's direct request for an internal event returns no event data

## Specification

| Item | Content |
|---|---|
| Test Case ID | A3-T6 |
| Test Scenario | An attendee's direct request for an internal event returns no event data |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SUBMITTED completed; note the request id; sign out.<br>3. Signed in as `attendee@connectsphere.test`. |
| Test Steps | 1. Click "API console". Set Method to `GET` and Path to `/event/api/v1/events/<id>`, leave Body empty, and click "Send". |
| Test Data | Account: `attendee@connectsphere.test` / `ConnectSphere-Test-1234!` · id: from the pre-condition |
| Expected Result | HTTP 404 with error code `EVENT_NOT_FOUND`. No event name, purpose or other field is returned. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | HTTP 404 with code EVENT_NOT_FOUND. Neither the event name nor any purpose, timing or attendance field was returned. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/A3/evidence/A3-T6.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
