# D2-T2 — An empty clarification message is refused, storing nothing (boundary: just below)

## Specification

| Item | Content |
|---|---|
| Test Case ID | D2-T2 |
| Test Scenario | An empty clarification message is refused, storing nothing (boundary: just below) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed. The coordinator is on the review screen. |
| Test Steps | 1. Leave the message under "Ask for clarification" empty.<br>2. Click "Send clarification request". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` · Message: *(empty)* |
| Expected Result | The request is refused with `VALIDATION_FAILED` "A clarification message is required.". "Clarifications" still reads "None requested." and the status is still "Under Review". |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused with "VALIDATION_FAILEDA clarification message is required.message: A clarification message is required.HTTP 400 · correlation 34f12e23-d594-4c57-83e6-82a90cf989ad". "Clarifications" still read "None requested.", the status stayed "Under Review", and no clarification row was stored. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D2/evidence/D2-T2.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
