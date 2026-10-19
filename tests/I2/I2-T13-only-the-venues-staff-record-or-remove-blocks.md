# I2-T13 — Only the venue's own Venue Staff can record or remove its blocks; anyone else is refused and nothing changes

## Specification

| Item | Content |
|---|---|
| Test Case ID | I2-T13 |
| Test Scenario | Only the venue's own Venue Staff can record or remove its blocks; anyone else is refused and nothing changes |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed (`venuestaff@` looks after `Lee Kong Chian Auditorium`, not `Mochtar Riady Hall`).<br>3. A block recorded at `Lee Kong Chian Auditorium` (I2-T1). Note its id. |
| Test Steps | 1. As `venuestaff@connectsphere.test`, open the API console and send `POST /venue/api/v1/venues/<Mochtar Riady Hall id>/unavailability` with body `{"startsAt": "2026-12-09T09:00+08:00", "endsAt": "2026-12-09T13:00+08:00", "reasonType": "MAINTENANCE", "description": "Test"}`.<br>2. As the assigned coordinator, send the same for `Lee Kong Chian Auditorium`.<br>3. As the assigned coordinator, send `POST /venue/api/v1/venues/<Lee Kong Chian Auditorium id>/unavailability/<block id>/remove`.<br>4. Count both venues' active blocks. |
| Test Data | Accounts: `venuestaff@connectsphere.test`; the assigned coordinator |
| Expected Result | All three are refused with `403` `ROLE_NOT_AUTHORISED`; the first message says only the venue's Venue Staff can record or remove its unavailability. `Mochtar Riady Hall` has no block, and `Lee Kong Chian Auditorium` still has exactly the one. |
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
