# B2-T1 — Submitting with every mandatory field empty names each one at once

## Specification

| Item | Content |
|---|---|
| Test Case ID | B2-T1 |
| Test Scenario | Submitting with every mandatory field empty names each one at once |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Leave every field empty and both checkboxes unticked.<br>3. Click "Submit request". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | Submission is refused with `VALIDATION_FAILED`. The one refusal names all six at once — Event name, Purpose, Description, Proposed start, Proposed end and Expected attendance — and each shows its own message under its field. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | One refusal (VALIDATION_FAILED) named all six fields at once, and each message was shown under its own field: Event name, Purpose, Description, Proposed start, Proposed end, Expected attendance. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/B2/evidence/B2-T1.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
