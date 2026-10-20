# K2-T5 — The justification is stored with the failing conditions as they were, the coordinator and the time

## Specification

| Item | Content |
|---|---|
| Test Case ID | K2-T5 |
| Test Scenario | The justification is stored with the failing conditions as they were, the coordinator and the time |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-K2-UNSUITABLE completed (`tests/K2/README.md`). Note the request's reference and the time it was submitted. |
| Test Steps | 1. In the SQL editor, run the query in Test Data.<br>2. Sign in as `venuestaff@connectsphere.test`, edit `Lee Kong Chian Auditorium` and change the `Classroom` layout's capacity to `200`. Save.<br>3. Run the query again. |
| Test Data | Query: `select suitability_status, suitability_reasons, unsuitable_justification, requested_by, requested_at from venue.booking_requests where reference = '<reference>';` |
| Expected Result | Step 1 returns one row: `suitability_status` `NOT_SUITABLE`; `suitability_reasons` a list of one condition, `LAYOUT_CAPACITY`, `FAILED`, required 150, available 120, with the message "Expected attendance 150 against layout capacity 120 (Classroom)."; `unsuitable_justification` `Only the auditorium has a stage; the extra 30 will stand at the back.`; `requested_by` the assigned coordinator's user id; `requested_at` the submission time. Step 3 returns exactly the same row: the stored condition still says 120. |
| Created By | Yichen, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Step 1 returned NOT_SUITABLE, one LAYOUT_CAPACITY FAILED condition (required 150, available 120, "Expected attendance 150 against layout capacity 120 (Classroom)."), the justification, requested_by the assigned coordinator and requested_at 2026-10-20T02:49:38.339Z. Step 2 changed Classroom to 200 through the venue editor. Step 3 returned exactly the same row: true. |
| Status | Pass |
| Remarks | Commit: 1848a1f · Evidence: tests/K2/evidence/K2-T5.png · Environment: local throwaway Postgres + hosted Supabase Auth · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |