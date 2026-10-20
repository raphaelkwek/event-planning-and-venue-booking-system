# L4-T8 — Releasing one venue's booking leaves the event's other booking unchanged

## Specification

| Item | Content |
|---|---|
| Test Case ID | L4-T8 |
| Test Scenario | Releasing one venue's booking leaves the event's other booking unchanged |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed, with confirmed bookings at `Lee Kong Chian Auditorium` (Theatre, 150) and `Seminar Room 2-1` (Classroom, 40), both 14:00–18:00 (M1). |
| Test Steps | 1. Release the `Seminar Room 2-1` booking with the N1 release statement (`tests/N1/README.md`), what L5's replacement or F4 does to a booking.<br>2. As the coordinator, open the event's Venue requests. |
| Test Data | Release `Seminar Room 2-1` only |
| Expected Result | The `Seminar Room 2-1` booking is Released. The `Lee Kong Chian Auditorium` booking is still Confirmed, 14:00–18:00. |
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
