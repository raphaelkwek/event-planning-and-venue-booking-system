# I3-T3 — The returned event keeps its record and its other arrangements; nothing is cancelled

## Specification

| Item | Content |
|---|---|
| Test Case ID | I3-T3 |
| Test Scenario | The returned event keeps its record and its other arrangements; nothing is cancelled |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-CONFIRMED-BOOKING completed, with a second confirmed booking for the event at `Seminar Room 2-1`, Classroom, 40, 2 December 2026 14:00–18:00, approved before the event was made Confirmed.<br>3. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Record a block at `Lee Kong Chian Auditorium` only, 2 December 2026 16:00–19:00, Maintenance, `Stage rigging inspection`.<br>2. In the SQL editor, read the event's status and both bookings' status and flags. |
| Test Data | Block at one of the event's two venues |
| Expected Result | The event is Planning, not Cancelled. The `Lee Kong Chian Auditorium` booking is still CONFIRMED and flagged Requires Reconfirmation; the `Seminar Room 2-1` booking is still CONFIRMED and not flagged. Nothing is released. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
