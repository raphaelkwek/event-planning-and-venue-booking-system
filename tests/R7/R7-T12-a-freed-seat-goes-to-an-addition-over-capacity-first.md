# R7-T12 — Race: a seat freed by a withdrawal goes first to an attendee added over capacity, so places remaining never shows a place that is not free

## Specification

| Item | Content |
|---|---|
| Test Case ID | R7-T12 |
| Test Scenario | Race: a seat freed by a withdrawal goes first to an attendee added over capacity, so places remaining never shows a place that is not free |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`. Attendee Two's account (`tests/R5/README.md`).<br>2. FX-R-EVENT with `<SEATS>` 2, FX-R-MANAGED; Attendee Two registers; FX-R-TAKEN with `<N>` = 1.<br>3. As the organiser, add Attendee One over capacity (R7-T5 steps 1–2). |
| Test Steps | 1. As Attendee Two, withdraw.<br>2. As Attendee Two, open the event and try to register again.<br>3. As the organiser, open the list (R5-T1). |
| Test Data | 2 seats, 3 attendees |
| Expected Result | Step 2: still `Full`, and refused for capacity: the freed seat went to Attendee One, added over capacity, so the total is back to capacity, not below it. Step 3: `Registered 2`, `Withdrawn 1`, `Places remaining 0`. Under concurrent withdrawals, additions and registrations, the number of attendees never exceeds the seats plus those added over capacity. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With 2 seats taken by Attendee Two and another attendee and Attendee One added over capacity, Attendee Two withdrew in the browser (200). Attendee Two's event page still showed Full and the console's registration answered 409 `REGISTRATION_FULL`; the freed seat went to Attendee One's addition (it now holds a seat, still marked over capacity). The organiser's totals read `Registered 2`, `Withdrawn 1`, `Places remaining 0`, `Capacity 2`, `Added by hand 1`. The concurrency clause is proven at API level (Remarks). Run on CI's throwaway stack, with unique names in place of the card's literal names. Attendee Two was added to the job's own database. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5eb3bfd · Evidence: tests/e2e/r-management.spec.ts › R7-T12 a freed seat goes to an attendee added over capacity first; the concurrency clause by backend/services/registration/tests/api/r7Cards.test.ts › R7-T12 gives a freed seat to an addition over capacity first, under concurrent withdrawals, additions and registrations, in the same run's integration tests, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41767254259 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
