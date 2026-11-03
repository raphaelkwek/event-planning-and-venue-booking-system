# EN-22-T7 — The traceability CI job runs after the test jobs and publishes the matrix

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-22-T7 |
| Test Scenario | The traceability CI job runs after the test jobs and publishes the matrix |
| Pre-conditions | 1. A pull request or push to main (CI). |
| Test Steps | 1. Open the CI run.<br>2. Read the traceability job's step summary and artifacts. |
| Test Data | This pull request's CI run. |
| Expected Result | Job 'traceability' ran after checks and integration, wrote a summary to the step summary and uploaded the full matrix as an artifact. Warnings do not fail the job. |
| Acceptance criterion | CI generates the matrix on every run. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The traceability job ran after the checks and integration jobs, wrote the summary to the job summary, annotated mismatches as warnings, and uploaded the traceability-matrix artifact; it passed although integration was red. |
| Status | Pass |
| Remarks | Commit: 62a261e · Evidence: CI job 'Traceability matrix' in https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41512676026, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41512676026 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
