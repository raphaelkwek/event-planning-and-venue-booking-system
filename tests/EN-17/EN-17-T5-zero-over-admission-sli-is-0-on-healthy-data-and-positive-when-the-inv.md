# EN-17-T5 — Zero over-admission SLI is 0 on healthy data and positive when the invariant breaks

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-17-T5 |
| Test Scenario | Zero over-admission SLI is 0 on healthy data and positive when the invariant breaks |
| Pre-conditions | Dependencies installed (`npm ci`). No database, Kafka or Prometheus server is needed unless the steps say so. |
| Test Steps | 1. Run the invariant query on a healthy seat table.<br>2. Insert seats that break the invariant (constraints dropped inside a test transaction).<br>3. Read the gauge. |
| Test Data | Seeded registration.seats rows. |
| Expected Result | The gauge is 0 for healthy data and counts the violations otherwise. If the query itself fails, registration_invariant_check_success is 0. |
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
