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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
