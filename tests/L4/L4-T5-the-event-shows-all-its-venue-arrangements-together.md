# L4-T5 — The event shows all its venue arrangements together, each with its venue, period, status and reference

## Specification

| Item | Content |
|---|---|
| Test Case ID | L4-T5 |
| Test Scenario | The event shows all its venue arrangements together, each with its venue, period, status and reference |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. A confirmed booking: the coordinator's request for `Lee Kong Chian Auditorium`, Theatre, 150, 14:00–18:00, approved by `venuestaff@` (M1).<br>4. A hold: the coordinator asked for `Seminar Room 2-1`, 14:00–18:00, and `venuestaff@` placed it (L3).<br>5. A pending request: the coordinator's request for `Mochtar Riady Hall`, Theatre, 150, 14:00–18:00.<br>6. Signed in as FX-BOOKING's coordinator. |
| Test Steps | 1. Open the event and click "Venue requests".<br>2. Read the requests, holds and bookings listed. |
| Test Data | Three venues, three kinds of arrangement |
| Expected Result | The page lists all three arrangements: the `Lee Kong Chian Auditorium` booking (Confirmed), the `Seminar Room 2-1` hold (Held) and the `Mochtar Riady Hall` request (Pending). Each shows its venue, Wednesday 2 December 2026 14:00–18:00, its status and its reference. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-21 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Venue requests showed the booking "BKR-003316Lee Kong Chian AuditoriumWednesday 2 December 2026, 14:00–18:00Confirmed", the hold "HLD-000359Seminar Room 2-1Wednesday 2 December 2026, 14:00–18:00HeldTuesday 1 December 2026, 18:001 day beforeConvert to requestRelease" and the request "BKR-003317Mochtar Riady HallWednesday 2 December 2026, 14:00–18:00Theatre150PendingWithdraw", each once. |
| Status | Pass |
| Remarks | Commit: 333eb08 · Evidence: tests/L4/evidence/L4-T5.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-21 |
