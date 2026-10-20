# L4-T7 — Rejecting one venue's request leaves the event's other arrangements unchanged

## Specification

| Item | Content |
|---|---|
| Test Case ID | L4-T7 |
| Test Scenario | Rejecting one venue's request leaves the event's other arrangements unchanged |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed, with a confirmed booking at `Lee Kong Chian Auditorium` and a pending request for `Seminar Room 2-1`, Classroom, 40, both 14:00–18:00.<br>3. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Reject the `Seminar Room 2-1` request with the reason "Room closed for exams" (M2).<br>2. As the coordinator, open the event's Venue requests. |
| Test Data | Reason `Room closed for exams` |
| Expected Result | `Seminar Room 2-1` is Rejected with its reason. The `Lee Kong Chian Auditorium` booking is still Confirmed, 14:00–18:00, and not flagged. |
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
