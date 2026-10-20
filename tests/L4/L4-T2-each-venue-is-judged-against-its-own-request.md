# L4-T2 — Each venue's suitability is judged against its own request's layout and attendance (K1, K2)

## Specification

| Item | Content |
|---|---|
| Test Case ID | L4-T2 |
| Test Scenario | Each venue's suitability is judged against its own request's layout and attendance (K1, K2) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed, and its coordinator's request for `Lee Kong Chian Auditorium`, Theatre, 150 attending, 14:00–18:00 made (L4-T1 step 2).<br>3. Signed in as FX-BOOKING's coordinator. |
| Test Steps | 1. Request `Seminar Room 2-1`, Classroom, 150 attending, 14:00–18:00, with no justification.<br>2. Change the attendance to 40 and submit again. |
| Test Data | `Seminar Room 2-1` Classroom holds 60 |
| Expected Result | Step 1 is refused: `Seminar Room 2-1` is Not suitable for 150 attending in Classroom (capacity 60), and a justification is asked for. The `Lee Kong Chian Auditorium` request is unaffected and Suitable. Step 2 creates the request, Suitable. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-21 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | For 150 in Classroom, Seminar Room 2-1 was refused as not suitable (capacity 60), asking for a justification, while BKR-003309 at Lee Kong Chian Auditorium stayed Suitable. With 40 attending the request was created, Suitable. |
| Status | Pass |
| Remarks | Commit: 333eb08 · Evidence: tests/L4/evidence/L4-T2.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-21 |
