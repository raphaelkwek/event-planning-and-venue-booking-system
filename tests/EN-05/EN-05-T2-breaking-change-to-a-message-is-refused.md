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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
