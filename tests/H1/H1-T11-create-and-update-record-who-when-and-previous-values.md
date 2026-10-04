# H1-T11 — Each create and update records the acting user, the timestamp and the previous values of changed fields

## Specification

| Item | Content |
|---|---|
| Test Case ID | H1-T11 |
| Test Scenario | Each create and update records the acting user, the timestamp and the previous values of changed fields |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed; note the venue's id.<br>3. H1-T2's steps 1–5 completed on that venue (maximum capacity 300 → 320, facility added). |
| Test Steps | 1. In the SQL editor run: `select action, actor_user_id, occurred_at, changes from venue.venue_history where venue_id = '<id>' order by occurred_at;` |
| Test Data | Venue id from FX-VENUE |
| Expected Result | Two rows. The first is `CREATED` by `00000000-0000-0000-0000-000000000003` (Venue Staff One) with a timestamp. The second is `UPDATED` by the same user, later, and its `changes` holds exactly the two changed fields with their previous and new values: `maxCapacity` 300 → 320, and `facilities` from the three original facilities to the four. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
