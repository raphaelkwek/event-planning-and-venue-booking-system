# D2-T3 — A clarification message of spaces only is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | D2-T3 |
| Test Scenario | A clarification message of spaces only is refused |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed. The coordinator is on the review screen. |
| Test Steps | 1. Enter the message.<br>2. Click "Send clarification request". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` · Message: three spaces |
| Expected Result | The request is refused with `VALIDATION_FAILED` "A clarification message is required.". "Clarifications" still reads "None requested." and the status is still "Under Review". |
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
