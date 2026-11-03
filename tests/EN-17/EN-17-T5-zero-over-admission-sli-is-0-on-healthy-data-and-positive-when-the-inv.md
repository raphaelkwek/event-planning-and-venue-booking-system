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
| Actual Result | Against the throwaway Postgres: for a plan with a free seat and a claimed seat the invariant query returned the same count as before it was seeded; with the seat uniqueness constraint and the claimed-seat check dropped inside a transaction that was then rolled back, a duplicated seat number and a claimed seat with no holder raised the count by exactly 2. With the database stubbed: the gauge read 0 for a count of 0 and 3 for a count of 3, with registration_invariant_check_success 1 in both, and when the query failed registration_invariant_check_success read 0. |
| Status | Pass |
| Remarks | Automated (unit and integration) · Commit: a74ca8b · Evidence: backend/services/registration/tests/overAdmission.test.ts › EN-17-T5 adds nothing for a plan with a free seat and a claimed seat; EN-17-T5 counts a duplicated seat number and a holder-less claimed seat once the constraints are gone (2 of 2 tests in the file passed, job Integration tests (throwaway Postgres)), and backend/services/registration/tests/metrics.unit.test.ts › EN-17-T5 the gauge is 0 when the seat table is healthy; EN-17-T5 the gauge counts the violations the query finds; EN-17-T5 a failed check is reported as not run, not as zero violations (5 of 5 in the file passed, job Lint, typecheck, build, unit tests), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41601054398 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
