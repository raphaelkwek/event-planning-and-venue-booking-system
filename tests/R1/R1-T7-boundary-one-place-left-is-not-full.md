# R1-T7 — Boundary: with one place left the event shows 1 place remaining and still offers Register

## Specification

| Item | Content |
|---|---|
| Test Case ID | R1-T7 |
| Test Scenario | Boundary: with one place left the event shows 1 place remaining and still offers Register |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with its defaults (3 seats), then FX-R-TAKEN with `<N>` = 2.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Click "Events" and find `R Test Symposium`.<br>2. Click "View event". |
| Test Data | 3 seats, 2 taken |
| Expected Result | The card shows `1 place remaining` and no Full label. The event page offers the "Register" button. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With 2 of 3 seats taken, the card and the event page showed `1 place remaining`, no Full label, and the event page offered Register. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/r-registration.spec.ts › R1-T7 boundary: with one place left the event shows 1 place remaining, no Full label, and still offers Register, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
