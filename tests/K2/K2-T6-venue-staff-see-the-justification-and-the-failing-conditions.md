# K2-T6 — Venue Staff see the justification and the failing conditions on the pending request

## Specification

| Item | Content |
|---|---|
| Test Case ID | K2-T6 |
| Test Scenario | Venue Staff see the justification and the failing conditions on the pending request |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-K2-UNSUITABLE completed (`tests/K2/README.md`). Note the request's reference. |
| Test Steps | 1. Sign in as `venuestaff@connectsphere.test`.<br>2. Open "Booking requests" and find the request's row. |
| Test Data | Account: `venuestaff@connectsphere.test` |
| Expected Result | The row shows the suitability "Not suitable", the failing condition "Expected attendance 150 against layout capacity 120 (Classroom).", and "Justification: Only the auditorium has a stage; the extra 30 will stand at the back." |
| Created By | Yichen, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The row for BKR-000040 shows "Not suitable", "Expected attendance 150 against layout capacity 120 (Classroom)." and "Justification: Only the auditorium has a stage; the extra 30 will stand at the back.". |
| Status | Pass |
| Remarks | Commit: 1848a1f · Evidence: tests/K2/evidence/K2-T6.png · Environment: local throwaway Postgres + hosted Supabase Auth · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |