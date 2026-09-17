# A1-T7 — A failed sign-in creates no session and records no last-login time

## Specification

| Item | Content |
|---|---|
| Test Case ID | A1-T7 |
| Test Scenario | A failed sign-in creates no session and records no last-login time |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed out: the sign-in screen is showing.<br>3. The Supabase SQL editor is open. |
| Test Steps | 1. In the Supabase SQL editor, run Query 1 from Test Data. Note `last_login_at`.<br>2. Go to http://localhost:5173, enter the email and password, and click "Sign in".<br>3. Open session storage in the browser developer tools and look for `connectsphere.session`.<br>4. Run Query 1 again.<br>5. Run Query 2. |
| Test Data | Account: `organiser@connectsphere.test` / `WrongPassword-1`<br>Query 1: `select last_login_at from identity.users where email = 'organiser@connectsphere.test';`<br>Query 2: `select outcome from identity.login_audit where email_tried = 'organiser@connectsphere.test' order by occurred_at desc limit 1;` |
| Expected Result | Sign-in is refused. Session storage has no `connectsphere.session` entry. `last_login_at` in step 4 is identical to step 1. Query 2 returns `INVALID_CREDENTIALS`. |
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
