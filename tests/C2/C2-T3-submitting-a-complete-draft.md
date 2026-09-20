# C2-T3 — Submitting a complete draft moves it to Submitted and records the submission time

## Specification

| Item | Content |
|---|---|
| Test Case ID | C2-T3 |
| Test Scenario | Submitting a complete draft moves it to Submitted and records the submission time |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`.<br>3. "New request" → enter the standard request → "Save draft". |
| Test Steps | 1. Click "My requests", then "Open draft" on "Annual Research Symposium".<br>2. Click "Submit request".<br>3. Click "My requests". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | Step 2 opens the request page with status "Submitted", a reference of the form `EVT-` followed by six digits, and a submission time. Step 3 shows exactly one "Annual Research Symposium" row, with status "Submitted" and a "View" link rather than "Open draft". |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The request page showed status "Submitted", reference EVT-001717 and submitted 9/20/2026, 3:26:22 PM. "My requests" held exactly one row: EVT-001717Annual Research SymposiumSubmitted—9/20/2026, 3:26:22 PMCoordinator OneView |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/C2/evidence/C2-T3.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
