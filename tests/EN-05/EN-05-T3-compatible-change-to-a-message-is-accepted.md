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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
