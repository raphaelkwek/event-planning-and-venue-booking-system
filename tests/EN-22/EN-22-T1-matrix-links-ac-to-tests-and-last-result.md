# EN-22-T1 — The matrix gives each acceptance criterion its tests and each test's last result

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-22-T1 |
| Test Scenario | The matrix gives each acceptance criterion its tests and each test's last result |
| Pre-conditions | 1. tsx installed. |
| Test Steps | 1. Run the generator's unit tests (npm run test:scripts).<br>2. Feed it a CSV with two ACs and a vitest JSON report with one pass and one fail. |
| Test Data | Synthetic CSV and report fixtures in the test file. |
| Expected Result | Each AC row lists its tests; each test shows pass or fail from the report. Output is Markdown and HTML. |
| Acceptance criterion | Story, AC, test, last-result matrix. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | CSV parsing, report parsing and the matrix link each criterion to its tests and their pass or fail results; Markdown and HTML are produced. |
| Status | Pass |
| Remarks | Commit: 62a261e · Evidence: documentation/scripts/traceability-matrix.test.ts › EN-22-T1 tests, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41512676026 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
