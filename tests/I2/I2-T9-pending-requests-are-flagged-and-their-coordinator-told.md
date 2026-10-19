# I2-T9 — Pending booking requests overlapping the block are flagged in the same way, and the requesting coordinator is notified

## Specification

| Item | Content |
|---|---|
| Test Case ID | I2-T9 |
| Test Scenario | Pending booking requests overlapping the block are flagged in the same way, and the requesting coordinator is notified |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00 (pending). Note its booking reference.<br>4. Signed in as `venuestaff@connectsphere.test`, on `Lee Kong Chian Auditorium`'s "Unavailability". |
| Test Steps | 1. Enter a block from 2 December 2026 16:00 to 19:00, Maintenance, `Stage rigging inspection`, and click "Review", then "Record unavailability".<br>2. Sign out, sign in as the assigned coordinator, open the event's "Venue requests", then "Notifications". |
| Test Data | Accounts: `venuestaff@connectsphere.test`, then the assigned coordinator |
| Expected Result | The dialog lists the pending request with its reference, the event's reference and 16:00–18:00. The coordinator's "Venue requests" shows it Pending and "Requires reconfirmation", and an unread notification names the request, the venue, the period and the reason, and says alternative arrangements are required. |
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
