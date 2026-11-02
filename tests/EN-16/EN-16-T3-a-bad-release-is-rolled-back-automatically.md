# EN-16-T3 — A bad release that passes its health check but answers 500 is aborted by the error-rate analysis and the stable version keeps serving

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-16-T3 |
| Test Scenario | A bad release that passes its health check but answers 500 is aborted by the error-rate analysis and the stable version keeps serving |
| Pre-conditions | 1. The same job as EN-16-T2, after its good release. |
| Test Steps | 1. Read the log section `Release 3: a bad version that passes its health check but answers 500`.<br>2. Check the AnalysisRun for the canary Failed on the `error-rate` metric, the Rollout aborted (`status.abort` true, phase Degraded), the stable pod template did not change, and only the stable version's pods are running afterwards.<br>3. Check 20 requests through the Service returned only 200. |
| Test Data | Version 3 of the stand-in service, started with MODE=bad. |
| Expected Result | The Rollout aborts and returns to version 2 without anyone running a command; the job asserts each of these. |
| Acceptance criterion | Automatic rollback demonstrated. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Version 3 (answers 500, passes health check): error-rate AnalysisRun Failed (2 failed > limit 1), Rollout aborted, stable stayed on version 2, only version 2 pods remained, 20 of 20 requests through the Service returned 200. |
| Status | Pass |
| Remarks | Commit: 7f31fe5f8158bc75ca285a38e4ccca713e778a9f · Automated · Evidence: .github/workflows/deploy.yml › job 'Canary promotes a good release and rolls back a bad one (kind)'; deploy/ci/canary-demo.sh, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41511260190 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
