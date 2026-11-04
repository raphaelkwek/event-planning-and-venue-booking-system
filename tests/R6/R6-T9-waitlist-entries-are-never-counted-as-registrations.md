# R6-T9 — Waitlist entries consume no places and are never counted as registrations in R5's totals

## Specification

| Item | Content |
|---|---|
| Test Case ID | R6-T9 |
| Test Scenario | Waitlist entries consume no places and are never counted as registrations in R5's totals |
| Pre-conditions | 1. R6-T5 done. |
| Test Steps | 1. As the organiser, read the list's totals.<br>2. As Attendee One, open the event from "Events". |
| Test Data | 1 seat taken, 3 waitlisted |
| Expected Result | Step 1: `Registered 1`, `Places remaining 0`; the waitlist's 3 entries are shown apart (`Waiting 3`) and not in the registration totals or rows. Step 2: `Full`. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The organiser's totals read `Registered 1`, `Withdrawn 0`, `Places remaining 0`, `Capacity 1`, with one registration row (not Attendee One's); the waitlist was shown apart, `3 attendees are waiting.` with three rows; the database held one registration. Attendee One's event page showed Full. Run on CI's throwaway stack, with unique names in place of the card's literal names. The screen words the waitlist count `3 attendees are waiting.` where the card says `Waiting 3`. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: a406635 · Evidence: tests/e2e/r-management.spec.ts › R6-T9 waitlist entries are never counted as registrations, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41773031885 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
