# B2-T13 — Registration closing one minute after the event start is refused (boundary: just above)

## Specification

| Item | Content |
|---|---|
| Test Case ID | B2-T13 |
| Test Scenario | Registration closing one minute after the event start is refused (boundary: just above) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the standard request, tick "Attendee registration is required", and enter the window in Test Data.<br>3. Click "Submit request". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Registration opens: 20 November 2026, 09:00 · Registration closes: 2 December 2026, 14:01 |
| Expected Result | Submission is refused with `VALIDATION_FAILED` "This request is not ready to be submitted.", and "Registration closing must be no later than the event start." appears under the Registration closes field. "My requests" shows no new submitted row. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused with the registration-closing message on its field; nothing stored. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/b-event-requests.spec.ts › B2-T13 registration closing one minute after the event start is refused, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |