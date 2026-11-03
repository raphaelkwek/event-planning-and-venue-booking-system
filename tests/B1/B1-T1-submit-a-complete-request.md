# B1-T1 — Submit a complete event request

## Specification

| Item | Content |
|---|---|
| Test Case ID | B1-T1 |
| Test Scenario | Submit a complete event request |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the standard request.<br>3. Click "Submit request". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Request: the standard request (`tests/README.md`) |
| Expected Result | The request page opens. The status shows "Submitted". A reference of the form `EVT-` followed by six digits is shown under the event name. The submission date and time are shown next to "Submitted". "Organiser" in the side panel shows "Organiser One". |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The standard request was submitted from the form, shown Submitted with its reference, and listed in the Lead's unassigned requests (since E3 it reaches a coordinator only once assigned). Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/b-event-requests.spec.ts › B1-T1 an organiser submits a complete request, which needs no equipment, and the Lead can assign it, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |