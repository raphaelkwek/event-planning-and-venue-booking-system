# R7-T9 — Manually added attendees appear in R5's list distinguishable from self-registered ones, and count in the totals and places remaining

## Specification

| Item | Content |
|---|---|
| Test Case ID | R7-T9 |
| Test Scenario | Manually added attendees appear in R5's list distinguishable from self-registered ones, and count in the totals and places remaining |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with `<SEATS>` 3, FX-R-MANAGED, then FX-R-TAKEN with `<N>` = 1.<br>3. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. Add Attendee One (R7-T1 steps 1–3). |
| Test Steps | 1. open `#/events/<EVENT_ID>/registrations` (the "Registrations" button on the event) and read the rows and totals.<br>2. As an attendee, open the event from "Events". |
| Test Data | 1 self-registration, 1 manual addition |
| Expected Result | Step 1: one row `Self-registered`, one `Added by Organiser One`; `Registered 2`, `Places remaining 1`. Step 2: `1 place remaining`. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | After the organiser added Attendee One beside one self-registration, the reloaded list had one row `Self-registered` and one `Added by Organiser One`, with `Registered 2`, `Withdrawn 0`, `Places remaining 1`, `Capacity 3`, `Added by hand 1`; the attendee's event page showed `1 place remaining`. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5eb3bfd · Evidence: tests/e2e/r-management.spec.ts › R7-T9 manual additions are told apart from self-registrations and counted, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41767254259 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
