# L4-T4 — Each venue's request is decided by that venue's own Venue Staff (M1, M2)

## Specification

| Item | Content |
|---|---|
| Test Case ID | L4-T4 |
| Test Scenario | Each venue's request is decided by that venue's own Venue Staff (M1, M2) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. FX-BOOKING's coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 150, `Seminar Room 2-1`, Classroom, 40, and `Mochtar Riady Hall`, Theatre, 150, all 14:00–18:00.<br>4. Signed in as `venuestaff@connectsphere.test`, who looks after the first two but not `Mochtar Riady Hall`. |
| Test Steps | 1. Click "Booking requests".<br>2. Approve the `Lee Kong Chian Auditorium` request.<br>3. Reject the `Seminar Room 2-1` request with the reason "Room closed for exams". |
| Test Data | Reason `Room closed for exams` |
| Expected Result | The queue lists the `Lee Kong Chian Auditorium` and `Seminar Room 2-1` requests but not the `Mochtar Riady Hall` one. After the decisions, `Lee Kong Chian Auditorium` is Approved with a confirmed booking, `Seminar Room 2-1` is Rejected with its reason, and `Mochtar Riady Hall` is still Pending. |
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
