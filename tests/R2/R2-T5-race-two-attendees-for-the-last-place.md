# R2-T5 — Race: two attendees registering at the same moment for the last place leave exactly one registration

## Specification

| Item | Content |
|---|---|
| Test Case ID | R2-T5 |
| Test Scenario | Race: two attendees registering at the same moment for the last place leave exactly one registration |
| Pre-conditions | Automated (CI), against the registration schema: an event with one seat. |
| Test Steps | 1. Two different attendees call `POST /api/v1/registrations` for the event at the same moment.<br>2. Count the event's registrations and free seats. |
| Test Data | 1 seat, 2 attendees racing; also 500 attendees racing for 100 seats through the registration path |
| Expected Result | Exactly one call is `201` and the other `409` `REGISTRATION_FULL`. The event has exactly one `REGISTERED` registration and no free seat. With 500 racers for 100 seats, exactly 100 registrations exist, each with a different seat. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Automated test written: backend/services/registration/tests/api/r2Cards.test.ts › R2-T5 race: two attendees registering at once for the last place leave exactly one registration (API level); not yet run: CI's integration job stops at planning-core's unrelated L3-T17 date failure (fixed by PR #82) before it reaches the registration step (commit d43fab5). Becomes Pass when that step runs green. |
| Executed By |  |
| Date of Execution |  |
