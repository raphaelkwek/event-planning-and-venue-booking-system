# EN-23-T2 — Every file:line reference in the security documents points at a real line

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-23-T2 |
| Test Scenario | Every file:line reference in the security documents points at a real line |
| Pre-conditions | Dependencies installed (`npm ci`). No database, Kafka or Prometheus server is needed unless the steps say so. |
| Test Steps | 1. Run the document check.<br>2. It reads every `path:line` reference in threat-model.md, pdpa.md and asvs-l2.md.<br>3. It opens each file in the repository. |
| Test Data | The three security documents at this commit. |
| Expected Result | Every referenced file exists and has at least that many lines. A reference to a missing file or a line past the end fails the check. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The check read every path:line reference in threat-model.md, pdpa.md and asvs-l2.md (at least 100 of them). Each named file existed in the repository and had at least that many lines. |
| Status | Pass |
| Remarks | Automated (document check in CI) · Commit: a74ca8b · Evidence: documentation/scripts/check-docs.test.ts › EN-23-T2 every file:line reference in the security documents points at a real line, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41601054398, job Lint, typecheck, build, unit tests (step test:scripts) · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
