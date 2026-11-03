# EN-05-T2 — A change to a message's data that an older message would not satisfy is refused, with the field and the rule

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-05-T2 |
| Test Scenario | A change to a message's data that an older message would not satisfy is refused, with the field and the rule |
| Pre-conditions | 1. The previous schema of a message type, as it is on main.<br>2. A changed schema of the same message type. |
| Test Steps | 1. Take the `event.approved` data schema as the previous version.<br>2. For each change below, build the changed schema and check it against the previous one with the backward-compatibility checker: (a) remove the required field `approvedBy`; (b) retype `approvedAt` from a date-time string to a number; (c) add the new required field `note`; (d) change the optional field `coordinatorName` of `event.coordinator-assigned` to required; (e) remove one status from the `previousStatus` enum of `event.status-changed`; (f) raise `reason`'s minimum length from 1 to 2; (g) remove the message type `event.rejected` altogether; (h) use a keyword the checker does not understand.<br>3. Read the findings. |
| Test Data | The schemas generated from `backend/packages/contracts`; the changes are made to copies in the test. |
| Expected Result | Each of (a) to (h) is refused. Every finding names the message type, the path of the field inside `data` and the rule that was broken, and (h) is refused as "cannot be checked" rather than waved through. Nothing is reported for the fields that did not change. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | realSchemas.test.ts made each change to the real committed schemas and the checker refused it with the message type's field and the rule: (a) removing approvedBy: $.approvedBy property-removed; (b) retyping approvedAt: $.approvedAt type-changed; (c) the new required note: $.note property-now-required; (d) coordinatorName required: $.coordinatorName property-now-required; (e) a status removed from previousStatus: $.previousStatus values-narrowed; (f) reason's minLength 1 to 2: $.reason length-tightened; (g) event.rejected removed: message-removed; (h) an unknown keyword: unsupported-keyword, worded "cannot be checked". A change to approvedAt reported no other path. The table-driven tests refuse a further 19 incompatible changes the same way. |
| Status | Pass |
| Remarks | Automated (unit test, CI) · Commit: 379c576 · Evidence: backend/packages/contracts/tests/compat/realSchemas.test.ts › EN-05-T2 (a) removing the required field approvedBy … EN-05-T2 (h) a keyword the checker does not understand is refused as one it cannot check; backend/packages/contracts/tests/compat/schemaCompat.test.ts › EN-05-T2 refuses: <case>; CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41636336928 (job Lint, typecheck, build, unit tests) · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
