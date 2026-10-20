# L3-T3 — A hold is refused for an event that is Completed, Cancelled or Rejected, and nothing is stored

## Specification

| Item | Content |
|---|---|
| Test Case ID | L3-T3 |
| Test Scenario | A hold is refused for an event that is Completed, Cancelled or Rejected, and nothing is stored |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's id and reference, and which coordinator is assigned. |
| Test Steps | 1. FX-HOLD-STATUS with `'CANCELLED'`.<br>2. As the assigned coordinator, in the API console, `POST /venue/api/v1/holds` with L3-T2's body.<br>3. Repeat with `'COMPLETED'` and `'REJECTED'`.<br>4. FX-HOLD-STATUS with `'PLANNING'` and repeat step 2. |
| Test Data | Account: the assigned coordinator (`coordinator@connectsphere.test` or `coordinator2@connectsphere.test`) / `ConnectSphere-Test-1234!` · L3-T2's body |
| Expected Result | Steps 2 and 3 answer 409 `EVENT_NOT_HOLDABLE`, naming the status, e.g. "A venue can't be held for an event that is Cancelled.", and store no hold. Step 4 answers 201 with a Requested hold. |
| Created By | Yichen Chai, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Cancelled, Completed and Rejected events were refused: CANCELLED: 409 EVENT_NOT_HOLDABLE "A venue can't be held for an event that is Cancelled."; COMPLETED: 409 EVENT_NOT_HOLDABLE "A venue can't be held for an event that is Completed."; REJECTED: 409 EVENT_NOT_HOLDABLE "A venue can't be held for an event that is Rejected.". Holds stored: 0. After setting Planning, step 4 answered 201 with a REQUESTED hold. |
| Status | Pass |
| Remarks | Commit: 01a891e · Evidence: tests/L3/evidence/L3-T3.png · Environment: local throwaway Postgres + hosted Supabase Auth · Defect: — · Event statuses set with FX-HOLD-STATUS SQL; requests sent to the API the screen calls |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |