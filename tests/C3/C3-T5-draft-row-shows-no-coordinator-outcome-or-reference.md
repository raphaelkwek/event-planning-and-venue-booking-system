# C3-T5 — A draft row shows no coordinator, no review outcome and no reference

## Specification

| Item | Content |
|---|---|
| Test Case ID | C3-T5 |
| Test Scenario | A draft row shows no coordinator, no review outcome and no reference |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-DRAFT with Event name `Still a draft` completed. |
| Test Steps | 1. Sign in as `organiser@connectsphere.test` and click "My requests". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | The "Still a draft" row shows "—" under "Reference" and "—" under "Coordinator", and no approval or rejection outcome. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The draft row read: — \| Still a draft \| Draft \| 9/20/2026, 3:26:50 PM \| — \| — \| Open draft — "—" for Reference and Coordinator, and no approval or rejection outcome. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/C3/evidence/C3-T5.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
