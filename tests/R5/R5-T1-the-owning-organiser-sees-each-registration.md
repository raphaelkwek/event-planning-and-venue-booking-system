# R5-T1 — The owning organiser sees each registration: the attendee's name, the registration timestamp and the current status

## Specification

| Item | Content |
|---|---|
| Test Case ID | R5-T1 |
| Test Scenario | The owning organiser sees each registration: the attendee's name, the registration timestamp and the current status |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with its defaults (3 seats), then FX-R-MANAGED.<br>3. Attendee One registers (R2-T1 steps 1–2) and signs out.<br>4. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. open `#/events/<EVENT_ID>/registrations` (the "Registrations" button on the event).<br>2. Read the row for Attendee One. |
| Test Data | One self-registration by Attendee One |
| Expected Result | The list has one row: `Attendee One`, the time Attendee One registered (Singapore time), status `Registered`, `Self-registered`. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The organiser's Registrations screen for the event (opened at #/events/<EVENT_ID>/registrations) listed one row: `Attendee One`, the time of the registration in Singapore time (as stored), `Registered`, `Self-registered`; the totals read `Registered 1`, `Withdrawn 0`, `Places remaining 2`, `Capacity 3`. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: a406635 · Evidence: tests/e2e/r-management.spec.ts › R5-T1 the owning organiser sees each registration with the attendee's name, its time and its status, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41773031885 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
