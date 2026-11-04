# DEPLOY-T16 — An invited user sets their own password on the web app's Set your password screen

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T16 |
| Test Scenario | An invited user sets their own password on the web app's Set your password screen |
| Pre-conditions | 1. A Supabase Auth invite or password-reset link has sent the browser to the web app with a session in the address bar's fragment (`#/set-password#access_token=…`, or `#access_token=…` at the site root). |
| Test Steps | 1. Open the link.<br>2. Enter a password shorter than six characters, then two passwords that differ.<br>3. Enter the same valid password twice and choose Set password.<br>4. Repeat with a link Supabase refuses (a weak password, then an expired session).<br>5. Open `#/set-password` with no session, and with an error link. |
| Test Data | A made-up session token; Supabase Auth answered by a stand-in. |
| Expected Result | Step 1 shows the screen and removes the session from the address bar. Step 2 is refused on the screen with nothing sent. Step 3 sends `PUT /auth/v1/user` with the link's session and the new password only, then shows the sign-in screen with a notice that the password is set. Step 4 shows Supabase's reason, and for the expired session asks for a new link. Step 5 asks for the email link again and offers sign in. |
| Acceptance criterion | Creating the first Lead user in each environment: the Lead sets their own password from the invite. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The screen showed and the session left the address bar (#/set-password); a 5-character password and a mismatch were refused on the screen with no request; the same valid password twice sent PUT http://supabase.test/auth/v1/user with Bearer <link session>, the anon key and a body of only the password, then the sign-in screen showed 'Your password is set'; Supabase's 422 reason was shown, and a 401 asked for a new link; with no session or an error link the screen asked for the email link again and Go to sign in reached sign-in, with nothing sent. The links parsed from the site root and after the route, and a root link was moved onto the screen. |
| Status | Pass |
| Remarks | Automated (frontend unit, jsdom, CI) · Commit: d36de39469d8e8e1349ae625cd061cfa33a2c130 · Evidence: frontend/tests/setPassword.test.tsx › DEPLOY-T16 (seven tests), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41639707648 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
