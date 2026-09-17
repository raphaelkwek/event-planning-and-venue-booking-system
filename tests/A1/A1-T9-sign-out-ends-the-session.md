# A1-T9 — Signing out ends the session, and going back shows no event data

## Specification

| Item | Content |
|---|---|
| Test Case ID | A1-T9 |
| Test Scenario | Signing out ends the session, and going back shows no event data |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SUBMITTED completed, so "My requests" lists one request.<br>3. Signed in as `organiser@connectsphere.test` on "My requests". |
| Test Steps | 1. Click "Sign out".<br>2. Press the browser's Back button.<br>3. Press Back again.<br>4. Look in session storage for `connectsphere.session`. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | After step 1 the sign-in screen shows. After steps 2 and 3 the sign-in screen still shows, and no request name, reference or list is visible. Session storage has no `connectsphere.session` entry. |
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
