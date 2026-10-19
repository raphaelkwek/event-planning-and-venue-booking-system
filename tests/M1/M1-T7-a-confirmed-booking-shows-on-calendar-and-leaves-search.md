# M1-T7 — A confirmed booking makes the venue unavailable for that period on the calendar (I1) and excludes it from search for that period (J1)

## Specification

| Item | Content |
|---|---|
| Test Case ID | M1-T7 |
| Test Scenario | A confirmed booking makes the venue unavailable for that period on the calendar (I1) and excludes it from search for that period (J1) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator's request for `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00 has been approved (M1-T3).<br>4. Signed in as the assigned coordinator. |
| Test Steps | 1. Open `Lee Kong Chian Auditorium`'s availability for 2 December 2026.<br>2. Click "Find a venue" and search the window 2 December 2026 15:00–17:00. |
| Test Data | Account: the assigned coordinator |
| Expected Result | The calendar shows `14:00–18:00` marked "Confirmed" with the event's reference, and no free period between 14:00 and 18:00. The search doesn't list `Lee Kong Chian Auditorium`. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The calendar's committed rows for Wednesday 2 December 2026: 00:00–08:00 Outside operating hours; 14:00–18:00 Confirmed EVT-009140; 22:00–24:00 Outside operating hours; free: 08:00–14:00, 18:00–22:00. Searching 15:00–17:00 listed Mochtar Riady Hall, Availability, Seminar Room 2-1, Availability, without Lee Kong Chian Auditorium; 18:00–20:00 listed it again. |
| Status | Pass |
| Remarks | Commit: ba2d786 · Evidence: tests/M1/evidence/M1-T7.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
