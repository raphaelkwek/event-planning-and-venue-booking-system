# C1-T10 — A failed save leaves the previously saved draft and its last-saved time unchanged

## Specification

| Item | Content |
|---|---|
| Test Case ID | C1-T10 |
| Test Scenario | A failed save leaves the previously saved draft and its last-saved time unchanged |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`.<br>3. "New request" → Event name `Original name`, Purpose `Original purpose` → "Save draft". In "My requests", note the draft's Last saved time, then "Open draft". |
| Test Steps | 1. Clear the Event name field.<br>2. Change Purpose to the value in Test Data.<br>3. Click "Save draft".<br>4. Click "My requests".<br>5. Click "Open draft" on the draft. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Purpose: `Changed purpose` |
| Expected Result | Step 3 is refused with `VALIDATION_FAILED` and "Event name is required.". In step 4 the Last saved time is exactly the time noted. In step 5 Event name is `Original name` and Purpose is `Original purpose`. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused with "Event name is required.". Last saved stayed Sun Sep 20 2026 15:26:10 GMT+0800 (Singapore Standard Time) (row: —Original nameDraft9/20/2026, 3:26:10 PM——Open draft) and reopening the draft showed "Original name" / "Original purpose". |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/C1/evidence/C1-T10.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
