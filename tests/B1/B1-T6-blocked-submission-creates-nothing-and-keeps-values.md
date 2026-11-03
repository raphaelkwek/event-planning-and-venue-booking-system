# B1-T6 — A submission that fails validation creates no record and keeps the entered values on screen

## Specification

| Item | Content |
|---|---|
| Test Case ID | B1-T6 |
| Test Scenario | A submission that fails validation creates no record and keeps the entered values on screen |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`; "My requests" lists nothing. |
| Test Steps | 1. Click "New request".<br>2. Enter the Test Data, leaving every other field empty.<br>3. Click "Submit request".<br>4. Check the Event name and Purpose fields.<br>5. Click "My requests". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`<br>Event name: `Half-finished symposium` · Purpose: `Share faculty research` |
| Expected Result | Step 3 is refused with `VALIDATION_FAILED`. In step 4 both fields still hold the values typed. In step 5 no "Half-finished symposium" row appears. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The refused submission created no request and every typed value stayed on screen. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/b-event-requests.spec.ts › B1-T6 a blocked submission creates nothing and keeps the values typed, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |