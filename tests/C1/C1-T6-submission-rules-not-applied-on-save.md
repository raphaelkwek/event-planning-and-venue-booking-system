# C1-T6 — Submission rules are not applied when saving a draft

## Specification

| Item | Content |
|---|---|
| Test Case ID | C1-T6 |
| Test Scenario | Submission rules are not applied when saving a draft |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the Test Data.<br>3. Click "Save draft".<br>4. Click "My requests". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Event name: `Rough idea` · Proposed start: 1 September 2026, 14:00 · Proposed end: 1 September 2026, 10:00 · Expected attendance: `0` |
| Expected Result | Step 3 saves the draft ("Saved as a draft at" followed by the time) even though the start is in the past, the end is before the start, and attendance is zero. Step 4 lists "Rough idea" as a Draft. |
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
