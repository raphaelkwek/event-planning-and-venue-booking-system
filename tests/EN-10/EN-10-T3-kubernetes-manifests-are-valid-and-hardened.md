# EN-10-T3 — The Kubernetes manifests render and validate strictly, custom resources included, and every workload is hardened

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-10-T3 |
| Test Scenario | The Kubernetes manifests render and validate strictly, custom resources included, and every workload is hardened |
| Pre-conditions | 1. The Deploy workflow runs the `manifests` job (it runs on every pull request). |
| Test Steps | 1. Open the `Manifests (kustomize and kubeconform)` job.<br>2. Check `kubectl kustomize` rendered the base, staging, production and the two CI-only overlays.<br>3. Check `kubeconform -strict` passed on each rendered file, on `deploy/argocd/`, on `deploy/k8s/optional/` and on the test fixtures, with the Argo Rollouts, Argo CD and External Secrets schemas from the CRDs catalog.<br>4. Check `deploy/ci/check-rendered.py` passed: no Secret object; every Deployment, Rollout and Job runs non-root, without privilege escalation, read-only root filesystem, all capabilities dropped, with resource requests and limits and no `:latest` image; the Rollouts' canary steps are 10, analyse, 50, analyse, 100. |
| Test Data | The rendered overlays. |
| Expected Result | kubeconform reports no invalid resource and no skipped schema; the policy check prints `ok`. |
| Acceptance criterion | Kubernetes manifests: Deployments with probes, resources and a restrictive securityContext; Services; Ingress; HPAs; PodDisruptionBudgets; default-deny NetworkPolicy plus allows; ConfigMaps; Secrets only as references; validated with kubeconform -strict including CRD schemas. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: .github/workflows/deploy.yml › job 'Manifests (kustomize and kubeconform)' · Defect: |
| Executed By |  |
| Date of Execution |  |
