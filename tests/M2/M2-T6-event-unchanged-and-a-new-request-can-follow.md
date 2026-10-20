# M2-T6 — The event's own status is unchanged by a rejection, and the coordinator can submit a further request

## Specification

| Item | Content |
|---|---|
| Test Case ID | M2-T6 |
| Test Scenario | The event's own status is unchanged by a rejection, and the coordinator can submit a further request |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed; the event is Approved.<br>3. The assigned coordinator's request for `Lee Kong Chian Auditorium`, 14:00–18:00, has been rejected. |
| Test Steps | 1. As the assigned coordinator, open the event's review page and note its status.<br>2. Open "Venue requests" and request `Lee Kong Chian Auditorium`, Theatre, 14:00–18:00 again.<br>3. Request `Seminar Room 2-1`, Classroom, at the same time. |
| Test Data | Account: the assigned coordinator |
| Expected Result | The event is still Approved, with no new status history entry. Both new requests are accepted, Pending. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | After the rejection the event still showed Approved, with no new status history entry. Both further requests were accepted: BKR-001165 PENDING, BKR-001166 PENDING. |
| Status | Pass |
| Remarks | Commit: ba2d786 · Evidence: tests/M2/evidence/M2-T6.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
