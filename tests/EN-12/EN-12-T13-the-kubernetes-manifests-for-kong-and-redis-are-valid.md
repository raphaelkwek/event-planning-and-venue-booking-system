# EN-12-T13 — The Kubernetes manifests for Kong and Redis render with kustomize and pass kubeconform in strict mode

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-12-T13 |
| Test Scenario | The Kubernetes manifests for Kong and Redis render with kustomize and pass kubeconform in strict mode |
| Pre-conditions | 1. kubectl (kustomize) and kubeconform 0.7 (CI only). No cluster exists, and nothing is applied. |
| Test Steps | 1. Run the `Validate the manifests` step of the `Kubernetes manifests` job in `.github/workflows/gateway.yml`. |
| Test Data | gateway/k8s |
| Expected Result | `kubectl kustomize gateway/k8s` renders and kubeconform reports no invalid resource. The Kong pods run non-root with a read-only root filesystem, probes, requests and limits, a PodDisruptionBudget and an HPA. |
| Acceptance criterion | Kong deployable as code (validated only; no cluster). |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
