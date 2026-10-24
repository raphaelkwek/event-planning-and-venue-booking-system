# I3-T4 — The assigned coordinator is notified at once that the event has returned to Planning; the owning organiser is not notified when the block is recorded

## Specification

| Item | Content |
|---|---|
| Test Case ID | I3-T4 |
| Test Scenario | The assigned coordinator is notified at once that the event has returned to Planning; the owning organiser is not notified when the block is recorded |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-CONFIRMED-BOOKING completed.<br>3. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Record a block at `Lee Kong Chian Auditorium`, 2 December 2026 16:00–19:00, Maintenance, `Stage rigging inspection`.<br>2. Sign in as the event's assigned coordinator and open Notifications.<br>3. Sign in as `organiser@connectsphere.test` and open Notifications. |
| Test Data | Block 16:00–19:00 |
| Expected Result | The coordinator has an unread notification naming the venue, the booking, the event, the blocked period and reason, saying alternative arrangements are required and that the event has returned to Planning. The organiser has no notification about the block or the status change. |
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
