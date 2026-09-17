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
