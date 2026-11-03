# DEPLOY-T4 — The k3s staging overlay deploys on kind with its own Redpanda, Temporal dev server and Cerbos, and every service reports ready

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T4 |
| Test Scenario | The k3s staging overlay deploys on kind with its own Redpanda, Temporal dev server and Cerbos, and every service reports ready |
| Pre-conditions | 1. The Deploy workflow's `kind: k3s staging overlay` job runs. |
| Test Steps | 1. Check the job installed Traefik and cert-manager, built the deploy state from this commit (remote base pinned to the commit) with this build's images, and applied it.<br>2. Check Redpanda (SASL/SCRAM over TLS from a cert-manager CA), the Temporal dev server (SQLite on a PersistentVolumeClaim) and Cerbos became ready in a namespace that enforces the restricted Pod Security Standard.<br>3. Check `/readyz` of planning-core, registration and notification reports the database `ok` and Kafka `reachable`.<br>4. Check the Temporal worker logged `Temporal worker started` and is still running, and Cerbos reports SERVING. |
| Test Data | Throwaway Postgres in the cluster (never Supabase). A random Kafka password made for the run. |
| Expected Result | The job passes: the services authenticate to Redpanda with SCRAM over TLS and the worker connects to Temporal. |
| Acceptance criterion | Redpanda (SASL/SCRAM), the Temporal dev server and a Cerbos PDP run in each namespace; their addresses and credentials arrive through KAFKA_*, TEMPORAL_* and CERBOS_URL. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | On kind v1.33.1 with Traefik and cert-manager, the deploy state built from this commit's overlay on GitHub (remote base ?ref=<commit>, rendered identically by kubectl and by Argo CD v2.14.11's kustomize) was applied. Redpanda (SCRAM over TLS from the internal CA), the Temporal dev server (SQLite on a PVC) and Cerbos became ready under the restricted Pod Security Standard; /readyz of planning-core, registration and notification reported database ok and kafka reachable; the worker logged 'Temporal worker started' and did not restart in the next 20 s; Cerbos reported SERVING. |
| Status | Pass |
| Remarks | Automated (kind, CI) · Commit: f76866586a318aa5852f75edab518cb95ffd7690 · Evidence: deploy/ci/kind-k3s.sh, job 'kind: k3s staging overlay (Redpanda, Temporal, Cerbos, Traefik)', CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41614563160 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
