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
| Status | Blocked |
| Remarks | Blocked: neither environment's Supabase project exists yet. Proven in CI: the guard (step 2), the arguments, and that the invite request carries no password, by deploy/scripts/create-lead.test.mjs › DEPLOY-T14 (four tests). |
| Executed By | — |
| Date of Execution | — |
