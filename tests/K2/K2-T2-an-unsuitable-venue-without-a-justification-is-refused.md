# K2-T2 — A request for a venue that is not suitable, without a justification, is refused and creates nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | K2-T2 |
| Test Scenario | A request for a venue that is not suitable, without a justification, is refused and creates nothing |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. Signed in as the assigned coordinator, on the event's "Request a venue" form (the event → "Venue requests" → "Request a venue"). |
| Test Steps | 1. Choose Venue `Lee Kong Chian Auditorium` and Room layout `Classroom`. Leave the attendance 150.<br>2. Click "Submit request".<br>3. Leave the Justification box empty and click "Submit request" again.<br>4. In the SQL editor, run the query in Test Data. |
| Test Data | Query: `select count(*) from venue.booking_requests where event_id = '<event id>';` |
| Expected Result | After step 2 the form shows "Not suitable", the message "Lee Kong Chian Auditorium is not suitable for this request. Give a justification to request it anyway.", the failing condition "Expected attendance 150 against layout capacity 120 (Classroom).", and an empty Justification box; no reference is shown. Step 3 shows the same, with "Give a justification: at least one character that isn't a space." under the Justification box. Everything entered is kept. Step 4 returns 0. |
| Created By | Yichen, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | After step 2 the form showed "Not suitable", "Lee Kong Chian Auditorium is not suitable for this request. Give a justification to request it anyway.", the condition "Expected attendance 150 against layout capacity 120 (Classroom).", an empty Justification box and no reference. After step 3 it showed the same with "Give a justification: at least one character that isn't a space." under the box. Step 4 count = 0. |
| Status | Pass |
| Remarks | Commit: 1848a1f · Evidence: tests/K2/evidence/K2-T2.png · Environment: local throwaway Postgres + hosted Supabase Auth · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |