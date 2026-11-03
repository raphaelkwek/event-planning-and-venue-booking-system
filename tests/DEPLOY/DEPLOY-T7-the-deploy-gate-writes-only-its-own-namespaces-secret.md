# DEPLOY-T7 — The deploy gate writes the environment's Secret only in its own namespace, accepts only known keys and never prints a value

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T7 |
| Test Scenario | The deploy gate writes the environment's Secret only in its own namespace, accepts only known keys and never prints a value |
| Pre-conditions | 1. The `kind: k3s staging overlay` job has applied the deployer RBAC that bootstrap.sh applies. |
| Test Steps | 1. Pipe the env file from `deploy/release/secret-env.mjs` to `connectsphere-deploy staging apply-secret`.<br>2. Pipe a file with an unknown key, and one with a malformed line.<br>3. Run a verb the gate does not know.<br>4. Ask whether the staging deployer may read Secrets in connectsphere-production, or anything in kube-system. |
| Test Data | Throwaway values made for the run. |
| Expected Result | Step 1 writes `connectsphere-secrets` in connectsphere-staging and prints only key names and kubectl's one-line result. Steps 2 and 3 are refused with nothing written. Step 4 answers no. |
| Acceptance criterion | Secrets live only in the GitHub Environments; the workflow reads them and writes the Kubernetes Secrets over SSH. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | secret-env.mjs wrote exactly the gate's keys with the fixed in-cluster addresses and refused missing or malformed values naming the variable only (unit). In kind the gate created connectsphere-secrets in connectsphere-staging, printing key names and 'created', then 'unchanged', never the Kafka password; it refused an unknown key, a malformed line, a missing key, an unknown verb and a short commit; the staging deployer may not read production's or kube-system's Secrets, create pods or delete Secrets. |
| Status | Pass |
| Remarks | Automated (unit and kind, CI) · Commit: f76866586a318aa5852f75edab518cb95ffd7690 · Evidence: deploy/release/release.test.mjs › DEPLOY-T7 (two tests); job 'kind: k3s staging overlay (Redpanda, Temporal, Cerbos, Traefik)', step 'The deploy gate writes the Secret, and refuses what it should', CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41614563160 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
