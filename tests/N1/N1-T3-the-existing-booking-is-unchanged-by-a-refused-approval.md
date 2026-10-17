# N1-T3 — The existing confirmed booking is unchanged by a refused competing approval

## Specification

| Item | Content |
|---|---|
| Test Case ID | N1-T3 |
| Test Scenario | The existing confirmed booking is unchanged by a refused competing approval |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The N1 booking statement run with start 13:00, end 15:00, setup 0 and turnaround 0. Note the booking's id.<br>4. In the SQL editor, the booking's row read: `select status, starts_at, ends_at, event_id, reference, updated_at from venue.venue_slots where id = '<id>';`<br>5. The assigned coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00. |
| Test Steps | 1. As `venuestaff@connectsphere.test`, try to approve the request, as in N1-T2.<br>2. Read the booking's row again.<br>3. Open `Lee Kong Chian Auditorium`'s availability for 2 December 2026. |
| Test Data | Account: `venuestaff@connectsphere.test` |
| Expected Result | The booking's row is identical before and after: still `CONFIRMED`, 13:00–15:00, the same event and reference, the same `updated_at`. The calendar still shows `13:00–15:00` Confirmed with the other event's reference, and nothing else Confirmed that day. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The booking's row was identical before and after: CONFIRMED, 2026-12-02T05:00:00.000Z to 2026-12-02T07:00:00.000Z, reference N1-FX-EVT-008065, updated_at 2026-10-17T17:38:33.640Z. The calendar's only Confirmed row was "13:00–15:00 Confirmed EVT-008065". |
| Status | Pass |
| Remarks | Commit: 7c418d5 · Evidence: tests/N1/evidence/N1-T3.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-18 |
