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
| Actual Result | kubectl kustomize rendered deploy/k8s/test/cdc; kubeconform -strict (Kubernetes 1.33.0) passed all 3 objects (a ConfigMap, a Deployment and a PersistentVolumeClaim: 3 valid, 0 invalid); check-cdc-rendered.py confirmed one replica with the Recreate strategy, host network with ClusterFirstWithHostNet, a non-root pod, a container with no privilege escalation, a read-only root filesystem, all capabilities dropped, requests and limits, a tagged image, ENABLE_DEBEZIUM_SCRIPTING=true, no Secret, every credential a secretKeyRef, and the ConfigMap and claim the volumes name rendered. This does not show the pod runs on the Oracle node or reaches Supabase. |
| Status | Pass |
| Remarks | Automated (CI job) · Commit: 379c576 · Evidence: deploy/ci/check-cdc-rendered.py and the kubeconform step, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41636336928 job "CDC component manifests (kustomize, kubeconform)" · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
