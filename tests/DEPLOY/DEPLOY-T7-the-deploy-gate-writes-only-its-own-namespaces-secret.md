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
| Actual Result | — |
| Status | Not Executed |
| Remarks | — |
| Executed By | — |
| Date of Execution | — |
