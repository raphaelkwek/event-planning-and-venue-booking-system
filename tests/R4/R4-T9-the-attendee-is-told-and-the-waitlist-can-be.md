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
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven by r4Cards › R4-T9 writes registration.withdrawn for the attendee's confirmation, naming the event for R6's waitlist, and recipients.test.ts › R4-T9 tells the attendee their withdrawal went through, and nobody else; delivery needs Kafka, passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41602701323 (commit 4f9ab08). The waitlist half is proven by r6Cards.test.ts › R6-T6 tells every waitlisted attendee a place opened when someone withdraws, and registers nobody (R4-T9), passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41638473298 (commit 7496e5a). Delivery to the Notifications screen needs Kafka. UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
