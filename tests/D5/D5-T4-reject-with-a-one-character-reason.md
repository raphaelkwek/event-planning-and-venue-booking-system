# D5-T4 — Reject with a reason of a single character (boundary: exactly at)

## Specification

| Item | Content |
|---|---|
| Test Case ID | D5-T4 |
| Test Scenario | Reject with a reason of a single character (boundary: exactly at) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed. The coordinator is on the review screen. |
| Test Steps | 1. Click "Reject".<br>2. Enter the reason.<br>3. Click "Reject request". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` · Reason: `x` |
| Expected Result | The dialog closes, the status shows "Rejected", and the reason "x" is shown. |
| Created By | Seann, via Claude |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
