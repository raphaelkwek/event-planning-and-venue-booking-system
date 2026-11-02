# EN-20-T8 — The Chaos Mesh manifests are valid

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-20-T8 |
| Test Scenario | The Chaos Mesh manifests are valid |
| Pre-conditions | 1. The CI job installs kubeconform and fetches the Chaos Mesh CRD schemas. |
| Test Steps | 1. Validate `deploy/chaos/` with kubeconform in strict mode. |
| Test Data | One manifest per staging experiment (1, 2, 3, 4, 6). |
| Expected Result | Every manifest is valid against the Chaos Mesh schemas. They are validated, not applied: there is no staging cluster to run them in. |
| Acceptance criterion | Chaos Mesh manifests for the staging experiments. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | kubeconform in strict mode, against the Chaos Mesh v2.7.2 PodChaos and NetworkChaos CRDs converted to JSON Schema by deploy/ci/crd-to-json-schema.py, found the 5 manifests in deploy/chaos valid (0 invalid, 0 errors, 0 skipped). They were validated, not applied. |
| Status | Pass |
| Remarks | Automated (load and chaos run in CI) · Commit: 477e05c · Evidence: `.github/workflows/load-chaos.yml` › job `Manifests (kubeconform, Chaos Mesh, autoscaling)`, step `Validate the Chaos Mesh manifests`, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41535317066 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
