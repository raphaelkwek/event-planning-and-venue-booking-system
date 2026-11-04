# DEPLOY-T3 — The k3s overlays render, validate strictly with their CRDs, pass the hardening checks, and differ only in namespace, hostnames and Secret names

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T3 |
| Test Scenario | The k3s overlays render, validate strictly with their CRDs, pass the hardening checks, and differ only in namespace, hostnames and Secret names |
| Pre-conditions | 1. The Deploy workflow's `Manifests` job runs (every pull request). |
| Test Steps | 1. Open `Manifests (kustomize and kubeconform)`.<br>2. Check `deploy/k8s/overlays/k3s-staging` and `k3s-production` render and pass `kubeconform -strict`, including the Traefik Middleware and cert-manager Issuer and Certificate schemas.<br>3. Check the hardening check passed for both (no Secret, every container non-root, read-only, capabilities dropped, sized, no :latest).<br>4. Check the parity step: after the namespace, the API hostname, the middleware reference and the TLS Secret name are normalised, the two renders are identical. |
| Test Data | None. |
| Expected Result | All three steps pass. A difference other than those four names fails the parity step. |
| Acceptance criterion | Staging and production overlays are identical apart from namespace, hostnames and Secret names. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | k3s-staging and k3s-production rendered and passed kubeconform -strict with the Traefik Middleware and cert-manager Issuer and Certificate schemas, passed check-rendered.py --no-canary (no Secret; every container, init containers and StatefulSets included, non-root, read-only, capabilities dropped, sized, no :latest), and check-parity.py found them identical once the namespace, API host, TLS Secret name and middleware reference were normalised. |
| Status | Pass |
| Remarks | Automated (CI) · Commit: f76866586a318aa5852f75edab518cb95ffd7690 · Evidence: .github/workflows/deploy.yml › job 'Manifests (kustomize and kubeconform)', CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41614563160 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
