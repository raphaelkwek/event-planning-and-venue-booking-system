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
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | After Sign out the sign-in screen showed and stayed after two Back presses, with no request name, reference or table visible; session storage had no `connectsphere.session`. (Two in-app screens were opened before signing out so Back stays inside the app.) Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/a-sign-in-and-access.spec.ts › A1-T9 signing out ends the session, and going back shows no event data, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
