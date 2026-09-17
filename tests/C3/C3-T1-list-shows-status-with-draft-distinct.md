# C3-T1 — The list shows every request's status, with Draft visually distinct

## Specification

| Item | Content |
|---|---|
| Test Case ID | C3-T1 |
| Test Scenario | The list shows every request's status, with Draft visually distinct |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-DRAFT with Event name `Still a draft` completed.<br>3. FX-SUBMITTED with Event name `Already submitted` completed. |
| Test Steps | 1. Sign in as `organiser@connectsphere.test` and click "My requests".<br>2. Make sure "All" is selected. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | Both rows are listed. "Still a draft" shows a "Draft" status label and "Already submitted" a "Submitted" label, and the two labels are different colours. |
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
