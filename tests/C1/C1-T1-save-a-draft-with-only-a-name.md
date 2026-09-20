# C1-T1 — Save a draft with only the event name

## Specification

| Item | Content |
|---|---|
| Test Case ID | C1-T1 |
| Test Scenario | Save a draft with only the event name |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the Event name and leave every other field empty.<br>3. Click "Save draft". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Event name: `Untitled idea` |
| Expected Result | "Saved as a draft at" followed by the time appears. The heading changes to "Edit draft" and the address bar ends in `#/drafts/<id>`. |
| Created By | Raphael Kwek |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "Saved as a draft at 3:25:47 PM." was shown, the heading became "Edit draft" and the address became /drafts/b252b457-6fc4-4bf6-898e-a9c12af7cc04. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/C1/evidence/C1-T1.png · Defect: — |
| Executed By | Shawmya |
| Date of Execution | 2026-09-20 |
