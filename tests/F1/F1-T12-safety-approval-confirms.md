# F1-T12 — The Safety Officer's approval moves a Safety Review event to Confirmed

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T12 |
| Test Scenario | The Safety Officer's approval moves a Safety Review event to Confirmed |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SEEDED with status `'SAFETY_REVIEW'` and end `now() + interval '30 days'`; note the **id**.<br>3. U1 is merged and its seed has created `safety@connectsphere.test`. |
| Test Steps | 1. Sign in as `safety@connectsphere.test` (the Safety Officer account U1's seed adds) and record the decision with U1's approve action.<br>2. In the Supabase SQL editor, run queries 1 and 2 from Test Data.<br>3. Sign in as the assigned coordinator, open the event and click "Mark Confirmed".<br>4. Run queries 1 and 2 again. |
| Test Data | Query 1: `select status from event.events where id = '<id>';`<br>Query 2: `select previous_status, new_status, actor_user_id, actor_role, triggering_action, occurred_at from event.event_history where event_id = '<id>' and entry_type = 'STATUS_CHANGE' order by occurred_at desc limit 1;` |
| Expected Result | After step 2, query 1 returns `SAFETY_REVIEW` and the history row reads `SAFETY_REVIEW` → `SAFETY_REVIEW`, the Safety Officer's user id, `SAFETY_OFFICER`, `APPROVE_SAFETY`, and a non-empty `occurred_at`. After step 4, query 1 returns `CONFIRMED` and the history row reads `SAFETY_REVIEW` → `CONFIRMED`, the coordinator's user id, `EVENT_COORDINATOR`, `MARK_CONFIRMED`, and a non-empty `occurred_at`. |
| Created By | Raphael |
| Date of Creation | 2026-10-07 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria and CR-06.
> F1 defines the transition; U1 builds the Safety Officer's decision action. Until then this case is
> Not Executed and the transition is covered by the automated tests.
> The FX-SEEDED end of `now() + interval '30 days'` keeps the event clear of the completion sweep while it is being tested.
> Steps (screen and button names) are to be made concrete when U1 merges, by U1's assignee.

> **Revised 2026-11-04.** Step 2 names the Supabase SQL editor, which an automated run can't use: the test runs the
> same two queries, unchanged, against CI's throwaway database. Step 1 is U1's screen: "Safety queue" → the event →
> "Approve" → "Record decision". In place of FX-SEEDED's insert the event reaches Safety Review through F5 (an approved
> event with a confirmed booking, confirmed by its assigned coordinator), as F1-T13's run does, ending in March 2027,
> clear of the completion sweep.

> **Revised again 2026-11-04 (Joash), for the Week 9 answer U1 carries.** The Safety Officer's approval no longer
> confirms the event by itself: the check is recorded as passed, the event stays in Safety Review, and the assigned
> coordinator marks it Confirmed (W9-31, W9-61; U1's approve criterion and the ⚠ note on F1 in `final user stories.md`).
> Steps 3 and 4 and the expected result follow that; the transition to `CONFIRMED` and its full history row are still
> what this case checks.

## Execution record

| Item | Content |
|---|---|
| Actual Result | An event reached Safety Review through F5 (approved, booking confirmed, confirmed by Coordinator One), in place of FX-SEEDED. The Safety Officer opened it from the Safety queue, chose Approve and clicked Record decision ("A decision is recorded for this review"). Query 1 then returned SAFETY_REVIEW, and query 2's row read SAFETY_REVIEW → SAFETY_REVIEW, 00000000-0000-0000-0000-000000000010, SAFETY_OFFICER, APPROVE_SAFETY, with a non-empty occurred_at. Coordinator One then clicked Mark Confirmed on the event (status Confirmed): query 1 returned CONFIRMED and query 2 read SAFETY_REVIEW → CONFIRMED, 00000000-0000-0000-0000-000000000002, EVENT_COORDINATOR, MARK_CONFIRMED, with a non-empty occurred_at. Run on CI's throwaway stack, with unique names in place of the card's literal names; the card's query ran unchanged against that stack's database in place of the Supabase SQL editor. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5bfb25e · Evidence: tests/e2e/f1-history.spec.ts › F1-T12 the Safety Officer's approval of a Safety Review event, then Mark Confirmed, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41801285931 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
