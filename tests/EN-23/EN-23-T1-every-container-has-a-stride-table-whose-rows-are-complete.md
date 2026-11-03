# EN-23-T1 — Every container has a STRIDE table whose rows are complete

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-23-T1 |
| Test Scenario | Every container has a STRIDE table whose rows are complete |
| Pre-conditions | Dependencies installed (`npm ci`). No database, Kafka or Prometheus server is needed unless the steps say so. |
| Test Steps | 1. Open documentation/security/threat-model.md.<br>2. For each container in documentation/c4/connectsphere.dsl, find its section.<br>3. Run the document check (`npx tsx --test documentation/scripts/check-docs.test.ts`). |
| Test Data | documentation/security/threat-model.md; documentation/c4/connectsphere.dsl |
| Expected Result | Every container has a section with six STRIDE rows (S, T, R, I, D, E). Each row names a threat, a control or the word None, the residual risk, and a gap or follow-up whenever the control is None. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The check found every container declared in documentation/c4/connectsphere.dsl (at least 13) and, for each, a section of threat-model.md headed with its id. Every section had a Spoofing, Tampering, Repudiation, Information disclosure, Denial of service and Elevation of privilege row; every row had five non-empty cells; a row whose control began with None had a real entry in its last column, and every other row cited a file:line control. |
| Status | Pass |
| Remarks | Automated (document check in CI) · Commit: a74ca8b · Evidence: documentation/scripts/check-docs.test.ts › EN-23-T1 every C4 container has a STRIDE section with six complete rows, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41601054398, job Lint, typecheck, build, unit tests (step test:scripts) · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
