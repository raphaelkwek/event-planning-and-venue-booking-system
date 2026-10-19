# I2-T10 — A created block makes the venue unavailable for the period on the calendar (I1) and in search (J1), so no new request can be raised for it

## Specification

| Item | Content |
|---|---|
| Test Case ID | I2-T10 |
| Test Scenario | A created block makes the venue unavailable for the period on the calendar (I1) and in search (J1), so no new request can be raised for it |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. A block recorded at `Lee Kong Chian Auditorium` from 9 December 2026 09:00 to 13:00 (I2-T1).<br>4. Signed in as the assigned coordinator. |
| Test Steps | 1. Open `Lee Kong Chian Auditorium`'s availability for 9 December 2026.<br>2. Click "Find a venue" and search the window 9 December 2026 10:00–12:00.<br>3. Open the event's "Venue requests", click "Request a venue", and request `Lee Kong Chian Auditorium`, Theatre, 9 December 2026 10:00–12:00.<br>4. Request it again for 9 December 2026 13:00–15:00. |
| Test Data | Account: the assigned coordinator |
| Expected Result | The calendar shows 09:00–13:00 Unavailable with Maintenance and the description. The search doesn't list `Lee Kong Chian Auditorium`. Step 3 is refused with a message naming the unavailability and its period, and stores nothing. Step 4, which only touches the block, is accepted, Pending. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
