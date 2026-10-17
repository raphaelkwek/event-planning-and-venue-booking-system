# M2-T7 — Only the venue's Venue Staff can reject, and only a pending request; nothing changes otherwise

## Specification

| Item | Content |
|---|---|
| Test Case ID | M2-T7 |
| Test Scenario | Only the venue's Venue Staff can reject, and only a pending request; nothing changes otherwise |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator has requested `Lee Kong Chian Auditorium` (pending) and `Mochtar Riady Hall`; a further `Lee Kong Chian Auditorium` request for 18:00–20:00 has been approved. Note the ids. |
| Test Steps | 1. As `venuestaff@connectsphere.test`, send `POST /venue/api/v1/booking-requests/<Mochtar Riady Hall id>/reject` with body `{"reason": "No"}`.<br>2. Send the same for the approved request.<br>3. As the assigned coordinator, send it for the pending `Lee Kong Chian Auditorium` request.<br>4. Read the three requests' statuses. |
| Test Data | Accounts: `venuestaff@connectsphere.test`; the assigned coordinator |
| Expected Result | Step 1 returns `403` `ROLE_NOT_AUTHORISED`. Step 2 returns `409` `BOOKING_REQUEST_NOT_PENDING`, naming Approved. Step 3 returns `403` `ROLE_NOT_AUTHORISED`. The statuses are unchanged: Pending, Approved, Pending. |
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
