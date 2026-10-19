# I2-T11 — Removing a block records who and when, restores availability, clears Requires Reconfirmation only on bookings disrupted by that block alone, and notifies the affected coordinators

## Specification

| Item | Content |
|---|---|
| Test Case ID | I2-T11 |
| Test Scenario | Removing a block records who and when, restores availability, clears Requires Reconfirmation only on bookings disrupted by that block alone, and notifies the affected coordinators |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator's request for `Lee Kong Chian Auditorium` 14:00–18:00 has been approved. Note its booking id.<br>4. Two blocks recorded at `Lee Kong Chian Auditorium` on 2 December 2026: A, 15:00–16:00, `Fire alarm test`; B, 17:00–19:00, `Stage rigging inspection`.<br>5. Signed in as `venuestaff@connectsphere.test`, on `Lee Kong Chian Auditorium`'s "Unavailability". |
| Test Steps | 1. Click "Remove" on block A, then "Remove unavailability".<br>2. In the SQL editor, read block A's `status`, `removed_by` and `removed_at`, and the booking's `requires_reconfirmation`.<br>3. Remove block B the same way, and read the booking's flag again.<br>4. Sign in as the assigned coordinator, open "Notifications", then the venue's availability for 2 December 2026. |
| Test Data | Account: `venuestaff@connectsphere.test`, then the assigned coordinator |
| Expected Result | After step 1, block A is `REMOVED`, removed by `00000000-0000-0000-0000-000000000003` within the last minute, and the booking still requires reconfirmation, because block B still disrupts it. After step 3 the flag is cleared. The coordinator has a notification for each removal, the first saying the booking still requires reconfirmation and the second that it no longer does. The calendar shows no unavailability that day, and the booking still Confirmed. |
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
