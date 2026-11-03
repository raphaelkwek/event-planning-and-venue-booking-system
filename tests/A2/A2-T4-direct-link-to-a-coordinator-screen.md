# A2-T4 — An organiser following a direct link to a coordinator screen is sent to their own screen

## Specification

| Item | Content |
|---|---|
| Test Case ID | A2-T4 |
| Test Scenario | An organiser following a direct link to a coordinator screen is sent to their own screen |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed; note the request id.<br>3. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. In the address bar, go to http://localhost:5173/#/queue.<br>2. In the address bar, go to http://localhost:5173/#/review/<id>. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · id: from the pre-condition |
| Expected Result | Both times "My requests" opens and the address bar ends in `#/requests`. No review queue rows, no clarification form, and no "Approve" or "Reject" button appear. |
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Both `#/queue` and `#/review/<id>` sent the organiser to "My requests" (`#/requests`); no review queue, clarification box or Approve button appeared. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/a-sign-in-and-access.spec.ts › A2-T4 an organiser following a direct link to a coordinator screen is sent to their own, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
