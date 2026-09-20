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
| Actual Result | Refused with "VALIDATION_FAILEDThis request is not ready to be submitted.description: Description is required.proposedStartAt: Proposed start date and time is required.proposedEndAt: Proposed end date and time is required.expectedAttendance: Expected attendance is required.HTTP 400 · correlation acde42e6-ef0c-4685-8b50-d549537fe51f". The form still held Event name "Half-finished symposium" and Purpose "Share faculty research"; "My requests" listed no such row and no event row was stored. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/B1/evidence/B1-T6.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
