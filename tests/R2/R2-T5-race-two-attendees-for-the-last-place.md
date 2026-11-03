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
| Actual Result | Of two simultaneous registrations for the last seat, one was 201 and one 409 REGISTRATION_FULL; one registration existed and no free seat. In "R2-T5 race: 500 attendees registering at once for 100 places leave exactly 100 registrations, each on its own seat (EN-13-T9 through R2)", 100 succeeded and 400 were refused for capacity, with 100 distinct seats. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 4f9ab08 · Evidence: backend/services/registration/tests/api/r2Cards.test.ts › R2-T5 race: two attendees registering at once for the last place leave exactly one registration, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41602701323 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
