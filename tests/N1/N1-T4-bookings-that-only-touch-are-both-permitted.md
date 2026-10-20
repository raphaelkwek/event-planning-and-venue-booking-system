# N1-T4 — Boundary: a booking ending exactly when the request begins only touches it, so the approval goes through

## Specification

| Item | Content |
|---|---|
| Test Case ID | N1-T4 |
| Test Scenario | Boundary: a booking ending exactly when the request begins only touches it, so the approval goes through |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The N1 booking statement run with start 10:00, end 14:00, setup 0 and turnaround 0.<br>4. The assigned coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00.<br>5. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests", then "Approve" on the request and "Approve request".<br>2. Open `Lee Kong Chian Auditorium`'s availability for 2 December 2026. |
| Test Data | Account: `venuestaff@connectsphere.test` · The other booking ends at 14:00; the request starts at 14:00 |
| Expected Result | The approval goes through. The calendar shows two Confirmed bookings, `10:00–14:00` and `14:00–18:00`, with no gap or overlap between them. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The approval went through. The calendar showed two Confirmed bookings: 10:00–14:00 Confirmed EVT-009158; 14:00–18:00 Confirmed EVT-009157. |
| Status | Pass |
| Remarks | Commit: ba2d786 · Evidence: tests/N1/evidence/N1-T4.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
