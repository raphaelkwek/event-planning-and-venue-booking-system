# R4-T9 — The attendee receives confirmation of the withdrawal, and the message R6 needs to notify waitlisted attendees is published

## Specification

| Item | Content |
|---|---|
| Test Case ID | R4-T9 |
| Test Scenario | The attendee receives confirmation of the withdrawal, and the message R6 needs to notify waitlisted attendees is published |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). Kafka configured.<br>2. R4-T1 done.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Wait a few seconds, then click "Notifications". |
| Test Data | The withdrawal from R4-T1 |
| Expected Result | A notification reads `You withdrew registration REG-… for EVT-… “R Test Symposium”. Your place has been released.`. The `registration.withdrawn` message (in `registration.outbox`) names the event, so R6 can notify the waitlist. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

> **Corrected 2026-11-04.** R6 has been built since this case was written, so the expected result no longer says
> it is not; the waitlist's notices are R6's own cases (R6-T6).

## Execution record

| Item | Content |
|---|---|
| Actual Result | Pre-condition R4-T1: the attendee withdrew the registration in My registrations after confirming (200), and the row read Withdrawn. registration.outbox then held one `registration.withdrawn`, naming the registration (id and REG-… reference), the event (its id, EVT-R… reference and name) and the attendee: the event R6 tells the waitlist about (R6 is built now; R6-T6 shows that telling). It was stored by the notification service (the notification was delivered by the test harness (deliverOutbox, the consumers' own code) in place of Kafka, which CI's stack runs without); Notifications read `You withdrew registration REG-… for EVT-R… “R Test Symposium …”. Your place has been released.` |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: c0f7183 · Evidence: tests/e2e/r-registration.spec.ts › R4-T9 the attendee is told the withdrawal went through, and registration.withdrawn names the event for R6, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41798410254 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
