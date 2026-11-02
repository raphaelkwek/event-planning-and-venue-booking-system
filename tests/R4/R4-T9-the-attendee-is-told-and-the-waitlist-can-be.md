# R4-T9 — The attendee receives confirmation of the withdrawal, and the message R6 needs to notify waitlisted attendees is published

## Specification

| Item | Content |
|---|---|
| Test Case ID | R4-T9 |
| Test Scenario | The attendee receives confirmation of the withdrawal, and the message R6 needs to notify waitlisted attendees is published |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). Kafka configured.<br>2. R4-T1 done.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Wait a few seconds, then click "Notifications". |
| Test Data | The withdrawal from R4-T1 |
| Expected Result | A notification reads `You withdrew registration REG-… for EVT-… “R Test Symposium”. Your place has been released.`. The `registration.withdrawn` message (in `registration.outbox`) names the event, so R6 can notify the waitlist (R6 is not built yet). |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
