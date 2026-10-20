# K2-T8 — Boundary: attendance exactly at the layout's capacity is suitable and needs no justification

## Specification

| Item | Content |
|---|---|
| Test Case ID | K2-T8 |
| Test Scenario | Boundary: attendance exactly at the layout's capacity is suitable and needs no justification |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. Signed in as the assigned coordinator, on the event's "Request a venue" form (the event → "Venue requests" → "Request a venue"). |
| Test Steps | 1. Choose Venue `Lee Kong Chian Auditorium` and Room layout `Classroom`, and set Expected attendance `120`.<br>2. Click "Submit request". |
| Test Data | Expected attendance: `120` |
| Expected Result | No Justification box is shown at any point. Step 2 returns to the event's venue requests with "Booking request BKR-… submitted." and the request Pending. |
| Created By | Yichen, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | No Justification box at any point; attendance 120 on Classroom (capacity 120) returned to the venue requests with "Booking request BKR-000042 submitted.", Pending. |
| Status | Pass |
| Remarks | Commit: 1848a1f · Evidence: tests/K2/evidence/K2-T8.png · Environment: local throwaway Postgres + hosted Supabase Auth · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |