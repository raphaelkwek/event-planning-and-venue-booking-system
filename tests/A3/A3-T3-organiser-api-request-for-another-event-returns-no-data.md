# A3-T3 — An organiser's direct API request for another organiser's event returns no event data at all

## Specification

| Item | Content |
|---|---|
| Test Case ID | A3-T3 |
| Test Scenario | An organiser's direct API request for another organiser's event returns no event data at all |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. As `organiser2@connectsphere.test`: FX-SUBMITTED; note the request id; sign out.<br>3. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "API console". Set Method to `GET` and Path to `/event/api/v1/events/<id>`, leave Body empty, and click "Send". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · id: from the pre-condition |
| Expected Result | HTTP 404 — not HTTP 200 with an empty body. The body contains only `error` with code `EVENT_NOT_FOUND`, and no name, purpose or other event field. |
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | HTTP 404 (not 200 with an empty body). The body held only "error" with code EVENT_NOT_FOUND, and no name, purpose or other event field. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/A3/evidence/A3-T3.png · Defect: — |
| Executed By | Seann Khoo |
| Date of Execution | 2026-09-20 |
