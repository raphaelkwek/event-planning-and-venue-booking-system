# EN-22-T3 — An AC with no test row is listed as having no test

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-22-T3 |
| Test Scenario | An AC with no test row is listed as having no test |
| Pre-conditions | 1. As T1. |
| Test Steps | 1. Include a CSV row with an empty test_name. |
| Test Data | As T1. |
| Expected Result | The AC appears in the summary as 'no test' and is not counted as covered. |
| Acceptance criterion | Missing tests are reported. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | A row with no test name gives state 'no test' and is counted under noTest, not covered. |
| Status | Pass |
| Remarks | Commit: 62a261e · Evidence: documentation/scripts/traceability-matrix.test.ts › a criterion whose row has no test name has no test, and is not covered (EN-22-T3), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41512676026 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
