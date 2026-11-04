# R7-T2 — The assigned coordinator can add an attendee manually too, without a reason

## Specification

| Item | Content |
|---|---|
| Test Case ID | R7-T2 |
| Test Scenario | The assigned coordinator can add an attendee manually too, without a reason |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with its defaults, then FX-R-MANAGED.<br>3. Signed in as `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. As R7-T1 steps 1–3, leaving the reason empty. |
| Test Data | Attendee One; no reason |
| Expected Result | The row reads `Added by Coordinator One`, with no reason. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Coordinator One's dialog showed `Capacity 3` and `With this addition: 1 attendee`; the addition answered 201 and the row read `Added by Coordinator One` with no reason; the database recorded Coordinator One as the adder, no reason, status REGISTERED. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: a406635 · Evidence: tests/e2e/r-management.spec.ts › R7-T2 the assigned coordinator adds an attendee with no reason, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41773031885 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
