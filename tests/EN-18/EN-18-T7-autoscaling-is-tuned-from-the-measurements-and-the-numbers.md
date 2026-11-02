# EN-18-T7 — Autoscaling is tuned from the measurements and the numbers are checked

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-18-T7 |
| Test Scenario | Autoscaling is tuned from the measurements and the numbers are checked |
| Pre-conditions | 1. Dependencies installed (`npm ci`).<br>2. The measurements of EN-18-T1 and EN-18-T6 are committed in `documentation/evidence/EN-18/`. |
| Test Steps | 1. Run `npx vitest run --config load/vitest.config.ts`; the autoscaling tests read the tuned HorizontalPodAutoscaler and the sizing in `deploy/k8s/components/autoscaling/`.<br>2. In CI, kubeconform validates the manifests in strict mode. |
| Test Data | The tuned registration HPA; the connection budget (pods x pool size at most 80% of the pooler limit). |
| Expected Result | The HPA's maximum replicas times the pool size stays within 80% of the pooler limit; the CPU request, target utilisation, minimum and maximum agree with the CPU cost per request measured in EN-18-T1; the manifests are valid. The write-up says the HPA was tuned from single-node measurements and was not demonstrated under load. |
| Acceptance criterion | Autoscaling tuned (CPU targets, minimum, maximum), with the reasoning documented. |
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
