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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
