# N2-T9 — The flag alone neither approves nor rejects: a flagged request can be approved, and the other stays Pending

## Specification

| Item | Content |
|---|---|
| Test Case ID | N2-T9 |
| Test Scenario | The flag alone neither approves nor rejects: a flagged request can be approved, and the other stays Pending |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. N2-T1's pre-conditions 2 to 6 completed: A and B both flagged. |
| Test Steps | 1. Read both requests' statuses in the queue.<br>2. Approve request A (M1).<br>3. Read request B's row and status. |
| Test Data | Request A approved |
| Expected Result | Before the approval both are Pending although flagged. Approving A succeeds and confirms its booking. B is still Pending, now flagged as conflicting with A's confirmed booking; nothing rejected it. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-21 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
