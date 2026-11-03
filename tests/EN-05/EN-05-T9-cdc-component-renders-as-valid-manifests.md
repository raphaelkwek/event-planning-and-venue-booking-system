# EN-05-T9 — The Debezium Server kustomize component renders into valid Kubernetes objects that the deployment can include

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-05-T9 |
| Test Scenario | The Debezium Server kustomize component renders into valid Kubernetes objects that the deployment can include |
| Pre-conditions | 1. The component at `deploy/k8s/components/cdc`, and a test overlay that includes it. |
| Test Steps | 1. Render the overlay with `kubectl kustomize`.<br>2. Validate the output against the Kubernetes schemas with kubeconform in strict mode.<br>3. Check that the output holds no credential value and that the pod mounts its secret by reference. |
| Test Data | `deploy/k8s/components/cdc/` and `deploy/k8s/test/cdc/`. |
| Expected Result | The overlay renders, every object passes kubeconform, the Deployment runs one replica with the Recreate strategy, and the only credentials are `secretKeyRef` entries. This card proves the manifests are well formed. It does not prove they run on the Oracle node or reach Supabase. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
