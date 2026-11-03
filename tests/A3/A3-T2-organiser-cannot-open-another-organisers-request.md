# A3-T2 — An organiser opening another organiser's request by direct link gets no event data

## Specification

| Item | Content |
|---|---|
| Test Case ID | A3-T2 |
| Test Scenario | An organiser opening another organiser's request by direct link gets no event data |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. As `organiser2@connectsphere.test`: FX-SUBMITTED; note the request id; sign out. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `organiser@connectsphere.test`.<br>2. In the address bar, go to http://localhost:5173/#/requests/<id>. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · id: from the pre-condition |
| Expected Result | A refusal titled `EVENT_NOT_FOUND` reads "No event with that reference is available to you." (HTTP 404). No event name, purpose, description or other detail of the request is shown. |
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The direct link to Organiser Two's request showed the not-found refusal and none of its data. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/a-sign-in-and-access.spec.ts › A3-T2 an organiser opening another organiser's request by direct link gets no event data, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
