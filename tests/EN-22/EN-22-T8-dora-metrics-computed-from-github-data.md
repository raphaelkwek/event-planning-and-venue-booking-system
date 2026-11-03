# EN-22-T8 — The four DORA metrics are computed from merges and workflow runs

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-22-T8 |
| Test Scenario | The four DORA metrics are computed from merges and workflow runs |
| Pre-conditions | 1. tsx installed. |
| Test Steps | 1. Run the DORA unit tests.<br>2. Feed them merged PRs, first commits and main run conclusions. |
| Test Data | Synthetic PR and run lists with known answers. |
| Expected Result | Deployment frequency, lead time (first commit to merge), change failure rate and time to restore equal the hand-computed values, including empty windows. |
| Acceptance criterion | Four DORA metrics. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Deployment frequency, lead time, change failure rate and time to restore equal the hand-computed values, including empty windows, re-runs, cancelled runs and open incidents. |
| Status | Pass |
| Remarks | Commit: 62a261e · Evidence: documentation/scripts/dora.test.ts › EN-22-T8 tests, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41512676026 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
