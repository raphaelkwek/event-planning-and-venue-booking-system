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
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Both were refused with no message text — attendee@connectsphere.test: HTTP 404 EVENT_NOT_FOUND · venuestaff@connectsphere.test: HTTP 404 EVENT_NOT_FOUND. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D2/evidence/D2-T6.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
