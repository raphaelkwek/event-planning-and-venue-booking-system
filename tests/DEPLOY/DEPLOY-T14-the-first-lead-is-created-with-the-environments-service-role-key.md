# DEPLOY-T14 — The first Lead user is created in an environment with that environment's service-role key

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T14 |
| Test Scenario | The first Lead user is created in an environment with that environment's service-role key |
| Pre-conditions | 1. The environment's migrations have run. |
| Test Steps | 1. Run `npm run lead:create` with the environment's SUPABASE_URL, service-role key and session-pooler URL, an email and `--redirect-to` the environment's web origin.<br>2. Run it with a SUPABASE_URL whose project ref differs from `--project-ref`.<br>3. Run it again with the same email.<br>4. Open the invite email's link, set a password on the web app's Set your password screen (DEPLOY-T16), and sign in. |
| Test Data | A new email address. |
| Expected Result | Step 1 invites the Lead through Supabase Auth's admin invite (no password in the request or the output) and creates the identity user with the EVENT_COORDINATOR_LEAD role; step 2 is refused before any request; step 3 changes nothing and sends no second invite; step 4 signs the Lead in. |
| Acceptance criterion | Creating the first Lead user in each environment with that environment's service-role key and the identity tables. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | — |
| Status | Not Executed |
| Remarks | Steps 1 and 2: on 4 Nov lead:create (through deploy:vm --lead) invited joash.lau.2024@computing.smu.edu.sg in both projects through Supabase Auth's admin invite and gave the identity user EVENT_COORDINATOR_LEAD (staging identity user 9af02c37-…, production d4dcfc89-…); the guard is unit-tested. Pending: step 3 (a second run) and step 4, the Lead setting a password from the email and signing in. |
| Executed By | — |
| Date of Execution | — |
