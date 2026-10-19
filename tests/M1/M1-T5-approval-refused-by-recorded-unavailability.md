# M1-T5 — Approval is refused when the period now overlaps recorded unavailability; the message names it, and the request stays Pending

## Specification

| Item | Content |
|---|---|
| Test Case ID | M1-T5 |
| Test Scenario | Approval is refused when the period now overlaps recorded unavailability; the message names it, and the request stays Pending |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00.<br>4. Then the M1 block statement run with start 16:00, end 19:00, type `MAINTENANCE` and reason `Stage rigging inspection` (since I2, a request can't be raised over an active block, so the block comes second).<br>5. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests", then "Approve" on the request, then "Approve request". |
| Test Data | Account: `venuestaff@connectsphere.test` |
| Expected Result | The approval is refused with a message naming the unavailability: Maintenance, `Stage rigging inspection`, Wednesday 2 December 2026 16:00–19:00. The request stays in the queue, Pending, with no booking. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The dialog showed "BKR-000388 wasn't approved: Lee Kong Chian Auditorium is unavailable for Maintenance, “Stage rigging inspection” (Wednesday 2 December 2026, 16:00–19:00). Nothing was approved, and the request is still Pending." The request stayed in the queue, PENDING, with no booking. |
| Status | Pass |
| Remarks | Commit: 9adf0ff · Evidence: tests/M1/evidence/M1-T5.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-18 |
