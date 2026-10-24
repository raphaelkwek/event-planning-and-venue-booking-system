# I3-T2 — A block over the booking of an event that isn't Confirmed leaves its status unchanged, as in I2 (partition: Planning, Safety Review)

## Specification

| Item | Content |
|---|---|
| Test Case ID | I3-T2 |
| Test Scenario | A block over the booking of an event that isn't Confirmed leaves its status unchanged, as in I2 (partition: Planning, Safety Review) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed, and its coordinator's request for `Lee Kong Chian Auditorium`, Theatre, 150, 2 December 2026 14:00–18:00 approved (M1). The event is Approved.<br>3. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Record a block at `Lee Kong Chian Auditorium`, 2 December 2026 16:00–19:00, Maintenance, `Stage rigging inspection`.<br>2. Read the event's status and status history.<br>3. Repeat with the event in Safety Review (F5, `tests/F5`) instead of Approved. |
| Test Data | Event Approved, then Safety Review |
| Expected Result | Each time the booking is flagged Requires Reconfirmation (I2), and the event keeps its status, Approved and then Safety Review, with no new status history entry. |
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
