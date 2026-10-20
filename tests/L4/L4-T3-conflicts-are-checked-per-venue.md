# L4-T3 — Conflicts are checked for each venue on its own (N1, N2)

## Specification

| Item | Content |
|---|---|
| Test Case ID | L4-T3 |
| Test Scenario | Conflicts are checked for each venue on its own (N1, N2) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The N1 booking statement run with start 13:00, end 15:00, setup 0 and turnaround 0: another event's booking at `Lee Kong Chian Auditorium` (`tests/N1/README.md`).<br>4. FX-BOOKING's coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 150, and `Seminar Room 2-1`, Classroom, 40, both 14:00–18:00.<br>5. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests".<br>2. Read both requests' rows.<br>3. Approve the `Seminar Room 2-1` request, then try to approve the `Lee Kong Chian Auditorium` one. |
| Test Data | The other event's booking is at `Lee Kong Chian Auditorium` only |
| Expected Result | Only the `Lee Kong Chian Auditorium` request shows "Conflict", naming the other booking. The `Seminar Room 2-1` request is approved; the `Lee Kong Chian Auditorium` approval is refused, naming the other event, and that request stays Pending. |
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
