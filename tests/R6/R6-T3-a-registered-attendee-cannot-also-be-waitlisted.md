# R6-T3 — Negative: an attendee holding an active registration cannot also join the event's waitlist

## Specification

| Item | Content |
|---|---|
| Test Case ID | R6-T3 |
| Test Scenario | Negative: an attendee holding an active registration cannot also join the event's waitlist |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with `<SEATS>` 1; Attendee One registers (R2-T1 steps 1–2), so the event is full.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Ask to join the waitlist through the API console, as in R6-T2. |
| Test Data | 1 seat, held by Attendee One |
| Expected Result | 409 `REGISTRATION_DUPLICATE`, naming Attendee One's registration (`REG-…`). No waitlist entry exists. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | 409 REGISTRATION_DUPLICATE; the message and details.registrationReference name the attendee's registration REG-…; the event has no waitlist entry. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: d7abf51 · Evidence: backend/services/registration/tests/api/r6Cards.test.ts › R6-T3 refuses to waitlist an attendee who holds a registration, naming it, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
