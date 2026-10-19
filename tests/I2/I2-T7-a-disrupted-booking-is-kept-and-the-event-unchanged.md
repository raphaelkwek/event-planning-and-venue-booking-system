# I2-T7 — The block doesn't cancel or release the disrupted booking: the booking is kept, the venue isn't released for the booked period, and the event's status and information are unchanged

## Specification

| Item | Content |
|---|---|
| Test Case ID | I2-T7 |
| Test Scenario | The block doesn't cancel or release the disrupted booking: the booking is kept, the venue isn't released for the booked period, and the event's status and information are unchanged |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed; the event is Approved.<br>3. The assigned coordinator's request for `Lee Kong Chian Auditorium` 14:00–18:00 has been approved, and I2-T6's block recorded over it.<br>4. Signed in as the assigned coordinator. |
| Test Steps | 1. Open `Lee Kong Chian Auditorium`'s availability for 2 December 2026.<br>2. Open the event's review page and note its status.<br>3. In the SQL editor, read the event's `status` and `version`, and count its status history entries, before and after the block (note them before recording it). |
| Test Data | Account: the assigned coordinator |
| Expected Result | The calendar shows `14:00–18:00` Confirmed with the event's reference and the unavailability from 16:00 to 19:00; 14:00–16:00 is not free. The event is still Approved, with the same `version` and no new status history entry. |
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
