# R3-T5 — Each entry shows the registration timestamp and, only where applicable, the withdrawal timestamp

## Specification

| Item | Content |
|---|---|
| Test Case ID | R3-T5 |
| Test Scenario | Each entry shows the registration timestamp and, only where applicable, the withdrawal timestamp |
| Pre-conditions | Same as R3-T1. |
| Test Steps | 1. Click "My registrations". |
| Test Data | One Registered and one Withdrawn registration |
| Expected Result | The Withdrawn row shows `Registered <day>, <time>` and `Withdrawn <day>, <time>`, the withdrawal later than the registration. The Registered row shows `Registered <day>, <time>` and no withdrawal time. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven by backend/services/registration/tests/api/r3Cards.test.ts › R3-T1 R3-T5 lists each of my registrations, newest first, with the event's name, times, venue location, status and timestamps (API level), and the screen in frontend/tests/attendeeRegistration.test.tsx against a stubbed API, passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41602701323 (commit 4f9ab08). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
