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
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Both rows were listed: "Still a draft" labelled Draft (rgb(23, 43, 77) on rgb(223, 225, 230)) and "Already submitted" labelled Submitted (rgb(23, 43, 77) on rgb(234, 230, 255)) — different colours. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/C3/evidence/C3-T1.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
