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
| Actual Result | With Attendee Two's place freed and another attendee first in line, Attendee One (second) saw `1 place remaining`, registered (201) and saw `You are registered`. My registrations showed the registration `Registered` and the waitlist entry `Registered` with its time (stored as REGISTERED, naming the new registration). Attendee Two then saw Full, and the console's registration answered 409 `REGISTRATION_FULL` with `waitlistOffered` true. The organiser's waitlist showed the first attendee still `Waitlisted` and Attendee One `Registered`; nobody was registered for the first attendee. Run on CI's throwaway stack, with unique names in place of the card's literal names. Attendee Two was added to the job's own database. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: a406635 · Evidence: tests/e2e/r-management.spec.ts › R6-T7 invited attendees register first come, first served, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41773031885 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
