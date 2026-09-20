# B1-T6 — A submission that fails validation creates no record and keeps the entered values on screen

## Specification

| Item | Content |
|---|---|
| Test Case ID | B1-T6 |
| Test Scenario | A submission that fails validation creates no record and keeps the entered values on screen |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`; "My requests" lists nothing. |
| Test Steps | 1. Click "New request".<br>2. Enter the Test Data, leaving every other field empty.<br>3. Click "Submit request".<br>4. Check the Event name and Purpose fields.<br>5. Click "My requests". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`<br>Event name: `Half-finished symposium` · Purpose: `Share faculty research` |
| Expected Result | Step 3 is refused with `VALIDATION_FAILED`. In step 4 both fields still hold the values typed. In step 5 no "Half-finished symposium" row appears. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | VALIDATION_FAILED was shown, both entered values remained on screen, and no event row was created. |
| Status | Pass |
| Remarks | Commit: b0ef6ee · Evidence: tests/B1/evidence/B1-T6-2026-09-20.png · Defect: — |
| Executed By | Joash Lau Rong Wei |
| Date of Execution | 2026-09-20 |