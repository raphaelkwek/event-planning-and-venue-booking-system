# EN-22-T5 — The matrix ends with a summary per story

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-22-T5 |
| Test Scenario | The matrix ends with a summary per story |
| Pre-conditions | 1. As T1. |
| Test Steps | 1. Run the generator on a mixed fixture. |
| Test Data | As T1. |
| Expected Result | Per story: ACs covered, ACs with failures, ACs with no test, and test names that don't exist, with correct counts. |
| Acceptance criterion | Summary per story. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Per story: criteria, covered, failing, no test, unverified and not-found counts, in the summary table that ends the Markdown; the HTML escapes its content. |
| Status | Pass |
| Remarks | Commit: 62a261e · Evidence: documentation/scripts/traceability-matrix.test.ts › EN-22-T5 tests, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41512676026 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
