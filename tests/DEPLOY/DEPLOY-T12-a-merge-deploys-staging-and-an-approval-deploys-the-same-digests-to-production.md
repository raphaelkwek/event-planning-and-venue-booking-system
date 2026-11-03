# DEPLOY-T12 — A merge to main deploys staging and smoke-tests it; production waits for approval and deploys the same digests

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T12 |
| Test Scenario | A merge to main deploys staging and smoke-tests it; production waits for approval and deploys the same digests |
| Pre-conditions | 1. The Oracle VM is bootstrapped, both Supabase and Vercel projects exist, and the GitHub environments `staging` and `production` hold every value in documentation/deploy/README.md.<br>2. A pull request is merged to main. |
| Test Steps | 1. Open the Release run.<br>2. Check `Deploy staging` applied the Secret, committed the release to `deploy-state`, waited for Argo CD to report Synced and Healthy at that commit, and passed the smoke tests (`/healthz` and `/readyz` of each service, the API over TLS, CORS, the SPA).<br>3. Check `Deploy production` waited for a required reviewer, then did the same with the same commit and digests.<br>4. Sign in on each Vercel URL as the environment's Lead. |
| Test Data | Each environment's own Supabase project. |
| Expected Result | Both environments are live on the same digests; production only after approval. |
| Acceptance criterion | Staging deploys automatically on every merge; production deploys the same digests after approval; smoke tests pass. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | — |
| Status | Blocked |
| Remarks | Blocked: the Oracle VM, the two Supabase projects, the two Vercel projects and the GitHub environments staging and production do not exist yet (documentation/deploy/README.md steps 1 to 6), and release.yml has not run on main. The deploy steps it runs are exercised on kind by DEPLOY-T4 to T7 and T11. |
| Executed By | — |
| Date of Execution | — |
