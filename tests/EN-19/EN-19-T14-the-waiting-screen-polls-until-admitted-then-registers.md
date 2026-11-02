# EN-19-T14 — The waiting screen shows the position and wait, polls until the attendee is admitted, then registers with the token

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-19-T14 |
| Test Scenario | The waiting screen shows the position and wait, polls until the attendee is admitted, then registers with the token |
| Pre-conditions | 1. Dependencies installed (`npm ci`).<br>2. The event's page in the attendee shell; the API faked at the fetch boundary. |
| Test Steps | 1. Run `npm test -w @connectsphere/web`.<br>2. Find the tests named `EN-19-T14` in `frontend/tests/waitingRoom.test.tsx`. |
| Test Data | Register answered ADMISSION_REQUIRED; join answered WAITING at position 3; the status polled until ADMITTED with a token; the register retried with it |
| Expected Result | The attendee sees `You are in the queue`, position 3 and the estimated wait, updating on each poll. When admitted the screen registers with the token in X-Admission-Token and shows the registration. An expired token shows `Your turn has passed` with a button to join again. Polling stops when the screen closes. |
| Acceptance criterion | A frontend waiting screen on the attendee surface polls until admitted. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
