# R6-T12 — Boundary: an invited attendee is held to the registration window, and is refused after its closing instant

## Specification

| Item | Content |
|---|---|
| Test Case ID | R6-T12 |
| Test Scenario | Boundary: an invited attendee is held to the registration window, and is refused after its closing instant |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`. Attendee Two's account (`tests/R5/README.md`).<br>2. FX-R-EVENT with `<SEATS>` 1 and `<CLOSES>` `now() + interval '10 minutes'`; Attendee Two registers; Attendee One joins the waitlist; Attendee Two withdraws. |
| Test Steps | 1. After the closing time passes, as Attendee One, try to register through the API console (`POST /registration/api/v1/registrations`). |
| Test Data | 1 place open, registration closed |
| Expected Result | 422 `REGISTRATION_OUTSIDE_WINDOW`, naming the window. The waitlist entry is still `Waitlisted`. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | One millisecond after the closing instant: 422 REGISTRATION_OUTSIDE_WINDOW, the message naming the window (closed on Thursday 10 December 2026, 18:00), and the entry still Waitlisted. At the closing instant itself the registration was accepted. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: d7abf51 · Evidence: backend/services/registration/tests/api/r6Cards.test.ts › R6-T12 holds an invited attendee to the window: one millisecond after closing they are refused, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
