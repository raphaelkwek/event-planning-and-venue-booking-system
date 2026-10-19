# L1-T3 — The date, times and expected attendance default from the event; a request that keeps them isn't flagged as differing

## Specification

| Item | Content |
|---|---|
| Test Case ID | L1-T3 |
| Test Scenario | The date, times and expected attendance default from the event; a request that keeps them isn't flagged as differing |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. Signed in as the assigned coordinator. |
| Test Steps | 1. Open the event's "Venue requests" and click "Request a venue".<br>2. Note the Date, Start time, End time and Expected attendance.<br>3. Choose Venue `Lee Kong Chian Auditorium` and Room layout `Theatre`, and click "Submit request". |
| Test Data | Account: the assigned coordinator · The event: 2 December 2026, 14:00–18:00, attendance 150 |
| Expected Result | The form opens with Date 2 December 2026, Start time 14:00, End time 18:00 and Expected attendance 150. The submitted request is not marked as differing from the event. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The form opened with Date 2026-12-02, Start time 14:00, End time 18:00 and Expected attendance 150. BKR-000410 was not marked as differing from the event. |
| Status | Pass |
| Remarks | Commit: ff9e786 · Evidence: tests/L1/evidence/L1-T3.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-18 |
