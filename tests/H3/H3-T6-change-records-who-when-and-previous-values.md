# H3-T6 — A change records the acting user, the timestamp, and the previous and new values

## Specification

| Item | Content |
|---|---|
| Test Case ID | H3-T6 |
| Test Scenario | A change records the acting user, the timestamp, and the previous and new values |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed; note the venue's id.<br>3. H3-T1's steps completed on that venue. |
| Test Steps | 1. In the SQL editor run: `select action, actor_user_id, occurred_at, changes from venue.venue_history where venue_id = '<id>' order by occurred_at;` |
| Test Data | Venue id from FX-VENUE |
| Expected Result | The last row is `UPDATED` by `00000000-0000-0000-0000-000000000003` with a timestamp, and its `changes` holds `setupMinutes` 0 → 30 and `turnaroundMinutes` 0 → 45, and nothing else. |
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
