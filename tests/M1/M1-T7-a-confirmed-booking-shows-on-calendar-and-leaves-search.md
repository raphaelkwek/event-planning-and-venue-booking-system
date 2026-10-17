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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
