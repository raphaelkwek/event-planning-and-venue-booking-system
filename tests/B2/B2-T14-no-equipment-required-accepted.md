# B2-T14 — "No equipment required" is accepted as a complete equipment answer

## Specification

| Item | Content |
|---|---|
| Test Case ID | B2-T14 |
| Test Scenario | "No equipment required" is accepted as a complete equipment answer |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the standard request, leaving "Equipment is required" unticked.<br>3. Click "Submit request". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Equipment is required: unticked |
| Expected Result | The request page opens with status "Submitted" and a reference of the form `EVT-` followed by six digits. On the request page, "Equipment requirements" shows "None required". (Shown as "Equipment required: No" until 2026-09-17, when venue and equipment requirements were added to the form and the request page.) |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With "Equipment is required" unticked the request was accepted and stored as needing no equipment. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/b-event-requests.spec.ts › B1-T1 an organiser submits a complete request, which needs no equipment, and the Lead can assign it, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |