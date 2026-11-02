# EN-16-T2 — A good release passes the Prometheus analysis at 10% and 50% and is promoted to 100%

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-16-T2 |
| Test Scenario | A good release passes the Prometheus analysis at 10% and 50% and is promoted to 100% |
| Pre-conditions | 1. The Deploy workflow runs `Canary promotes a good release and rolls back a bad one (kind)`. |
| Test Steps | 1. Open the job and read the log of `deploy/ci/canary-demo.sh`, section `Release 2: a good version`.<br>2. Check Prometheus was scraping the pods, and that the Rollout moved through setWeight 10, an AnalysisRun, setWeight 50, an AnalysisRun, then 100%, ending Healthy with the new pod template stable.<br>3. Check two AnalysisRuns are Successful. |
| Test Data | Argo Rollouts, a minimal Prometheus, the real AnalysisTemplate with 10 s measurements, a stand-in service that serves 200 and exposes `http_requests_total` and `http_request_duration_seconds`, and a load generator. |
| Expected Result | The Rollout reaches Healthy and both analyses succeed. This used a stand-in service, not planning-core. |
| Acceptance criterion | Prometheus analysis of error rate and p95 gates the canary steps. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With a stand-in service, the real AnalysisTemplate (10 s measurements) and a minimal Prometheus, version 2 was promoted through 10% and 50% to 100%; two AnalysisRuns Successful; stable template moved from 944ffddf8 to 5cddb84d5c. |
| Status | Pass |
| Remarks | Commit: 7f31fe5f8158bc75ca285a38e4ccca713e778a9f · Automated · Evidence: .github/workflows/deploy.yml › job 'Canary promotes a good release and rolls back a bad one (kind)'; deploy/ci/canary-demo.sh, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41511260190 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
