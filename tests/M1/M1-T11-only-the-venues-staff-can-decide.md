# M1-T11 — Only the venue's own Venue Staff can approve or reject its requests; nothing changes for anyone else

## Specification

| Item | Content |
|---|---|
| Test Case ID | M1-T11 |
| Test Scenario | Only the venue's own Venue Staff can approve or reject its requests; nothing changes for anyone else |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator has requested `Mochtar Riady Hall` (which `venuestaff@` doesn't look after) and `Lee Kong Chian Auditorium`. Note both ids. |
| Test Steps | 1. As `venuestaff@connectsphere.test`, open the API console and send `POST /venue/api/v1/booking-requests/<Mochtar Riady Hall id>/approve`.<br>2. As the assigned coordinator, send `POST /venue/api/v1/booking-requests/<Lee Kong Chian Auditorium id>/approve`.<br>3. Read both requests' statuses. |
| Test Data | Accounts: `venuestaff@connectsphere.test`; the assigned coordinator |
| Expected Result | Both are refused with `403` `ROLE_NOT_AUTHORISED`; the first message says only the venue's Venue Staff can decide its requests. Both requests are still `PENDING`. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
