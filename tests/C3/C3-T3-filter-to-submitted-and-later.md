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
