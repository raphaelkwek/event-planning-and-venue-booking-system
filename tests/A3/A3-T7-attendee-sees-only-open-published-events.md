# A3-T7 — An attendee sees only events open to them, and only their published fields

## Specification

| Item | Content |
|---|---|
| Test Case ID | A3-T7 |
| Test Scenario | An attendee sees only events open to them, and only their published fields |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. One Confirmed event with registration enabled and its registration window open.<br>3. One Approved event that is not open for registration.<br>4. A clarification thread and a coordinator note exist on the open event. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `attendee@connectsphere.test`.<br>2. Open the list of events open for registration.<br>3. Open the open event. |
| Test Data | Account: `attendee@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | Only the open event is listed. Its detail shows published fields only — no coordinator notes, review comments, clarification thread or rejection reason. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

> **Deferred 2026-09-20 to R1 (Sprint 3) and F5 (Sprint 4).** Unlike the notification cases, this one
> could not be split: there is no Sprint 1 surface, API or record that carries a published-fields
> view of an event to an attendee, so there is no half of it that is executable now. A3's rule is
> checked for the roles that do exist — organiser (A3-T1…T3), coordinator (A3-T4/T5) and the
> attendee's refusal on an internal event (A3-T6). This case is re-read when R1 lands; if the
> attendee list is then built without it, that is a coverage gap in R1, not in A3.

## Execution record

| Item | Content |
|---|---|
| Actual Result | Not run: the attendee event list (R1, Sprint 3) and registration windows (F5, Sprint 4) do not exist, so there is nowhere to perform the steps. |
| Status | Not Executed |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: — · Defect: — · Was recorded Blocked on 2026-09-20; re-recorded as Not Executed because the case depends on unbuilt future stories rather than on something broken. |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
