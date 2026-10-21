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
| Actual Result | Both were PENDING while flagged. Approving A succeeded; B is still PENDING and its row read "BKR-003000EVT-012038Lee Kong Chian AuditoriumWednesday 2 December 2026, 16:00–20:00Theatre150 attending——SuitableCoordinator Two10/21/2026, 12:49:13 AMConflictConflicts with BKR-002999 (confirmed booking), Wednesday 2 December 2026, 14:00–18:00Approve Reject". |
| Status | Pass |
| Remarks | Commit: f0c7c9d · Evidence: tests/N2/evidence/N2-T9.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-21 |
