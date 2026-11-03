# A3-T1 — An organiser's list contains only the requests they own

## Specification

| Item | Content |
|---|---|
| Test Case ID | A3-T1 |
| Test Scenario | An organiser's list contains only the requests they own |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. As `organiser2@connectsphere.test`: FX-SUBMITTED with Event name `Organiser two's symposium`.<br>3. As `organiser@connectsphere.test`: FX-SUBMITTED. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `organiser@connectsphere.test`.<br>2. Click "My requests". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | "Annual Research Symposium" is listed. "Organiser two's symposium" is not. |
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "My requests" listed the organiser's own requests and not Organiser Two's. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/a-sign-in-and-access.spec.ts › A3-T1 an organiser's list contains only the requests they own, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
