# B2-T7 — Expected attendance of 0 is refused (boundary: just below)

## Specification

| Item | Content |
|---|---|
| Test Case ID | B2-T7 |
| Test Scenario | Expected attendance of 0 is refused (boundary: just below) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the standard request, with the change in Test Data.<br>3. Click "Submit request". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Expected attendance: `0` |
| Expected Result | Submission is refused with `VALIDATION_FAILED` "This request is not ready to be submitted.", and "Expected attendance must be a whole number from 1 to 1000000." appears under the Expected attendance field. "My requests" shows no new submitted row. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused with the attendance message on Expected attendance; nothing stored. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: b81df4f · Evidence: tests/e2e/b-event-requests.spec.ts › B2-T7 an expected attendance of 0 is refused, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41640867276 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |