# EN-15-T1 — With no flagd configured, change-approval is on (the named default)

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-15-T1 |
| Test Scenario | With no flagd configured, change-approval is on (the named default) |
| Pre-conditions | 1. Dependencies installed.<br>2. No FLAGD_HOST and no flag file in the environment. |
| Test Steps | 1. Start the flag service with an empty environment.<br>2. Evaluate change-approval.<br>3. List all flags. |
| Test Data | No FLAGD_* variables; no flag file. |
| Expected Result | The service reports source 'defaults'. change-approval evaluates to true (the default named in the code), so today's behaviour is unchanged. Listing flags returns { change-approval: true }. |
| Acceptance criterion | The flag has an explicit, named default that keeps S2 approval on. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | flags.unit.test.ts: the default is named (change-approval on), no flag source gives source 'defaults', and evaluateAll returns { change-approval: true }. |
| Status | Pass |
| Remarks | Commit: 62a261e · Evidence: backend/services/planning-core/tests/shared/flags.unit.test.ts › EN-15-T1 tests, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41512676026 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
