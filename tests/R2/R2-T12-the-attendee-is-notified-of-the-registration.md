# R2-T12 — The attendee receives a registration confirmation notification

## Specification

| Item | Content |
|---|---|
| Test Case ID | R2-T12 |
| Test Scenario | The attendee receives a registration confirmation notification |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). Kafka configured (`npm run kafka:check` passes).<br>2. R2-T1 done.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Wait a few seconds, then click "Notifications". |
| Test Data | The registration from R2-T1 |
| Expected Result | A notification reads `Your registration REG-… for EVT-… “R Test Symposium” on Wednesday 16 December 2026, 14:00–18:00 is confirmed.`, naming the reference R2-T1 showed. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Pre-condition R2-T1: the attendee registered from the event's page (201), which said `You are registered` and `Registration REG-… for R Test Symposium … is confirmed.` The registration's `registration.confirmed` was stored by the notification service (the notification was delivered by the test harness (deliverOutbox, the consumers' own code) in place of Kafka, which CI's stack runs without). Step 1: Notifications held one notice about the event: `Your registration REG-… for EVT-R… “R Test Symposium …” on Wednesday 16 December 2026, 14:00–18:00 is confirmed.`, naming the reference the page had shown. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5cd14bb · Evidence: tests/e2e/r-registration.spec.ts › R2-T12 the attendee is told the registration is confirmed, with its reference and the event's date and times, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41793114951 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
