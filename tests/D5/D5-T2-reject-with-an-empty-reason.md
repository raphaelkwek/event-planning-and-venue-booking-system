# D5-T2 — Reject with the reason left empty (boundary: just below)

## Specification

| Item | Content |
|---|---|
| Test Case ID | D5-T2 |
| Test Scenario | Reject with the reason left empty (boundary: just below) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed. The coordinator is on the review screen. |
| Test Steps | 1. Click "Reject".<br>2. Leave the reason empty.<br>3. Click "Reject request".<br>4. Click "Cancel". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` · Reason: *(empty)* |
| Expected Result | In step 3 the dialog stays open and shows "A reason is required to reject an event request.". After step 4 the status is still "Under Review", no decision is shown, and "Approve" and "Reject" are enabled. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused with the reason-required message in the dialog; the request stayed Under Review. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/d-review.spec.ts › D5-T2 rejecting with the reason left empty is refused, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
