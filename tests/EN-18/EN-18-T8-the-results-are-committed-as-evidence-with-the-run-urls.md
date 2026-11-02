# EN-18-T8 — The results are committed as evidence with the run URLs

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-18-T8 |
| Test Scenario | The results are committed as evidence with the run URLs |
| Pre-conditions | 1. The `Load and chaos` workflow has run on the pull request, and its outputs are committed under `documentation/evidence/EN-18/`. |
| Test Steps | 1. Run `npx vitest run --config load/vitest.config.ts`; `evidence.unit.test.ts` opens `documentation/evidence/EN-18/` and each scenario's files.<br>2. Check each result passed and names the run the write-up names. |
| Test Data | k6 summary JSON per scenario, and `README.md`. |
| Expected Result | The folder holds the k6 summary JSON for each scenario that ran, a write-up with the numbers, the arrival rate achieved, what the runner limited, and the run URL for each result. Anything that did not run is marked Not run. |
| Acceptance criterion | Results committed as evidence. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | evidence.unit.test.ts passed (20 tests): each of smoke, spike-1, spike-2, spike-3, soak and stress has k6-summary.json, result.json and result.md; each result passed its checks and names the run the README names; the README states the rate achieved and that the HPA was not demonstrated; the six EN-20 write-ups each have their five sections, the four that ran name their run, the two that did not say so. |
| Status | Pass |
| Remarks | Automated (unit tests in CI) · Commit: 477e05c · Evidence: `load/tests/evidence.unit.test.ts` (CI job `Lint, typecheck, build, unit tests`), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41535317499 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
