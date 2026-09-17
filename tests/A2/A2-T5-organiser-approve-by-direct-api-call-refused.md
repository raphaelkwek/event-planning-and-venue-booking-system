# A2-T5 — An organiser's direct API call to approve is refused and changes nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | A2-T5 |
| Test Scenario | An organiser's direct API call to approve is refused and changes nothing |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed; note the request id.<br>3. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "API console", then the "Approve without being a coordinator" preset.<br>2. In Path, replace `PASTE-EVENT-ID` with the id, and click "Send".<br>3. Click "My requests", then "View" on the request. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · id: from the pre-condition |
| Expected Result | Step 2 returns HTTP 403 with error code `ROLE_NOT_AUTHORISED` and message "Your role is not authorised to use this function." In step 3 the status is still "Under Review" and Decision reads "None yet". |
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
