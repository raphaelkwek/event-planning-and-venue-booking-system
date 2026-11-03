# R6-T7 — Invited attendees register through R2, first come first served; registering ends that attendee's waitlist entry

## Specification

| Item | Content |
|---|---|
| Test Case ID | R6-T7 |
| Test Scenario | Invited attendees register through R2, first come first served; registering ends that attendee's waitlist entry |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`. Attendee Two's account (`tests/R5/README.md`).<br>2. FX-R-EVENT with `<SEATS>` 1, FX-R-MANAGED; Attendee Two registers, then FX-R-WAITLISTED with `<N>` = 1 (another attendee, first in line).<br>3. Attendee One joins the waitlist (second in line); Attendee Two withdraws, so one place is open and both waitlisted attendees are told. |
| Test Steps | 1. As Attendee One, open the event from "Events" and click "Register".<br>2. Open "My registrations".<br>3. As Attendee Two, try to register again (no place remains).<br>4. As the organiser, read the event's waitlist (R6-T5). |
| Test Data | 1 place open, 2 waitlisted |
| Expected Result | Step 1: Attendee One is registered, though second in line: places go to whoever registers first. Step 2: a `Registered` registration, and the waitlist entry reads `Registered` (it ended when they registered). Step 3: refused for capacity (`REGISTRATION_FULL`), offering the waitlist. Step 4: the attendee first in line is still `Waitlisted`; nobody was registered for them. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven at API level by backend/services/registration/tests/api/r6Cards.test.ts › R6-T7 lets whoever registers first take the open place, ending their waitlist entry, and refuses the next for capacity, which passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 (commit d7abf51). It needs a second attendee account (tests/R5/README.md). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
