# DEPLOY-T12 — A merge to main deploys staging and smoke-tests it; production waits for approval and deploys the same digests

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T12 |
| Test Scenario | A merge to main deploys staging and smoke-tests it; production waits for approval and deploys the same digests |
| Pre-conditions | 1. The Oracle VM is bootstrapped, both Supabase and Vercel projects exist, and the GitHub environments `staging` and `production` hold every value in documentation/deploy/README.md.<br>2. A pull request is merged to main. |
| Test Steps | 1. Open the Release run.<br>2. Check `Deploy staging (Azure VM)` verified the image's signature, deployed it through the deploy gate, waited until each service's `/readyz` reported the database ok and Kafka reachable, and passed the smoke tests (the API over TLS, its routes and CORS, the SPA).<br>3. Check `Deploy production` waited for a required reviewer, then did the same with the same commit and digests.<br>4. Sign in on each Vercel URL as the environment's Lead. |
| Test Data | Each environment's own Supabase project. |
| Expected Result | Both environments are live on the same digests; production only after approval. |
| Acceptance criterion | Staging deploys automatically on every merge; production deploys the same digests after approval; smoke tests pass. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

> **Revised 2026-11-04, for ADR-0016's Azure amendment.** The environments run on one Azure VM, one
> container each, not on k3s with Argo CD, so the Release run's k3s jobs are skipped and step 2 reads
> `Deploy staging (Azure VM)`: it verified the image's signature, deployed the container through the
> deploy gate (migrations run as it starts) and waited until every service was ready, then passed the
> API smoke test (TLS, routes, CORS) and the web smoke test. Step 3 reads `Deploy production (Azure VM)`.
> The expected result is unchanged.

## Execution record

| Item | Content |
|---|---|
| Actual Result | — |
| Status | Not Executed |
| Remarks | Partly proven on 4 Nov from the laptop (deploy:vm, documentation/evidence/DEPLOY/azure-first-deploy.md): staging, then production on the same image, each smoke-tested (TLS, routes, CORS, /readyz database ok and Kafka reachable, Cerbos, the SPA). Not yet run: the automated path, release.yml to deploy-vm-environment.yml with production's required reviewer, which waits for the GitHub environments' values. |
| Executed By | — |
| Date of Execution | — |
