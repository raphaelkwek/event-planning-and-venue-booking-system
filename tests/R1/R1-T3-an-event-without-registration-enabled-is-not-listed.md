# R1-T3 — Negative: a Confirmed event whose registration is not enabled is not listed

## Specification

| Item | Content |
|---|---|
| Test Case ID | R1-T3 |
| Test Scenario | Negative: a Confirmed event whose registration is not enabled is not listed |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with `<REQUIRED>` = `false` and the name `R No Registration`.<br>3. FX-R-EVENT run again with its defaults.<br>4. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Click "Events".<br>2. Look for both events. |
| Test Data | `R No Registration` (Confirmed, registration not required) · `R Test Symposium` (defaults) |
| Expected Result | `R Test Symposium` is listed. `R No Registration` is not listed anywhere on the page. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The event with registration enabled was listed; the Confirmed event whose registration is not required (`R No Registration`) appeared nowhere on the page. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/r-registration.spec.ts › R1-T3 a Confirmed event whose registration is not enabled is not listed, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
