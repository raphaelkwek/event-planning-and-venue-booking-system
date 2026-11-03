# D5-T1 — Reject a request under review, giving a reason

## Specification

| Item | Content |
|---|---|
| Test Case ID | D5-T1 |
| Test Scenario | Reject a request under review, giving a reason |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed. The coordinator is on the review screen. |
| Test Steps | 1. Click "Reject".<br>2. Enter the reason in the dialog.<br>3. Click "Reject request". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` · Reason: `No venue can host 150 people on 2 December.` |
| Expected Result | The dialog closes. The status shows "Rejected". The page shows the reason "No venue can host 150 people on 2 December." and the decision date and time. "Approve" and "Reject" are both disabled. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The dialog closed, status Rejected, the reason and decision time shown, Approve and Reject disabled. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/d-review.spec.ts › D5-T1 the coordinator rejects a request under review, giving a reason, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
