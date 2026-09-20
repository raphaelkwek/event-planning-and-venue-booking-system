# C3-T2 — The list can be filtered to drafts only

## Specification

| Item | Content |
|---|---|
| Test Case ID | C3-T2 |
| Test Scenario | The list can be filtered to drafts only |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-DRAFT with Event name `Still a draft` completed.<br>3. FX-SUBMITTED with Event name `Already submitted` completed. |
| Test Steps | 1. Sign in as `organiser@connectsphere.test` and click "My requests".<br>2. Click "Drafts only". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | Only "Still a draft" is listed. |
| Created By | Raphael Kwek |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "Drafts only" listed "Still a draft" and nothing else. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/C3/evidence/C3-T2.png · Defect: — |
| Executed By | Shawmya |
| Date of Execution | 2026-09-20 |
