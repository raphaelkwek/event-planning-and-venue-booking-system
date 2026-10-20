# K2-T4 — Boundary, exactly at: a justification of one character is accepted

## Specification

| Item | Content |
|---|---|
| Test Case ID | K2-T4 |
| Test Scenario | Boundary, exactly at: a justification of one character is accepted |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. Signed in as the assigned coordinator, on the event's "Request a venue" form (the event → "Venue requests" → "Request a venue"). |
| Test Steps | 1. Choose Venue `Lee Kong Chian Auditorium` and Room layout `Classroom`, and click "Submit request".<br>2. Type `x` in the Justification box and click "Submit request". |
| Test Data | Justification: `x` |
| Expected Result | Step 2 returns to the event's venue requests with "Booking request BKR-… submitted." and the new request Pending. |
| Created By | Yichen, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "x" was accepted: returned to the venue requests with "Booking request BKR-000039 submitted." and the new request Pending. |
| Status | Pass |
| Remarks | Commit: 1848a1f · Evidence: tests/K2/evidence/K2-T4.png · Environment: local throwaway Postgres + hosted Supabase Auth · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |