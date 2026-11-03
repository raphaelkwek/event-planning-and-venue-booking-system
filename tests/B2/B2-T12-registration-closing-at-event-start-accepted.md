# B2-T12 — Registration closing exactly at the event start is accepted (boundary: exactly at)

## Specification

| Item | Content |
|---|---|
| Test Case ID | B2-T12 |
| Test Scenario | Registration closing exactly at the event start is accepted (boundary: exactly at) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the standard request, tick "Attendee registration is required", and enter the window in Test Data.<br>3. Click "Submit request". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Registration opens: 20 November 2026, 09:00 · Registration closes: 2 December 2026, 14:00 |
| Expected Result | The request page opens with status "Submitted" and a reference of the form `EVT-` followed by six digits. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The request was accepted and submitted. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/b-event-requests.spec.ts › B2-T12 registration closing exactly at the event start is accepted, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |