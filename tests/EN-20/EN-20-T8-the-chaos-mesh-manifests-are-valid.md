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
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
