# EN-23-T5 — The ranked gaps list is present and each gap cites a location

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-23-T5 |
| Test Scenario | The ranked gaps list is present and each gap cites a location |
| Pre-conditions | Dependencies installed (`npm ci`). No database, Kafka or Prometheus server is needed unless the steps say so. |
| Test Steps | 1. Open the 'Top gaps' section of documentation/security/threat-model.md.<br>2. Check the ranking and the citations. |
| Test Data | documentation/security/threat-model.md |
| Expected Result | At least ten gaps are listed in rank order, each with a severity, a file:line and a suggested fix. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The "Top gaps, ranked" section of threat-model.md had at least ten rows, numbered G1, G2 and so on in order. Each row had five cells (rank, gap, severity, location, suggested fix), a severity of Critical, High, Medium or Low, and a file:line location. |
| Status | Pass |
| Remarks | Automated (document check in CI) · Commit: a74ca8b · Evidence: documentation/scripts/check-docs.test.ts › EN-23-T5 the ranked gap list has at least ten gaps, in order, each with a location, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41601054398, job Lint, typecheck, build, unit tests (step test:scripts) · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
