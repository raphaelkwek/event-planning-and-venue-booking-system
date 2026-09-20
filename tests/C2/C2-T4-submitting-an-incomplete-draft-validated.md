# C2-T4 — Submitting an incomplete draft applies the full submission validation

## Specification

| Item | Content |
|---|---|
| Test Case ID | C2-T4 |
| Test Scenario | Submitting an incomplete draft applies the full submission validation |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-DRAFT with Event name `Only a name` completed.<br>3. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "My requests", then "Open draft" on "Only a name".<br>2. Click "Submit request".<br>3. Click "My requests". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | Step 2 is refused with `VALIDATION_FAILED`, naming Purpose, Description, Proposed start, Proposed end and Expected attendance at once. Step 3 still shows "Only a name" as a Draft with no reference. |
| Created By | Raphael Kwek |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | One refusal named Purpose, Description, Proposed start, Proposed end and Expected attendance at once. The row stayed: —Only a nameDraft9/20/2026, 3:26:24 PM——Open draft |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/C2/evidence/C2-T4.png · Defect: — |
| Executed By | Shawmya |
| Date of Execution | 2026-09-20 |
