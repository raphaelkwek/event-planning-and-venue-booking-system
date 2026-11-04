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
| Remarks | Steps 1 and 2 as recorded before (lead:create through deploy:vm --lead on 4 Nov; the project-ref guard is unit-tested). Step 4, read-only from each project's database on 4 Nov: in production the invited Lead (identity user d4dcfc89-…, EVENT_COORDINATOR_LEAD) accepted the invite (email confirmed) and signed in to the web app at 04:15 UTC (Supabase Auth's last sign-in and identity's last-login both set); in staging the invited Lead (9af02c37-…) accepted the invite (04:12 UTC) but has no app sign-in recorded. Not executed: step 3 (a second run with the same email) writes to the environment's Supabase project, which these checks may only read, and staging's step 4 sign-in. · Defect: — |
| Executed By | — |
| Date of Execution | — |
