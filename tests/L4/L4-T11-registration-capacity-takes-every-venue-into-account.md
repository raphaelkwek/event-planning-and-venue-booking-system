# L4-T11 — Registration capacity takes every venue into account (R2, R7, CQ-04)

## Specification

| Item | Content |
|---|---|
| Test Case ID | L4-T11 |
| Test Scenario | Registration capacity takes every venue into account (R2, R7, CQ-04) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed, with confirmed bookings for its event at `Lee Kong Chian Auditorium` (Theatre, 300) and `Seminar Room 2-1` (Classroom, 60).<br>3. The event Confirmed with registration open (U1, R1). |
| Test Steps | 1. Register attendees until registration closes (R2).<br>2. Raise the capacity check R7 makes. |
| Test Data | Capacity 300 + 60 = 360 |
| Expected Result | Registration is limited by the total of the two layout capacities: the 360th registration succeeds and the 361st is refused, naming capacity as the cause and offering the waitlist (R2, R6). |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-21 |

> **Not executable yet.** Registration (R2, R7) isn't built. CQ-04 is answered: the capacity is the total of the venues' layout capacities (`documentation/clarifications.md`, W9-08).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
