# L4-T1 — One event requests two venues for the same period, and both requests are recorded against it

## Specification

| Item | Content |
|---|---|
| Test Case ID | L4-T1 |
| Test Scenario | One event requests two venues for the same period, and both requests are recorded against it |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`).<br>3. Signed in as FX-BOOKING's coordinator. |
| Test Steps | 1. Open the event and click "Venue requests".<br>2. Request `Lee Kong Chian Auditorium`, Theatre, 150 attending, 2 December 2026 14:00–18:00.<br>3. Request `Seminar Room 2-1`, Classroom, 40 attending, the same period.<br>4. In the SQL editor, read the event id of both requests. |
| Test Data | Main hall `Lee Kong Chian Auditorium` · breakout room `Seminar Room 2-1` · both 14:00–18:00 |
| Expected Result | Both requests are created and listed on the event's Venue requests, each with its own venue, layout and attendance, both Pending. Both are recorded against the same event. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-21 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
