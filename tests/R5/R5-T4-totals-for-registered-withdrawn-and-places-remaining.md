# R5-T4 — Totals for registered, withdrawn and places remaining are derived from the registration records

## Specification

| Item | Content |
|---|---|
| Test Case ID | R5-T4 |
| Test Scenario | Totals for registered, withdrawn and places remaining are derived from the registration records |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with `<SEATS>` 4, FX-R-MANAGED, then FX-R-TAKEN with `<N>` = 3.<br>3. One of those three withdrawn: FX-R-WITHDRAW-ONE.<br>4. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. open `#/events/<EVENT_ID>/registrations` (the "Registrations" button on the event).<br>2. Read the totals. |
| Test Data | 4 seats · 3 registrations, 1 of them withdrawn |
| Expected Result | `Registered 2`, `Withdrawn 1`, `Places remaining 2`, `Capacity 4`. Three rows: two `Registered`, one `Withdrawn`. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The totals read `Registered 2`, `Withdrawn 1`, `Places remaining 2`, `Capacity 4`, and the list had three rows: two `Registered` and one `Withdrawn`. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: a406635 · Evidence: tests/e2e/r-management.spec.ts › R5-T4 totals for registered, withdrawn and places remaining come from the records, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41773031885 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
