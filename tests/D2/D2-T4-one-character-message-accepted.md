# D2-T4 — A one-character clarification message is accepted (boundary: exactly at)

## Specification

| Item | Content |
|---|---|
| Test Case ID | D2-T4 |
| Test Scenario | A one-character clarification message is accepted (boundary: exactly at) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed. The coordinator is on the review screen. |
| Test Steps | 1. Enter the message.<br>2. Click "Send clarification request". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` · Message: `?` |
| Expected Result | "?" appears under "Clarifications" and the status shows "Awaiting Clarification". |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "?" was listed under Clarifications and the status became "Awaiting Clarification". |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D2/evidence/D2-T4.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
