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
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven by the registration.confirmed outbox row (r2Cards › R2-T1) and backend/services/notification/tests/domain/recipients.test.ts › R2-T12 tells the attendee their registration is confirmed, naming it and the event's date and times; delivery needs Kafka, passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41602701323 (commit 4f9ab08). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
