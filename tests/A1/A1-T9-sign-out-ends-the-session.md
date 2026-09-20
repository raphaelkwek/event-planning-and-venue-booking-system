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
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The sign-in screen showed after signing out and stayed after both Back presses; the request name (Annual Research Symposium) and reference (EVT-001698) were never visible. No connectsphere.session in session storage. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/A1/evidence/A1-T9.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
