# K2-T3 — Boundary, just below: a justification of spaces only is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | K2-T3 |
| Test Scenario | Boundary, just below: a justification of spaces only is refused |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. Signed in as the assigned coordinator, on the event's "Request a venue" form (the event → "Venue requests" → "Request a venue"). |
| Test Steps | 1. Choose Venue `Lee Kong Chian Auditorium` and Room layout `Classroom`, and click "Submit request".<br>2. Type three spaces in the Justification box and click "Submit request".<br>3. In the SQL editor, run the query in Test Data. |
| Test Data | Justification: three spaces · Query: `select count(*) from venue.booking_requests where event_id = '<event id>';` |
| Expected Result | Step 2 shows "Lee Kong Chian Auditorium is not suitable for this request. Give a justification to request it anyway.", the failing condition "Expected attendance 150 against layout capacity 120 (Classroom)." and "Give a justification: at least one character that isn't a space." under the Justification box; no reference is shown. Step 3 returns 0. |
| Created By | Yichen, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | |
| Executed By | |
| Date of Execution | |
