# C1-T3 — Saving with no event name is refused (boundary: just below)

## Specification

| Item | Content |
|---|---|
| Test Case ID | C1-T3 |
| Test Scenario | Saving with no event name is refused (boundary: just below) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the Test Data.<br>3. Click "Save draft".<br>4. Click "My requests". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Event name: *(empty)* · Purpose: `Share faculty research` |
| Expected Result | Step 3 is refused with `VALIDATION_FAILED` "This draft could not be saved.", and "Event name is required." appears under Event name. Step 4 shows no new row. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused with "This draft could not be saved." and "Event name is required." under Event name. "My requests" listed no new row. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/C1/evidence/C1-T3.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
