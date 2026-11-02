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
| Actual Result | The autoscaling unit tests passed (8 in autoscaling.unit.test.ts, 5 in sizing.unit.test.ts): for 3.0 ms of CPU per request (at or above every measured figure), 500 req/s, a 500m request at 70%, the sizing gives 5 pods at the peak, a maximum of 8 within the 16 the connection budget (5 connections a pod, 80% of 100) allows, and a minimum of 2; the component's HPA and pod patches equal them. The Manifests job rendered the component with kubectl kustomize (minReplicas 2, maxReplicas 8, 70%, 500m/1000m, REGISTRATION_DB_POOL_MAX) and kubeconform found 4 resources valid. The evidence README says the HPA was tuned from single-node measurements and was not demonstrated. |
| Status | Pass |
| Remarks | Automated (unit tests and manifest validation in CI) · Commit: 477e05c · Evidence: `load/tests/autoscaling.unit.test.ts` and `load/tests/sizing.unit.test.ts` (CI job `Lint, typecheck, build, unit tests`, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41535317499); `.github/workflows/load-chaos.yml` › job `Manifests (kubeconform, Chaos Mesh, autoscaling)`, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41535317066 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
