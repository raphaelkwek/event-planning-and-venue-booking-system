# M1-T10 — CR-02: approving a request that replaces a disrupted booking releases the disrupted booking with the reason "replaced", and keeps its record

## Specification

| Item | Content |
|---|---|
| Test Case ID | M1-T10 |
| Test Scenario | CR-02: approving a request that replaces a disrupted booking releases the disrupted booking with the reason "replaced", and keeps its record |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. FX-DISRUPTED completed (`tests/L1/README.md`): a confirmed booking at `Seminar Room 2-1` flagged Requires Reconfirmation. Note its id.<br>4. The assigned coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00, linked to the disrupted booking (L1-T10's API request).<br>5. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests", then "Approve" on the replacement request, then "Approve request".<br>2. In the SQL editor, read the disrupted booking: `select status, release_reason from venue.venue_slots where id = '<id>';` |
| Test Data | Account: `venuestaff@connectsphere.test` |
| Expected Result | The approval goes through. The disrupted booking still exists, with status `RELEASED` and release reason `replaced`, and `Seminar Room 2-1` shows no booking on 2 December 2026. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The approval went through. The disrupted booking f86c1615-c665-4d04-aef2-5ca1c62994b3 still exists, status RELEASED, release reason "replaced", and Seminar Room 2-1's calendar for Wednesday 2 December 2026 shows no booking. |
| Status | Pass |
| Remarks | Commit: ba2d786 · Evidence: tests/M1/evidence/M1-T10.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
