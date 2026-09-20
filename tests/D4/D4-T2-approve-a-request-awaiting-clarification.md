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
| Actual Result | A request in Awaiting Clarification was approved: "This request is Approved" appeared and the status became "Approved". |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D4/evidence/D4-T2.png · Defect: — |
| Executed By | Raphael Kwek |
| Date of Execution | 2026-09-20 |
