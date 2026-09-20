# C3-T3 — The list can be filtered to submitted-and-later requests

## Specification

| Item | Content |
|---|---|
| Test Case ID | C3-T3 |
| Test Scenario | The list can be filtered to submitted-and-later requests |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-DRAFT with Event name `Still a draft` completed.<br>3. FX-SUBMITTED with Event name `Already submitted` completed.<br>4. FX-APPROVED with Event name `Already approved` completed. |
| Test Steps | 1. Sign in as `organiser@connectsphere.test` and click "My requests".<br>2. Click "Submitted and later". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | "Already submitted" and "Already approved" are listed. "Still a draft" is not. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "Submitted and later" listed the submitted and the approved request, and not the draft. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/C3/evidence/C3-T3.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
