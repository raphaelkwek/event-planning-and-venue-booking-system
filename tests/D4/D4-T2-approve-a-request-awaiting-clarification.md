# D4-T2 — Approve a request awaiting clarification (boundary: the other permitted status)

## Specification

| Item | Content |
|---|---|
| Test Case ID | D4-T2 |
| Test Scenario | Approve a request awaiting clarification (boundary: the other permitted status) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-AWAITING completed. The coordinator is on the review screen. |
| Test Steps | 1. Click "Approve". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | "This request is Approved" appears and the status shows "Approved". |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | A request Awaiting Clarification was approved and showed Approved. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/d-review.spec.ts › D4-T2 a request awaiting clarification can be approved, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
