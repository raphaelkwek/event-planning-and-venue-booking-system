# M1-T9 — An already-decided request cannot be approved again, and no second approval time is written

## Specification

| Item | Content |
|---|---|
| Test Case ID | M1-T9 |
| Test Scenario | An already-decided request cannot be approved again, and no second approval time is written |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator's request for `Lee Kong Chian Auditorium` has been approved. Note its id and its `decided_at`.<br>4. Another of their requests, for `Seminar Room 2-1`, has been rejected (M2). Note its id.<br>5. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Open the API console and send `POST /venue/api/v1/booking-requests/<approved id>/approve`.<br>2. Send the same for the rejected request.<br>3. Read both requests' `decided_at` and the event's bookings in the SQL editor. |
| Test Data | Account: `venuestaff@connectsphere.test` |
| Expected Result | Both return `409` `BOOKING_REQUEST_NOT_PENDING`, naming the status (Approved, Rejected). The approved request's `decided_at` is unchanged, the rejected one is still Rejected, and the event still has exactly one confirmed booking. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | BKR-001154: 409 "BKR-001154 is Approved, so it can't be approved. Only a pending request can be."; BKR-001155: 409 "BKR-001155 is Rejected, so it can't be approved. Only a pending request can be.". The approved request's decided_at is still 2026-10-19T08:22:36.186Z, the rejected one is still REJECTED, and the event has one confirmed booking. |
| Status | Pass |
| Remarks | Commit: ba2d786 · Evidence: tests/M1/evidence/M1-T9.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
