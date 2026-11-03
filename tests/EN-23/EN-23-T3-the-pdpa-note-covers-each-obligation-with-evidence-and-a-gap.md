# EN-23-T3 — The PDPA note covers each obligation with evidence and a gap

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-23-T3 |
| Test Scenario | The PDPA note covers each obligation with evidence and a gap |
| Pre-conditions | Dependencies installed (`npm ci`). No database, Kafka or Prometheus server is needed unless the steps say so. |
| Test Steps | 1. Open documentation/security/pdpa.md.<br>2. Look for the obligations: consent, purpose limitation, notification, access, correction, accuracy, protection, retention limitation, transfer limitation, data breach notification, accountability. |
| Test Data | documentation/security/pdpa.md |
| Expected Result | All eleven obligations each have a section stating what the system does, with a file:line citation or the word None, and what is missing. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | pdpa.md had a section for each of the eleven obligations. Each stated what the system does and what is missing, and each 'What the system does' carried a file:line citation or began with None. |
| Status | Pass |
| Remarks | Automated (document check in CI) · Commit: c3ef046 · Evidence: documentation/scripts/check-docs.test.ts › EN-23-T3 the PDPA note covers every obligation with what the system does and what is missing (ok 3 in the unit job) · CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41609228639 · Four sections (Notification, Correction, Data breach notification, Accountability) gained None or a citation in c3ef046, and the test now checks each statement · Defect: none |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
