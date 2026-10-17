# N1-T8 — The same overlap rule is applied by venue search (J1) once a booking is confirmed

## Specification

| Item | Content |
|---|---|
| Test Case ID | N1-T8 |
| Test Scenario | The same overlap rule is applied by venue search (J1) once a booking is confirmed |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00, and `venuestaff@connectsphere.test` has approved it (N1-T1).<br>4. Signed in as the assigned coordinator. |
| Test Steps | 1. Click "Find a venue". Search with the window 2 December 2026 15:00–17:00.<br>2. Search with the window 2 December 2026 18:00–20:00.<br>3. Search with the window 2 December 2026 17:59–20:00. |
| Test Data | Account: the assigned coordinator · The confirmed booking is 14:00–18:00 |
| Expected Result | Step 1 doesn't list `Lee Kong Chian Auditorium`: it is booked. Step 2 lists it: 18:00 only touches the booking's end. Step 3 doesn't list it: one minute overlaps. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
