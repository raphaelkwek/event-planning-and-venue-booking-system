# R2-T10 — Boundary: a registration one millisecond after closing is refused, naming the window, with nothing stored

## Specification

| Item | Content |
|---|---|
| Test Case ID | R2-T10 |
| Test Scenario | Boundary: a registration one millisecond after closing is refused, naming the window, with nothing stored |
| Pre-conditions | Automated (CI), against the registration schema, with the clock fixed at 2026-12-10T10:00:00.001Z. |
| Test Steps | 1. Register one millisecond after closing.<br>2. Count the attendee's registrations and the event's free seats. |
| Test Data | Closing `2026-12-10T10:00:00.000Z` |
| Expected Result | `422` `REGISTRATION_OUTSIDE_WINDOW`, with a message naming the opening and closing date and time. No registration is stored and the free seats are unchanged. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | At 2026-12-10T10:00:00.001Z: 422 REGISTRATION_OUTSIDE_WINDOW, "Registration for … opened on Tuesday 1 December 2026, 09:00 and closed on Thursday 10 December 2026, 18:00, so you can no longer register." No registration, no message, free seats unchanged (3). |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 4f9ab08 · Evidence: backend/services/registration/tests/api/r2Cards.test.ts › R2-T10 refuses a registration a millisecond after closing, naming the window, storing nothing, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41602701323 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
