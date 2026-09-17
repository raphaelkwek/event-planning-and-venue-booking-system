# D3-T9 — An organiser who does not own the request cannot view or answer its clarification

## Specification

| Item | Content |
|---|---|
| Test Case ID | D3-T9 |
| Test Scenario | An organiser who does not own the request cannot view or answer its clarification |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-AWAITING completed; note the request id; sign out. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `organiser2@connectsphere.test`.<br>2. In the address bar, go to http://localhost:5173/#/requests/<id>.<br>3. Click "API console". Set Method to `POST` and Path to `/event/api/v1/events/<id>/clarifications/respond`, enter the Body from Test Data, and click "Send".<br>4. Sign out, sign in as `organiser@connectsphere.test`, and open the request. |
| Test Data | Account: `organiser2@connectsphere.test` / `ConnectSphere-Test-1234!` · id: from the pre-condition<br>Body: `{"message": "Not mine to answer"}` |
| Expected Result | Step 2 shows a refusal titled `EVENT_NOT_FOUND` and no clarification. Step 3 returns HTTP 404 with error code `EVENT_NOT_FOUND`. In step 4 "Awaiting your response" is still shown, with no reply recorded. |
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
