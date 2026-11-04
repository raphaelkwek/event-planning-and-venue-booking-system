# R7-T5 — D-01: when no places remain, the organiser is shown the capacity and the total the addition would make, and a confirmed addition records that it went over capacity

## Specification

| Item | Content |
|---|---|
| Test Case ID | R7-T5 |
| Test Scenario | D-01: when no places remain, the organiser is shown the capacity and the total the addition would make, and a confirmed addition records that it went over capacity |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with `<SEATS>` 2, FX-R-MANAGED, then FX-R-TAKEN with `<N>` = 2.<br>3. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Add Attendee One as in R7-T1 steps 1–2.<br>2. Read the dialog, then click "Add over capacity".<br>3. Read the row and the totals; open the event as an attendee would. |
| Test Data | 2 seats, both taken |
| Expected Result | Step 2: `Capacity 2`, `With this addition: 3 attendees`, and a warning that this takes the event over capacity. Step 3: the row is marked `Over capacity`; `Registered 3`, `Places remaining 0` (not −1); the event shows `Full`. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The dialog showed `Capacity 2`, `With this addition: 3 attendees` and `This takes the event over capacity`; Add over capacity answered 201. The row read `Added by Organiser One`, `Over capacity` and `Takes the next seat that is freed`; the totals `Registered 3`, `Withdrawn 0`, `Places remaining 0`, `Capacity 2`, `Added by hand 1`, `Over capacity by 1`; the database recorded it over capacity with no seat. The attendee's event page showed Full and no negative places. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: a406635 · Evidence: tests/e2e/r-management.spec.ts › R7-T5 over capacity: the capacity and the new total are shown, then the addition is recorded as over capacity, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41773031885 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
