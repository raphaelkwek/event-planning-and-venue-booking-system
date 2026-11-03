# EN-05-T3 — A change that every older message still satisfies is accepted, including a brand-new message type

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-05-T3 |
| Test Scenario | A change that every older message still satisfies is accepted, including a brand-new message type |
| Pre-conditions | 1. The previous schema of a message type, as it is on main.<br>2. A changed schema of the same message type. |
| Test Steps | 1. Take the `event.approved` data schema as the previous version.<br>2. For each change below, build the changed schema and check it against the previous one: (a) no change at all; (b) the same fields declared in another order; (c) add a new optional field; (d) change a required field to optional; (e) add a status to an enum; (f) lower a minimum length from 2 to 1; (g) add a nullable alternative to a field.<br>3. Add a message type that is not in the previous version at all, and check the two sets of schemas. |
| Test Data | The schemas generated from `backend/packages/contracts`; the changes are made to copies in the test. |
| Expected Result | Each of (a) to (g) is accepted with no findings. The new message type is accepted and listed as new. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | realSchemas.test.ts made each change to the real committed schemas and the checker accepted it with no findings: (a) no change; (b) the same fields in another order, and the generated text is identical; (c) a new optional note; (d) approvedBy made optional; (e) ARCHIVED added to newStatus; (f) reason's minLength 2 lowered to 1; (g) approvedBy given a nullable alternative. A message type absent from the base was accepted and listed as new. The table-driven tests accept a further 17 compatible changes. |
| Status | Pass |
| Remarks | Automated (unit test, CI) · Commit: 379c576 · Evidence: backend/packages/contracts/tests/compat/realSchemas.test.ts › EN-05-T3 (a) no change at all … EN-05-T3 a message type that is not in the previous version is accepted and listed as new; backend/packages/contracts/tests/compat/schemaCompat.test.ts › EN-05-T3 accepts: <case>; CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41636336928 (job Lint, typecheck, build, unit tests) · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
