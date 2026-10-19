# I2-T6 — A block that overlaps a confirmed booking is created, and the booking is set to Requires Reconfirmation, recording the blocking reason, the acting Venue Staff member and the time

## Specification

| Item | Content |
|---|---|
| Test Case ID | I2-T6 |
| Test Scenario | A block that overlaps a confirmed booking is created, and the booking is set to Requires Reconfirmation, recording the blocking reason, the acting Venue Staff member and the time |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator's request for `Lee Kong Chian Auditorium` 14:00–18:00 has been approved. Note its booking id (the request's `booking_id`).<br>4. Signed in as `venuestaff@connectsphere.test`, on `Lee Kong Chian Auditorium`'s "Unavailability". |
| Test Steps | 1. Record a block from 2 December 2026 16:00 to 19:00, reason type Maintenance, description `Stage rigging inspection`.<br>2. In the SQL editor: `select s.status, s.requires_reconfirmation, b.reason_type, b.description, d.created_by, d.created_at from venue.venue_slots s join venue.block_disruptions d on d.slot_id = s.id join venue.unavailability_blocks b on b.id = d.block_id where s.id = '<booking id>';` |
| Test Data | Account: `venuestaff@connectsphere.test` (user id `00000000-0000-0000-0000-000000000003`) |
| Expected Result | "Unavailability recorded. 1 booking now requires reconfirmation." is shown. The booking is still `CONFIRMED`, with `requires_reconfirmation` true, linked to the block's reason (`MAINTENANCE`, `Stage rigging inspection`), flagged by `00000000-0000-0000-0000-000000000003` within the last minute. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "Unavailability recorded. 1 booking now requires reconfirmation." was shown. The booking is CONFIRMED, requires_reconfirmation true, linked to MAINTENANCE "Stage rigging inspection", flagged by 00000000-0000-0000-0000-000000000003 at 2026-10-19T08:18:06.534Z. |
| Status | Pass |
| Remarks | Commit: a9a9cc4 · Evidence: tests/I2/evidence/I2-T6.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
