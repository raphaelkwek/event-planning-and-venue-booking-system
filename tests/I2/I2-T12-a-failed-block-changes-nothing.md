# I2-T12 — A failed block creation leaves availability for the period unchanged, flags no booking and sends no notification

## Specification

| Item | Content |
|---|---|
| Test Case ID | I2-T12 |
| Test Scenario | A failed block creation leaves availability for the period unchanged, flags no booking and sends no notification |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator's request for `Lee Kong Chian Auditorium` 14:00–18:00 has been approved.<br>4. Signed in as `venuestaff@connectsphere.test`, on `Lee Kong Chian Auditorium`'s "Unavailability". |
| Test Steps | 1. Enter start 2 December 2026 16:00, end 2 December 2026 15:00, reason type Maintenance, description `Stage rigging inspection`, and click "Review".<br>2. Open the venue's availability for 2 December 2026, and in the SQL editor read the booking's flag and count the venue's blocks.<br>3. Sign in as the assigned coordinator and open "Notifications". |
| Test Data | Account: `venuestaff@connectsphere.test`, then the assigned coordinator |
| Expected Result | The block is refused (the end is before the start). The calendar is as before: 14:00–18:00 Confirmed and no unavailability. The booking doesn't require reconfirmation, the venue has no block, and the coordinator has no disruption notification. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
