# EN-16 evidence: canary releases

Run: https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41511260190 (commit `7f31fe5f8158bc75ca285a38e4ccca713e778a9f`). Raw output is the artifact `evidence-canary-rollback`.

| Acceptance criterion | Status | Card |
|---|---|---|
| Argo Rollouts canary at 10, 50 and 100% (planning-core, registration) | Validated in CI (rendered overlays, kubeconform) | EN-16-T1 |
| Prometheus analysis of error rate and p95 | Demonstrated in kind with the real AnalysisTemplate, a minimal Prometheus and a stand-in service | EN-16-T2 |
| Automatic rollback demonstrated | Demonstrated in kind | EN-16-T3 |
| Queries match EN-17's real metrics | **Not run** (EN-17 not merged, no staging) | EN-16-T4 |

**What was demonstrated.** A full Prometheus analysis, not a Job substitute. The workload was a stand-in
service exposing `http_requests_total{status}` and `http_request_duration_seconds`, not planning-core,
because no `/metrics` exists on main. The AnalysisTemplate is the one the overlays use; only its timers were
shortened (a measurement every 10 s, six per analysis). The queries depend on EN-17 keeping those names.

## EN-16 canary demonstration (kind, Argo Rollouts v1.8.3, Prometheus)

Stand-in service, real AnalysisTemplate (queries and thresholds unchanged; a measurement every 10 s, six per analysis). Steps: 10%, analyse, 50%, analyse, 100%.

**Release 2 (good):** promoted through 10% and 50% to 100%. Two AnalysisRuns Successful. Stable pod template `944ffddf8` became `5cddb84d5c`.

**Release 3 (bad, answers 500):** the AnalysisRun `demo-app-5ff8956678-3-1` Failed, the Rollout aborted and rolled back on its own. Rollout message: `RolloutAborted: Rollout aborted update to revision 3: Metric "error-rate" assessed Failed due to failed (2) > failureLimit (1)`

After the rollback only pod template `5cddb84d5c` (version 2) is running, and 20 requests through the Service returned: `200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 `
metric error-rate: Failed, 2 failed, 0 successful, measurements: Error=null Failed=[1] Failed=[1]
metric p95-latency: Successful, 0 failed, 2 successful, measurements: Error=null Successful=[0.00475] Successful=[0.00475]
