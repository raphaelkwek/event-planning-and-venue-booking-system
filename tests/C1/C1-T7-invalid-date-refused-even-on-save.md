# C1-T7 — A date that is not a valid date is refused even when saving a draft

## Specification

| Item | Content |
|---|---|
| Test Case ID | C1-T7 |
| Test Scenario | A date that is not a valid date is refused even when saving a draft |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. (The date picker cannot produce an invalid date, so this uses the API console.) |
| Test Steps | 1. Click "API console". Set Method to `POST` and Path to `/event/api/v1/event-drafts`, enter the Body from Test Data, and click "Send".<br>2. Click "API console". Set Method to `GET` and Path to `/event/api/v1/events?kind=drafts`, leave Body empty, and click "Send". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`<br>Body: `{"name": "Bad date", "proposedStartAt": "the 4th of Octember"}` |
| Expected Result | Step 1 returns HTTP 400 with error code `VALIDATION_FAILED`, and `fields` includes `proposedStartAt` with "must be a valid date and time". Step 2 has no item named "Bad date". |
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
