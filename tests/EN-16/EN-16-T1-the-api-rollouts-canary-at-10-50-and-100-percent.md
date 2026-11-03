# EN-16-T1 — planning-core and registration deploy as Argo Rollouts with canary steps of 10%, 50% and 100%, each gated by an analysis

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-16-T1 |
| Test Scenario | planning-core and registration deploy as Argo Rollouts with canary steps of 10%, 50% and 100%, each gated by an analysis |
| Pre-conditions | 1. The `manifests` job runs. |
| Test Steps | 1. Open the `Manifests (kustomize and kubeconform)` job.<br>2. Check the rendered staging and production overlays contain `Rollout` resources named planning-core and registration, and no Deployment of those names, and that their HorizontalPodAutoscalers target the Rollouts.<br>3. Check `check-rendered.py` passed its canary check: the steps are setWeight 10, analysis, setWeight 50, analysis, setWeight 100, and each analysis uses the `error-rate-and-p95` template. |
| Test Data | `deploy/k8s/components/canary/` applied by both overlays. |
| Expected Result | The job passes. Without a traffic router the weights are met by pod counts, so on 2 replicas 10% is one pod. |
| Acceptance criterion | An Argo Rollouts canary at 10, 50 and 100%. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Rendered staging and production overlays have planning-core and registration as Rollouts with steps setWeight 10, analysis, 50, analysis, 100, no Deployments of those names, and HPAs targeting the Rollouts; kubeconform -strict validated them. |
| Status | Pass |
| Remarks | Commit: 7f31fe5f8158bc75ca285a38e4ccca713e778a9f · Automated · Evidence: .github/workflows/deploy.yml › job 'Manifests (kustomize and kubeconform)' (kubeconform on the Rollout schema, check-rendered.py), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41511260190 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
