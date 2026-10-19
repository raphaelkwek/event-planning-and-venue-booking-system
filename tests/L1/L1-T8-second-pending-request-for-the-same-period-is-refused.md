# L1-T8 — A second pending request for the same event, venue and an overlapping period is refused, naming the existing one; a touching period is allowed

## Specification

| Item | Content |
|---|---|
| Test Case ID | L1-T8 |
| Test Scenario | A second pending request for the same event, venue and an overlapping period is refused, naming the existing one; a touching period is allowed |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator has submitted a request for `Lee Kong Chian Auditorium`, 14:00–18:00. Note its booking reference.<br>4. Signed in as the assigned coordinator, on the event's "Request a venue" form. |
| Test Steps | 1. Request `Lee Kong Chian Auditorium` again, layout Theatre, 2 December 2026 17:00–20:00, and click "Submit request".<br>2. Change the times to 18:00–20:00 and click "Submit request". |
| Test Data | Account: the assigned coordinator · 17:00–20:00 overlaps 14:00–18:00 by an hour · 18:00–20:00 only touches it |
| Expected Result | Step 1 is refused with a message naming the existing pending request's booking reference, and no second request is stored. Step 2 is accepted: the event then has two pending requests for the venue, 14:00–18:00 and 18:00–20:00. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | 17:00–20:00 was refused: "This event already has a pending request for this venue that overlaps this period: BKR-000165. Withdraw it, or choose a period that doesn't overlap it.", and only one request was stored. 18:00–20:00 was accepted as BKR-000167; the event then had two pending requests for the venue. |
| Status | Pass |
| Remarks | Commit: 0616c96 · Evidence: tests/L1/evidence/L1-T8.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-17 |
