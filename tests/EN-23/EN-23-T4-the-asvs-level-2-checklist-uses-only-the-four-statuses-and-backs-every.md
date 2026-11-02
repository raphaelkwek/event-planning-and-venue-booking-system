# EN-23-T4 — The ASVS Level 2 checklist uses only the four statuses and backs every Met

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-23-T4 |
| Test Scenario | The ASVS Level 2 checklist uses only the four statuses and backs every Met |
| Pre-conditions | Dependencies installed (`npm ci`). No database, Kafka or Prometheus server is needed unless the steps say so. |
| Test Steps | 1. Open documentation/security/asvs-l2.md.<br>2. Check every checklist row's status.<br>3. Run the document check. |
| Test Data | documentation/security/asvs-l2.md |
| Expected Result | Every row has a status of Met, Partly, Not met or N/A. A Met row carries a file:line citation. Chapters V1 to V14 are all present. |
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
