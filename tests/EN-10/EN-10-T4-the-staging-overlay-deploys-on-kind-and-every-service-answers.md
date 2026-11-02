# EN-10-T4 — The staging overlay deploys on a kind cluster and every service becomes ready and answers its health endpoint

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-10-T4 |
| Test Scenario | The staging overlay deploys on a kind cluster and every service becomes ready and answers its health endpoint |
| Pre-conditions | 1. The Deploy workflow runs `kind smoke deploy (staging overlay)` (it runs when deploy/, a Dockerfile or the workflow changes, and on main).<br>2. The `images` jobs passed. |
| Test Steps | 1. Open the `kind smoke deploy (staging overlay)` job.<br>2. Check it created a kind cluster, loaded this build's images, installed Argo Rollouts, created the throwaway Postgres in the `test-deps` namespace and the `connectsphere-secrets` Secret with `kubectl create secret`, then applied `deploy/k8s/test/kind-staging` (the staging overlay with this build's images and the Temporal worker at zero replicas).<br>3. Check the `migrate` Job completed, the planning-core and registration Rollouts reached Healthy, and the notification and web Deployments rolled out, in a namespace that enforces the restricted Pod Security Standard.<br>4. Check the health table in the job summary: `/readyz` of planning-core, registration and notification reports the database `ok`, and web answers `/healthz` and falls back to the app shell. |
| Test Data | Throwaway Postgres in the cluster. No Kafka, no Supabase, no Temporal. |
| Expected Result | The job passes. Not shown by this run: Kafka consumers and the outbox relay (no Kafka), token verification (no Supabase) and the Temporal worker (no namespace). |
| Acceptance criterion | A kind smoke deploy in CI: the staging overlay, rollouts awaited, health endpoints curled. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: .github/workflows/deploy.yml › job 'kind smoke deploy (staging overlay)' · Defect: |
| Executed By |  |
| Date of Execution |  |
