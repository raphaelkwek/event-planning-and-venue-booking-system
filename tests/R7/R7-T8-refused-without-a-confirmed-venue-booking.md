# R7-T8 — Negative: a manual addition is refused when the event has no confirmed venue booking

## Specification

| Item | Content |
|---|---|
| Test Case ID | R7-T8 |
| Test Scenario | Negative: a manual addition is refused when the event has no confirmed venue booking |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-NO-VENUE, then FX-R-MANAGED.<br>3. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Add Attendee One as in R7-T1 steps 1–2. |
| Test Data | An event with no confirmed booking |
| Expected Result | 422 `REGISTRATION_NO_CONFIRMED_BOOKING`: `… has no confirmed venue booking, so its capacity is not known yet …`. Nothing stored. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | For the event with no confirmed booking, confirming the dialog answered 422 `REGISTRATION_NO_CONFIRMED_BOOKING` and the dialog showed `EVT-R… “…” has no confirmed venue booking, so its capacity is not known yet and nobody can be added.`; no registration was stored. Run on CI's throwaway stack, with unique names in place of the card's literal names. The dialog first shows `Capacity 0` and offers Add over capacity; the refusal comes when that is confirmed. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5eb3bfd · Evidence: tests/e2e/r-management.spec.ts › R7-T8 an addition is refused while the event has no confirmed venue booking, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41767254259 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
