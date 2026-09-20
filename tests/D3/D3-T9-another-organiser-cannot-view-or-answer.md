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
| Created By | Sahanya |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Opening it was refused with "EVENT_NOT_FOUNDNo event with that reference is available to you.HTTP 404 · correlation c63c5e7d-e2cf-4116-8e35-5cffcb33318a" and no clarification; the API answer returned HTTP 404 EVENT_NOT_FOUND. The owner still sees "Awaiting your response" with no reply recorded (organiser2@connectsphere.test changed nothing). |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D3/evidence/D3-T9.png · Defect: — |
| Executed By | Chai Yichen |
| Date of Execution | 2026-09-20 |
