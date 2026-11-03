# R6-T4 — Negative: a second waitlist entry for the same attendee and event is refused, naming the first

## Specification

| Item | Content |
|---|---|
| Test Case ID | R6-T4 |
| Test Scenario | Negative: a second waitlist entry for the same attendee and event is refused, naming the first |
| Pre-conditions | 1. R6-T1 done. |
| Test Steps | 1. Ask to join the same event's waitlist again through the API console, as in R6-T2. |
| Test Data | Attendee One's entry from R6-T1 |
| Expected Result | 409 `WAITLIST_DUPLICATE`, naming the first entry (`WL-…`). Still one entry. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The second join was refused 409 WAITLIST_DUPLICATE; its message and details.waitlistReference name the first entry WL-…; the attendee still has one entry. Two joins at once by another attendee gave one 201 and one 409. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: d7abf51 · Evidence: backend/services/registration/tests/api/r6Cards.test.ts › R6-T4 refuses a second waitlist entry, naming the first, even when two arrive at once, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
