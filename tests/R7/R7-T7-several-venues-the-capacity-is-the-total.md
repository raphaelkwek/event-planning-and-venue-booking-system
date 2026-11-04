# R7-T7 — CQ-04: for an event with several venues, the capacity is the total of their layout capacities

## Specification

| Item | Content |
|---|---|
| Test Case ID | R7-T7 |
| Test Scenario | CQ-04: for an event with several venues, the capacity is the total of their layout capacities |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with `<SEATS>` 2, FX-R-SECOND-VENUE with `<SEATS>` 3, FX-R-MANAGED, then FX-R-TAKEN with `<N>` = 4.<br>3. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Add Attendee One as in R7-T1 steps 1–3. |
| Test Data | 2 + 3 seats, 4 taken |
| Expected Result | The dialog shows `Capacity 5` and `With this addition: 5 attendees`, with no over-capacity warning. Added, not over capacity; `Places remaining 0`. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With venues of 2 and 3 seats and 4 taken, the dialog showed `Capacity 5` and `With this addition: 5 attendees` with no over-capacity warning; Add attendee answered 201, the row read `Added by Organiser One`, the totals `Registered 5`, `Withdrawn 0`, `Places remaining 0`, `Capacity 5`, `Added by hand 1`, and the database recorded it not over capacity, holding a seat. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5eb3bfd · Evidence: tests/e2e/r-management.spec.ts › R7-T7 with several venues the capacity is their total, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41767254259 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
