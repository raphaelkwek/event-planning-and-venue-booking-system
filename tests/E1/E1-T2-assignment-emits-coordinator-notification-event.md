# E1-T2 — Assigning a coordinator emits the event that coordinator's notification is built from

## Specification

| Item | Content |
|---|---|
| Test Case ID | E1-T2 |
| Test Scenario | Assigning a coordinator emits the event that coordinator's notification is built from, identifying the event and the assigned coordinator |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`). |
| Test Steps | 1. Sign in as `organiser@connectsphere.test`.<br>2. "New request" → enter the standard request → "Submit request".<br>3. Note the request **id** and the **reference**; "Assigned coordinator" reads "Awaiting assignment".<br>4. Sign out, sign in as `lead@connectsphere.test`, open the request from "Unassigned", choose `Coordinator One` and click "Assign".<br>5. Sign out, sign in as `organiser@connectsphere.test`, open the request and note the coordinator named in "Assigned coordinator".<br>6. In the Supabase SQL editor, run the query from Test Data with the noted id. |
| Test Data | The standard request.<br>Query: `select envelope->>'type' as message_type, envelope->'data'->>'eventReference' as reference, envelope->'data'->>'eventName' as event_name, envelope->'data'->>'coordinatorId' as coordinator_id, envelope->'data'->>'assignmentRule' as assignment_rule from event.outbox where message_key = '<id>' order by created_at;` |
| Expected Result | One row has `message_type` = `event.coordinator-assigned`, `reference` = the noted reference and `event_name` = `Annual Research Symposium` — the event is identifiable from the event alone. `coordinator_id` is the user id of the coordinator the screen named as assigned (Coordinator One, `00000000-0000-0000-0000-000000000002`, the Lead's choice; see the Accounts table in `tests/README.md`), and `assignment_rule` names the rule that chose them (`LEAD`, the Lead's assignment). |
| Created By | Shawmya |
| Date of Creation | 2026-09-18 |

> **Revised 2026-09-20.** As written, this case asserted both that assignment triggers the assigned
> coordinator's notification *and* that the coordinator can read it in a notifications list. The
> reading half belongs to **T2 — Read and manage my notifications**, which is counted in Sprint 2
> and is not built (`documentation/planning/plan.md` §9.1); it is now **T2-T6**, Not Executed until T2
> ships. E1 owns the trigger — which coordinator is assigned, and that the assignment is announced —
> and that is what this case checks.

> **Revised 2026-11-04 for E3 (CR-05).** E1's assignment at submission was replaced by E3's: a submitted request
> now waits, unassigned, until the Event Coordinator Lead assigns it, and until then the organiser sees "Awaiting
> assignment" (`tests/E3/README.md`). What this case owns still holds, now at the Lead's assignment: the assignment is
> announced by an `event.coordinator-assigned` message that identifies the event and the coordinator. So step 3 notes
> "Awaiting assignment" rather than a coordinator, steps 4 and 5 were added (the Lead assigns Coordinator One; the
> organiser reads the coordinator the screen now names), and the rule recorded is the Lead's, `LEAD`, not E1's
> round-robin. Step 6 names the Supabase SQL editor, which an automated run can't use: the test runs the same query,
> unchanged, against CI's throwaway database.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: · Specification revised 2026-09-20; the previous record (Blocked, Joash, 2026-09-20) was against the pre-split specification. |
| Executed By | |
| Date of Execution | |
