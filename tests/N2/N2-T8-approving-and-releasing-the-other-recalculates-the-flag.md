# N2-T8 — Approving the other request turns the flag into a booking conflict, and releasing that booking clears it

## Specification

| Item | Content |
|---|---|
| Test Case ID | N2-T8 |
| Test Scenario | Approving the other request turns the flag into a booking conflict, and releasing that booking clears it |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. N2-T1's pre-conditions 2 to 6 completed. |
| Test Steps | 1. Approve request B (M1).<br>2. Read request A's row.<br>3. Release B's booking with the N1 release statement, using the booking id the approval recorded (what F4's cancellation or L5's replacement does).<br>4. Reload "Booking requests" and read request A's row. |
| Test Data | Request B approved, then its booking released |
| Expected Result | After step 1 request A still shows "Conflict", now reading "Conflicts with &lt;B&gt; (confirmed booking), Wednesday 2 December 2026, 16:00–20:00". After step 3 it shows no conflict. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-21 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | After B was approved, A's row read "BKR-002997EVT-012035Lee Kong Chian AuditoriumWednesday 2 December 2026, 14:00–18:00Theatre150 attending——SuitableCoordinator One10/21/2026, 12:49:05 AMConflictConflicts with BKR-002998 (confirmed booking), Wednesday 2 December 2026, 16:00–20:00Approve Reject". After B's booking was released, "BKR-002997EVT-012035Lee Kong Chian AuditoriumWednesday 2 December 2026, 14:00–18:00Theatre150 attending——SuitableCoordinator One10/21/2026, 12:49:05 AMApprove Reject". |
| Status | Pass |
| Remarks | Commit: f0c7c9d · Evidence: tests/N2/evidence/N2-T8.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-21 |
