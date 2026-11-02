# EN-22-T2 — A name in the CSV that no result contains is reported as not found

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-22-T2 |
| Test Scenario | A name in the CSV that no result contains is reported as not found |
| Pre-conditions | 1. As T1. |
| Test Steps | 1. Include a CSV row whose test name matches nothing in the reports. |
| Test Data | As T1. |
| Expected Result | The row's result is 'not found' and the story summary counts it under test names that don't exist. Skipped tests show 'skipped'. |
| Acceptance criterion | Pass, fail, skipped, not found. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | A name or file in no report is 'not found' with the reason; skipped is reported; a duplicate title takes the worst result; it.each templates are matched; each mismatch names its sprint file and row. |
| Status | Pass |
| Remarks | Commit: 62a261e · Evidence: documentation/scripts/traceability-matrix.test.ts › EN-22-T2 tests, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41512676026 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
