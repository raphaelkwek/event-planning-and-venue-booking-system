# A1-T8 — A successful sign-in records the last-login time and the user

## Specification

| Item | Content |
|---|---|
| Test Case ID | A1-T8 |
| Test Scenario | A successful sign-in records the last-login time and the user |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed out: the sign-in screen is showing.<br>3. The Supabase SQL editor is open. |
| Test Steps | 1. Note the current time.<br>2. Go to http://localhost:5173, enter the email and password, and click "Sign in".<br>3. In the Supabase SQL editor, run Query 1 from Test Data.<br>4. Run Query 2. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`<br>Query 1: `select last_login_at from identity.users where email = 'organiser@connectsphere.test';`<br>Query 2: `select outcome, user_id from identity.login_audit where email_tried = 'organiser@connectsphere.test' order by occurred_at desc limit 1;` |
| Expected Result | `last_login_at` is within one minute of the time noted in step 1. Query 2 returns outcome `SUCCESS` and user_id `00000000-0000-0000-0000-000000000001`. |
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
