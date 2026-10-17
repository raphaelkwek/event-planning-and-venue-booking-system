# L2-T3 — Withdrawal is offered only while a request is Pending: an approved, rejected or already withdrawn request offers no Withdraw and is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | L2-T3 |
| Test Scenario | Withdrawal is offered only while a request is Pending: an approved, rejected or already withdrawn request offers no Withdraw and is refused |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator has submitted three requests: `Lee Kong Chian Auditorium` 14:00–16:00, `Lee Kong Chian Auditorium` 16:00–18:00 and `Seminar Room 2-1` 14:00–18:00.<br>4. The L2 decision statement run to set the first to `APPROVED` and the second to `REJECTED` (M1 and M2 do this once built). The third withdrawn as in L2-T1.<br>5. Signed in as the assigned coordinator, on the event's "Venue requests". |
| Test Steps | 1. Look for "Withdraw" on each of the three requests.<br>2. Open the API console and send `POST /venue/api/v1/booking-requests/<id>/withdraw` for each of them. |
| Test Data | Account: the assigned coordinator · Statuses Approved, Rejected and Withdrawn |
| Expected Result | None of the three offers "Withdraw". Each API call returns `409` `BOOKING_REQUEST_NOT_PENDING`, naming the request's current status (Approved, Rejected, Withdrawn), and its status is unchanged. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | None of the three offered "Withdraw". BKR-000425: 409 "BKR-000425 is Approved, so it can't be withdrawn. Only a pending request can be."; BKR-000426: 409 "BKR-000426 is Rejected, so it can't be withdrawn. Only a pending request can be."; BKR-000427: 409 "BKR-000427 is Withdrawn, so it can't be withdrawn. Only a pending request can be.". Their statuses were unchanged. |
| Status | Pass |
| Remarks | Commit: ff9e786 · Evidence: tests/L2/evidence/L2-T3.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-17 |
