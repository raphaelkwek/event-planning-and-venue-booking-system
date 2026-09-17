# D2-T6 — The clarification is not visible to Attendees or Venue Staff

## Specification

| Item | Content |
|---|---|
| Test Case ID | D2-T6 |
| Test Scenario | The clarification is not visible to Attendees or Venue Staff |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-AWAITING completed; note the request id; sign out. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `attendee@connectsphere.test`.<br>2. Click "API console". Set Method to `GET` and Path to `/event/api/v1/events/<id>/clarifications`, leave Body empty, and click "Send".<br>3. Sign out, sign in as `venuestaff@connectsphere.test`, and repeat step 2. |
| Test Data | Accounts: `attendee@connectsphere.test`, `venuestaff@connectsphere.test` — both `ConnectSphere-Test-1234!` · id: from the pre-condition |
| Expected Result | Both requests return HTTP 404 with error code `EVENT_NOT_FOUND`, and neither body contains the message text. |
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
