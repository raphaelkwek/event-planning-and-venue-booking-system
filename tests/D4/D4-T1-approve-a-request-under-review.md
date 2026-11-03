# D4-T1 — Approve a request under review

## Specification

| Item | Content |
|---|---|
| Test Case ID | D4-T1 |
| Test Scenario | Approve a request under review |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed. The coordinator is on the review screen. |
| Test Steps | 1. Click "Approve". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | "This request is Approved" appears, reading "Decided", the date and time, and "by Coordinator One". The status shows "Approved", and "Approve" and "Reject" are both disabled. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Status became Approved, "Decided <time> by Coordinator One." was shown, and Approve and Reject were disabled. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/d-review.spec.ts › D4-T1 the coordinator approves a request under review, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
