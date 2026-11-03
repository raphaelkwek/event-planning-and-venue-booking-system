# DEPLOY-T14 — The first Lead user is created in an environment with that environment's service-role key

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T14 |
| Test Scenario | The first Lead user is created in an environment with that environment's service-role key |
| Pre-conditions | 1. The environment's migrations have run. |
| Test Steps | 1. Run `npm run lead:create` with the environment's SUPABASE_URL, service-role key and session-pooler URL, and an email.<br>2. Run it with a SUPABASE_URL whose project ref differs from `--project-ref`.<br>3. Run it again with the same email. |
| Test Data | A new email address. |
| Expected Result | Step 1 creates the Auth user and its identity user with the EVENT_COORDINATOR_LEAD role and prints the password once; step 2 is refused before any request; step 3 changes nothing. |
| Acceptance criterion | Creating the first Lead user in each environment with that environment's service-role key and the identity tables. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | — |
| Status | Not Executed |
| Remarks | — |
| Executed By | — |
| Date of Execution | — |
