# F1 — Event Status Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "an event's status changes only through a defined action" something the event service guarantees rather than a convention, and add the Confirmed and Completed transitions that F1's acceptance criteria require.

**Architecture:** One conditional `UPDATE` in `repo/eventStatus.ts` is the only statement that writes `event.events.status`. `transitionEvent()` wraps it with the transition table's rule and the history entry, and every status change in the service goes through it. A completion sweep in the event service moves due Confirmed events to Completed; for now an `npm run` script triggers it.

**Tech Stack:** Node 20, TypeScript (strict, NodeNext), Express 4, `postgres` (porsager) with raw SQL, Vitest against the team's hosted Supabase Postgres.

**Spec:** `documentation/superpowers/specs/2026-09-30-f1-status-lifecycle-design.md`

---

## Read before starting

- `documentation/planning/implementation.md` §3–§4 and §11. **§11.12's before-code confirmation of the cards, and the agent pre-review, were waived for F1 by team decision on 2026-09-30.** The human check moves to merge time: `main` requires an approving PR review, and Task 12 asks the reviewer to check each card's expected result against its AC. Task 1, writing the cards from the ACs alone, still comes before any code.
- Every event-service test runs against the **shared** hosted database. Test files use unique owner-id prefixes and clean up only their own rows. The prefixes this plan introduces: `af111111` (transitionEvent tests), `af222222` (eventStatus repo tests), `af333333` (completion sweep tests), `af444444` (sweep isolation test), `af555555` (status history API test).
- Run the event-service suite from the repo root with `npm test -w @connectsphere/event-service`, or a single file with `npx vitest run <path>` from `backend/services/event`.
- The suite shares one database with teammates. A failure that disappears on re-run is contention, not your change (see the CHANGELOG entry of 2026-09-20). Re-run before debugging.

## Refinements made while planning (recorded in the spec in Task 12)

1. **The time guard lives in the transition, not only in the sweep.** AC6 says an event moves to Completed *only* after its end, so `transitionEvent(…, "COMPLETE")` refuses before the end no matter who calls it. The rule is one SQL fragment, `endHasPassed()`, used by both the guard and the sweep's selection. The spec's pure `isDueForCompletion()` is therefore not needed and is not built.
2. **Where the code sits.** The conditional `UPDATE` is `updateStatusIf()` in `src/repo/eventStatus.ts` (repo: SQL only). `transitionEvent()` sits in `src/api/transitionEvent.ts`, beside `submitEvent.ts`, which is the existing home for orchestration that more than one router uses.
3. **Response codes kept for compatibility.** Resubmitting a request still answers `409 DRAFT_ALREADY_SUBMITTED`, because card D5-T5 and `submission.test.ts` rely on it, but its *message* now names both statuses (AC3). The race-loser path in decisions, previously `EVENT_ALREADY_DECIDED`, now answers `STATUS_TRANSITION_NOT_PERMITTED` like every other refused transition. No test or screen reads `EVENT_ALREADY_DECIDED`; it stays in contracts, because removing it would be a contracts change.

## File structure

| File | Responsibility | Task |
|---|---|---|
| `tests/F1/F1-T1…T11-*.md` | Functional cards (specification first) | 1 |
| `tests/README.md` | New setup procedure FX-SEEDED | 1 |
| `backend/services/event/src/domain/statusMachine.ts` | The transition table: `CONFIRM`, `COMPLETE`, `transitionRule()`, `refusalMessage()` | 2 |
| `backend/services/event/tests/domain/statusMachine.test.ts` | Every status × every action; messages | 2 |
| `backend/services/event/tests/domain/statuses.test.ts` | AC1: exactly the ten statuses | 2 |
| `backend/services/event/src/repo/eventStatus.ts` | `updateStatusIf()` (the only status write), `readStatus()`, `endHasPassed()`, `listDueForCompletion()` | 3 |
| `backend/services/event/tests/support/seedEvent.ts` | Test-only: insert an event at any status | 3 |
| `backend/services/event/tests/repo/eventStatus.test.ts` | Conditional update, concurrency, AC1 database check | 3 |
| `backend/services/event/src/repo/events.ts` | Adds the column fragments `decisionColumns`, `reviewColumns`, `submissionColumns`; later loses the old status writers | 4, 9 |
| `backend/services/event/src/api/transitionEvent.ts` | The one way an event's status changes | 4 |
| `backend/services/event/tests/api/transitionEvent.test.ts` | Its behaviour, including the completion boundary | 4 |
| `backend/services/event/src/api/decisions.ts` | D4/D5 through `transitionEvent` | 5 |
| `backend/services/event/src/api/clarifications.ts` | D2/D3 through `transitionEvent` | 6 |
| `backend/services/event/src/api/events.ts` | D1 open-for-review and B1 through `transitionEvent` | 7, 8 |
| `backend/services/event/src/api/submitEvent.ts` | Insert at Draft, then `SUBMIT` | 8 |
| `backend/services/event/src/api/drafts.ts` | Resubmission message names both statuses | 8 |
| `backend/services/event/src/repo/drafts.ts` | `insertDraft` accepts a transaction | 8 |
| `backend/services/event/tests/api/statusHistory.test.ts` | AC4 end to end | 8 |
| `backend/services/event/tests/architecture/statusWrites.test.ts` | AC2 guard: no other code writes status | 9 |
| `backend/services/event/src/jobs/completeEvents.ts` | The completion sweep | 10 |
| `backend/services/event/tests/jobs/completeEvents.test.ts`, `completeEventsIsolation.test.ts` | Sweep behaviour | 10 |
| `backend/services/event/src/jobs/runCompleteEvents.ts`, root `package.json` | `npm run jobs:complete-events` | 11 |
| `documentation/traceability/sprint-2.csv`, `CHANGELOG.md`, the spec | Trace, record, refinements | 12 |

---

### Task 1: Write F1's functional cards and the FX-SEEDED procedure

These are written **from the acceptance criteria alone**. Don't read the implementation to decide an expected result (§11.12).

**Files:**
- Create: `tests/F1/F1-T1-status-outside-the-ten-refused.md` … `tests/F1/F1-T11-completion-sweep-run-twice.md` (11 files, content below)
- Modify: `tests/README.md` (Setup procedures table)

- [ ] **Step 1: Add FX-SEEDED to `tests/README.md`**

Add this row to the end of the "Setup procedures" table, and this section directly after the table:

```markdown
| **FX-SEEDED** | Run the FX-SEEDED statement below in the Supabase SQL editor, with the status and end time the case gives. Note the returned **id** and **reference**. Used for statuses no user action can reach yet (Confirmed needs F5). |
```

```markdown
### FX-SEEDED statement

Replace `<STATUS>` and `<END>` with the case's values, e.g. `'CONFIRMED'` and `now() - interval '1 minute'`.

~~~sql
insert into event.events (
  reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
  expected_attendance, equipment_required, registration_required, status, submitted_at,
  last_saved_at, created_by, updated_by
) values (
  'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'),
  '00000000-0000-0000-0000-000000000001', 'Annual Research Symposium',
  'Share faculty research', 'A one-day symposium for the school of computing.',
  <END> - interval '4 hours', <END>, 150, false, false, <STATUS>, now(), now(),
  '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'
)
returning id, reference;
~~~

The event is owned by `organiser@connectsphere.test`, so `npm run test-cases:reset` removes it.

**The completion sweep is not scoped to your data.** `npm run jobs:complete-events` completes
*every* Confirmed event in the shared database whose end has passed, a teammate's included. That is
what the job does in production too.
```

- [ ] **Step 2: Create the eleven cards**

Each card uses `tests/TEMPLATE.md`'s layout. The note under each specification is how this repo records card-level annotations (see the 2026-09-20 revisions).

`tests/F1/F1-T1-status-outside-the-ten-refused.md`:

```markdown
# F1-T1 — The database refuses a status outside the ten permitted statuses

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T1 |
| Test Scenario | The database refuses a status outside the ten permitted statuses |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SUBMITTED completed; note the request **id**. |
| Test Steps | 1. In the Supabase SQL editor, run query 1 from Test Data with the noted id.<br>2. Run query 2. |
| Test Data | Query 1: `update event.events set status = 'ARCHIVED' where id = '<id>';`<br>Query 2: `select status from event.events where id = '<id>';` |
| Expected Result | Query 1 fails with a check-constraint violation naming `events_status_check`. Query 2 returns `SUBMITTED`. |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
```

`tests/F1/F1-T2-no-screen-sets-a-status.md`:

```markdown
# F1-T2 — No screen offers a way to set an event's status

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T2 |
| Test Scenario | No screen offers a way to set an event's status |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-APPROVED completed; note the request **id**. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `organiser@connectsphere.test`. Open the request from "My requests".<br>2. Sign out, sign in as `coordinator@connectsphere.test`, and open the same request.<br>3. On each screen, look for any control — dropdown, text field, button — that changes the status to a value of the user's choosing. |
| Test Data | Accounts: `organiser@connectsphere.test`, `coordinator@connectsphere.test` — both `ConnectSphere-Test-1234!` |
| Expected Result | Both screens show the status "Approved" as a read-only lozenge. Neither screen has a control that sets a status of the user's choosing. |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
```

`tests/F1/F1-T3-status-in-a-request-body-ignored.md`:

```markdown
# F1-T3 — A status sent in a request body does not change the event's status

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T3 |
| Test Scenario | A status sent in a request body does not change the event's status |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-DRAFT completed; note the draft **id**. Stay signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Open "API console". Set Method `PUT`, Path `/api/v1/event-drafts/<id>`, and the Body from Test Data. Click "Send".<br>2. In the Supabase SQL editor, run the query from Test Data. |
| Test Data | Body: `{ "name": "Annual Research Symposium", "status": "APPROVED" }`<br>Query: `select status from event.events where id = '<id>';` |
| Expected Result | The response is HTTP 200 and its body shows `"status": "DRAFT"`. The query returns `DRAFT`. |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
```

`tests/F1/F1-T4-approving-a-rejected-event-refused.md`:

```markdown
# F1-T4 — Approving a rejected event is refused, naming both statuses, and stores nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T4 |
| Test Scenario | Approving a rejected event is refused, naming both statuses, and stores nothing |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-REJECTED completed; note the request **id**. Stay signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. In the Supabase SQL editor, run query 1 and note the count.<br>2. Open "API console". Set Method `POST`, Path `/api/v1/events/<id>/approve`, no Body. Click "Send".<br>3. Run query 1 again, then query 2. |
| Test Data | Query 1: `select count(*) from event.event_history where event_id = '<id>';`<br>Query 2: `select status from event.events where id = '<id>';` |
| Expected Result | Step 2 returns HTTP 409 with error code `STATUS_TRANSITION_NOT_PERMITTED` and the message "This event is Rejected and cannot move to Approved." The count in step 3 equals the count in step 1. Query 2 returns `REJECTED`. |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
```

`tests/F1/F1-T5-resubmission-names-both-statuses.md`:

```markdown
# F1-T5 — Submitting an already-submitted request is refused, naming both statuses

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T5 |
| Test Scenario | Submitting an already-submitted request is refused, naming both statuses |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-DRAFT completed with the standard request; note the draft **id**. Stay signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Open "API console". Set Method `POST`, Path `/api/v1/event-drafts/<id>/submit`, no Body. Click "Send".<br>2. Click "Send" again with the same settings. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · the standard request |
| Expected Result | Step 1 returns HTTP 201 with `"status": "SUBMITTED"`. Step 2 returns HTTP 409 with error code `DRAFT_ALREADY_SUBMITTED` and the message "This event is Submitted and cannot move to Submitted." |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30). The wording "Submitted … cannot move to Submitted" is what AC3
> prescribes when the current status and the target coincide; it was accepted as written
> (spec §4.1). FX-DRAFT saves the name only, so enter the standard request and "Save draft" before
> step 1.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
```

`tests/F1/F1-T6-every-change-writes-a-full-history-entry.md`:

```markdown
# F1-T6 — Every status change on the way to Approved writes a full history entry

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T6 |
| Test Scenario | Every status change on the way to Approved writes a full history entry |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-APPROVED completed; note the request **id**. |
| Test Steps | 1. In the Supabase SQL editor, run the query from Test Data. |
| Test Data | Query: `select previous_status, new_status, actor_user_id, actor_role, triggering_action, occurred_at from event.event_history where event_id = '<id>' and entry_type = 'STATUS_CHANGE' order by occurred_at;` |
| Expected Result | Exactly three rows, in this order:<br>1. `DRAFT` → `SUBMITTED`, `00000000-0000-0000-0000-000000000001`, `EVENT_ORGANISER`, `SUBMIT`<br>2. `SUBMITTED` → `UNDER_REVIEW`, `00000000-0000-0000-0000-000000000002`, `EVENT_COORDINATOR`, `OPEN_FOR_REVIEW`<br>3. `UNDER_REVIEW` → `APPROVED`, `00000000-0000-0000-0000-000000000002`, `EVENT_COORDINATOR`, `APPROVE`<br>Every row has a non-empty `occurred_at`. |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
```

`tests/F1/F1-T7-confirming-writes-history.md`:

```markdown
# F1-T7 — Confirming an event writes a history entry like any other transition

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T7 |
| Test Scenario | Confirming an event writes a history entry like any other transition |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SEEDED with status `'APPROVED'` and end `now() + interval '30 days'`; note the **id**.<br>3. F5's confirmation action exists. |
| Test Steps | 1. Sign in as the event's assigned coordinator and confirm the event using F5's confirmation action.<br>2. In the Supabase SQL editor, run the query from Test Data. |
| Test Data | Query: `select previous_status, new_status, actor_user_id, actor_role, triggering_action, occurred_at from event.event_history where event_id = '<id>' and entry_type = 'STATUS_CHANGE' order by occurred_at desc limit 1;` |
| Expected Result | The row reads `APPROVED` → `CONFIRMED`, the coordinator's user id, `EVENT_COORDINATOR`, `CONFIRM`, and a non-empty `occurred_at`. |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30). F1 defines that Confirmed is
> reached by a `CONFIRM` transition that writes history; F5 (Sprint 4) builds the action. Until
> then this case is Not Executed and the transition is covered by the automated tests.

## Execution record

| Item | Content |
|---|---|
| Actual Result | Not run: F5's confirmation action (Sprint 4) does not exist, so there is no way to perform step 1. |
| Status | Not Executed |
| Remarks | Commit: · Evidence: — · Defect: — · Awaiting F5 (Sprint 4). |
| Executed By | |
| Date of Execution | |
```

`tests/F1/F1-T8-confirmed-event-completes-after-its-end.md`:

```markdown
# F1-T8 — A Confirmed event whose end has passed becomes Completed

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T8 |
| Test Scenario | A Confirmed event whose end has passed becomes Completed, recorded as a system change |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SEEDED with status `'CONFIRMED'` and end `now() - interval '1 minute'`; note the **id**. |
| Test Steps | 1. From the repo root, run `npm run jobs:complete-events`.<br>2. In the Supabase SQL editor, run both queries from Test Data. |
| Test Data | Query 1: `select status from event.events where id = '<id>';`<br>Query 2: `select previous_status, new_status, actor_user_id, actor_role, triggering_action, occurred_at from event.event_history where event_id = '<id>' and entry_type = 'STATUS_CHANGE';` |
| Expected Result | The command exits without error, and its output includes a line "event completed" carrying the noted id. Query 1 returns `COMPLETED`. Query 2 returns one row: `CONFIRMED` → `COMPLETED`, `actor_user_id` null, `SYSTEM`, `COMPLETE`, and a non-empty `occurred_at`. |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30). Until F5 exists, a Confirmed event can only be seeded (FX-SEEDED).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
```

`tests/F1/F1-T9-confirmed-event-not-yet-ended-stays.md`:

```markdown
# F1-T9 — A Confirmed event whose end has not passed stays Confirmed

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T9 |
| Test Scenario | A Confirmed event whose end has not passed stays Confirmed (boundary: just before the end) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SEEDED with status `'CONFIRMED'` and end `now() + interval '1 hour'`; note the **id**. |
| Test Steps | 1. From the repo root, run `npm run jobs:complete-events`.<br>2. In the Supabase SQL editor, run both queries from Test Data. |
| Test Data | Query 1: `select status from event.events where id = '<id>';`<br>Query 2: `select count(*) from event.event_history where event_id = '<id>';` |
| Expected Result | The command exits without error, and no output line carries the noted id. Query 1 returns `CONFIRMED`. Query 2 returns `0`. |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30). "Just before" is an hour here so that the case cannot drift across the
> boundary while it is being run; the millisecond boundaries (just before, exactly at, just after)
> are covered by the automated tests, where the time is fixed.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
```

`tests/F1/F1-T10-approved-event-past-its-end-stays-approved.md`:

```markdown
# F1-T10 — An Approved event whose end has passed is not completed

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T10 |
| Test Scenario | An Approved event whose end has passed is not completed, because it was never confirmed |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SEEDED with status `'APPROVED'` and end `now() - interval '1 minute'`; note the **id**. |
| Test Steps | 1. From the repo root, run `npm run jobs:complete-events`.<br>2. In the Supabase SQL editor, run both queries from Test Data. |
| Test Data | Query 1: `select status from event.events where id = '<id>';`<br>Query 2: `select count(*) from event.event_history where event_id = '<id>';` |
| Expected Result | The command exits without error, and no output line carries the noted id. Query 1 returns `APPROVED`. Query 2 returns `0`. |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30). Only Confirmed events complete
> — a decision on a gap in AC6, confirmed by Raphael on 2026-09-30 (spec §2, decision 2).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
```

`tests/F1/F1-T11-completion-sweep-run-twice.md`:

```markdown
# F1-T11 — Running the completion job twice completes an event once

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T11 |
| Test Scenario | Running the completion job twice completes an event once and writes one history entry |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SEEDED with status `'CONFIRMED'` and end `now() - interval '1 minute'`; note the **id**. |
| Test Steps | 1. From the repo root, run `npm run jobs:complete-events`.<br>2. Run it again.<br>3. In the Supabase SQL editor, run the query from Test Data. |
| Test Data | Query: `select count(*) from event.event_history where event_id = '<id>' and triggering_action = 'COMPLETE';` |
| Expected Result | Both runs exit without error. Only the first run's output has an "event completed" line carrying the noted id. The query returns `1`. |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
```

- [ ] **Step 3: Check the cards against the ACs**

For each card, confirm its AC, category and scenario match the spec's §4.1 table. Every AC has at least one card: AC1 T1, AC2 T2–T3, AC3 T4–T5, AC4 T6, AC5 T7, AC6 T8–T11.

- [ ] **Step 4: Commit**

```bash
git add tests/F1 tests/README.md
git commit -m "test(f1): write the status lifecycle cards before the code

F1's functional cards are written from its acceptance criteria before
any code, so the code is built to the story rather than the tests to
the code. The PR reviewer checks them against the ACs at merge time.
Adds FX-SEEDED, since no user action can reach Confirmed until F5.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The transition table gains CONFIRM and COMPLETE

**Files:**
- Modify: `backend/services/event/src/domain/statusMachine.ts` (whole file)
- Modify: `backend/services/event/tests/domain/statusMachine.test.ts` (append)
- Create: `backend/services/event/tests/domain/statuses.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/services/event/tests/domain/statuses.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EVENT_STATUSES, EVENT_STATUS_LABELS } from "@connectsphere/contracts";

/** F1 AC1 — the permitted statuses, compared with the story's own words. */
describe("the permitted statuses (F1)", () => {
  it("are exactly the ten the story names", () => {
    expect(EVENT_STATUSES.map((status) => EVENT_STATUS_LABELS[status])).toEqual([
      "Draft",
      "Submitted",
      "Under Review",
      "Awaiting Clarification",
      "Approved",
      "Planning",
      "Confirmed",
      "Completed",
      "Cancelled",
      "Rejected",
    ]);
  });
});
```

In `backend/services/event/tests/domain/statusMachine.test.ts`, replace the import lines at the top with:

```ts
import { describe, expect, it } from "vitest";
import { EVENT_STATUSES, type EventStatus } from "@connectsphere/contracts";
import {
  COMPLETION_NOT_DUE_MESSAGE,
  evaluateTransition,
  QUEUE_STATUSES,
  refusalMessage,
  transitionRule,
  type EventAction,
} from "../../src/domain/statusMachine.js";
```

and append at the end of the file:

```ts
/**
 * Written out independently of the table under test, so these tests compare
 * the table with the stories rather than reading the table back to itself.
 */
const PERMITTED_FROM: Record<EventAction, EventStatus[]> = {
  SUBMIT: ["DRAFT"],
  OPEN_FOR_REVIEW: ["SUBMITTED"],
  REQUEST_CLARIFICATION: ["UNDER_REVIEW"],
  RESPOND_TO_CLARIFICATION: ["AWAITING_CLARIFICATION"],
  APPROVE: ["UNDER_REVIEW", "AWAITING_CLARIFICATION"],
  REJECT: ["UNDER_REVIEW", "AWAITING_CLARIFICATION"],
  CONFIRM: ["APPROVED", "PLANNING"],
  COMPLETE: ["CONFIRMED"],
};

describe("every status against every action (F1)", () => {
  for (const [action, from] of Object.entries(PERMITTED_FROM) as [EventAction, EventStatus[]][]) {
    for (const status of EVENT_STATUSES) {
      const permitted = from.includes(status);
      it(`${permitted ? "permits" : "refuses"} ${action} from ${status}`, () => {
        expect(evaluateTransition(status, action).permitted).toBe(permitted);
      });
    }
  }
});

describe("CONFIRM and COMPLETE (F1)", () => {
  it("reaches Confirmed from Approved or Planning (F1, performed by F5)", () => {
    expect(transitionRule("CONFIRM")).toEqual({ from: ["APPROVED", "PLANNING"], to: "CONFIRMED" });
  });

  it("completes only a Confirmed event", () => {
    expect(transitionRule("COMPLETE")).toEqual({ from: ["CONFIRMED"], to: "COMPLETED" });
  });

  it("refuses completing an Approved event, which was never confirmed", () => {
    const result = evaluateTransition("APPROVED", "COMPLETE");

    expect(result.permitted).toBe(false);
    if (result.permitted) throw new Error("expected a refusal");
    expect(result.message).toBe("This event is Approved and cannot move to Completed.");
  });
});

describe("refusal messages (F1)", () => {
  it("name the current status and the target as the user reads them", () => {
    expect(refusalMessage("REJECTED", "APPROVED")).toBe(
      "This event is Rejected and cannot move to Approved."
    );
  });

  it("name both statuses when completion is refused as not yet due", () => {
    expect(COMPLETION_NOT_DUE_MESSAGE).toBe(
      "This event is Confirmed and cannot move to Completed until its end date and time have passed."
    );
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd backend/services/event && npx vitest run tests/domain`
Expected: FAIL. `statusMachine.test.ts` cannot import `transitionRule`, `refusalMessage` or `COMPLETION_NOT_DUE_MESSAGE`. `statuses.test.ts` passes (AC1 already holds).

- [ ] **Step 3: Replace `backend/services/event/src/domain/statusMachine.ts`**

```ts
import { EVENT_STATUS_LABELS, type EventStatus } from "@connectsphere/contracts";

/**
 * F1 — status changes only as a consequence of a defined action. There is no
 * screen that sets an arbitrary status; every transition below belongs to a
 * story, and an attempt outside this table is refused naming both statuses.
 *
 * `transitionEvent` (api/transitionEvent.ts) is the only code that applies a
 * row of this table, and the only code that writes an event's status. Later
 * stories (F3 cancellation, S2) add rows here rather than writing status
 * themselves.
 */
export type EventAction =
  | "SUBMIT"
  | "OPEN_FOR_REVIEW"
  | "REQUEST_CLARIFICATION"
  | "RESPOND_TO_CLARIFICATION"
  | "APPROVE"
  | "REJECT"
  | "CONFIRM"
  | "COMPLETE";

export interface TransitionRule {
  from: readonly EventStatus[];
  to: EventStatus;
}

const TRANSITIONS: Record<EventAction, TransitionRule> = {
  SUBMIT: { from: ["DRAFT"], to: "SUBMITTED" },
  OPEN_FOR_REVIEW: { from: ["SUBMITTED"], to: "UNDER_REVIEW" },
  REQUEST_CLARIFICATION: { from: ["UNDER_REVIEW"], to: "AWAITING_CLARIFICATION" },
  RESPOND_TO_CLARIFICATION: { from: ["AWAITING_CLARIFICATION"], to: "UNDER_REVIEW" },
  APPROVE: { from: ["UNDER_REVIEW", "AWAITING_CLARIFICATION"], to: "APPROVED" },
  REJECT: { from: ["UNDER_REVIEW", "AWAITING_CLARIFICATION"], to: "REJECTED" },
  // F1 defines that Confirmed is reached by this transition; F5 performs it
  // and adds the readiness conditions that must hold first.
  CONFIRM: { from: ["APPROVED", "PLANNING"], to: "CONFIRMED" },
  // F1 — only a confirmed event took place, so only a confirmed event
  // completes, and only once its end has passed (checked where the transition
  // is applied, in transitionEvent).
  COMPLETE: { from: ["CONFIRMED"], to: "COMPLETED" },
};

export function transitionRule(action: EventAction): TransitionRule {
  return TRANSITIONS[action];
}

export function refusalMessage(current: EventStatus, target: EventStatus): string {
  return (
    `This event is ${EVENT_STATUS_LABELS[current]} and cannot move to ` +
    `${EVENT_STATUS_LABELS[target]}.`
  );
}

/** F1 — a Confirmed event refused completion because its end has not passed. */
export const COMPLETION_NOT_DUE_MESSAGE =
  "This event is Confirmed and cannot move to Completed until its end date and time have passed.";

export interface TransitionAllowed {
  permitted: true;
  from: EventStatus;
  to: EventStatus;
  action: EventAction;
}

export interface TransitionRefused {
  permitted: false;
  message: string;
}

export function evaluateTransition(
  current: EventStatus,
  action: EventAction
): TransitionAllowed | TransitionRefused {
  const rule = TRANSITIONS[action];

  if (!rule.from.includes(current)) {
    return { permitted: false, message: refusalMessage(current, rule.to) };
  }

  return { permitted: true, from: current, to: rule.to, action };
}

/** D1 — the statuses the review queue shows: those awaiting a decision. */
export const QUEUE_STATUSES: readonly EventStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "AWAITING_CLARIFICATION",
];
```

- [ ] **Step 4: Run the domain tests and confirm they pass**

Run: `cd backend/services/event && npx vitest run tests/domain`
Expected: PASS. All pre-existing statusMachine tests still pass, plus 80 "every status against every action" tests and the new describes.

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p backend/services/event/tsconfig.json --noEmit` (from the repo root)
Expected: no errors. `from` is now `readonly EventStatus[]`, and `.includes` on a readonly array is fine.

- [ ] **Step 6: Commit**

```bash
git add backend/services/event/src/domain/statusMachine.ts backend/services/event/tests/domain
git commit -m "feat(f1): add Confirm and Complete to the transition table

F1 defines that Confirmed is reached by a transition that writes history
(F5 performs it) and that only a Confirmed event completes. The
exhaustive test compares the table with an independently written list,
so it checks the stories rather than reading the table back.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The single status write — `updateStatusIf`

**Files:**
- Create: `backend/services/event/src/repo/eventStatus.ts`
- Create: `backend/services/event/tests/support/seedEvent.ts`
- Create: `backend/services/event/tests/repo/eventStatus.test.ts`

- [ ] **Step 1: Create the test-only seeding helper**

`backend/services/event/tests/support/seedEvent.ts`:

```ts
import type { Sql } from "postgres";
import type { EventStatus } from "@connectsphere/contracts";

/**
 * Inserts an event directly at any status, for tests that need a starting
 * point no user action can reach yet (Confirmed needs F5). Test-only: in src,
 * every status other than Draft is reached through a transition.
 */
export async function seedEvent(
  sql: Sql,
  options: { ownerId: string; status: EventStatus; endsAt: Date; name?: string }
): Promise<string> {
  const startsAt = new Date(options.endsAt.getTime() - 4 * 60 * 60 * 1000);
  const rows = await sql<{ id: string }[]>`
    insert into event.events (
      reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
      expected_attendance, equipment_required, registration_required, status, submitted_at,
      last_saved_at, created_by, updated_by
    ) values (
      'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'),
      ${options.ownerId}, ${options.name ?? "Seeded event"}, 'Seeded for a test',
      'Seeded for a test', ${startsAt}, ${options.endsAt}, 150, false, false,
      ${options.status}, now(), now(), ${options.ownerId}, ${options.ownerId}
    )
    returning id
  `;
  return rows[0]!.id;
}
```

- [ ] **Step 2: Write the failing tests**

`backend/services/event/tests/repo/eventStatus.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../support/testDb.js";
import { seedEvent } from "../support/seedEvent.js";
import {
  endHasPassed,
  listDueForCompletion,
  readStatus,
  updateStatusIf,
} from "../../src/repo/eventStatus.js";

/** F1 — the one statement that changes an event's status. */

const sql = testDb();

const OWNER = "af222222-0000-0000-0000-000000000001";
const COORDINATOR = "af222222-0000-0000-0000-000000000002";
const OTHER_COORDINATOR = "af222222-0000-0000-0000-000000000003";
const FAR_FUTURE = new Date("2030-01-01T12:00:00.000Z");

async function cleanUp() {
  await sql`delete from event.event_history where event_id in (
    select id from event.events where owner_id = ${OWNER}
  )`;
  await sql`delete from event.events where owner_id = ${OWNER}`;
}

async function statusOf(id: string) {
  const rows = await sql<{ status: string }[]>`select status from event.events where id = ${id}`;
  return rows[0]!.status;
}

beforeEach(cleanUp);

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("updateStatusIf (F1)", () => {
  it("moves an event whose status is in the from-list, returning the previous status", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "UNDER_REVIEW", endsAt: FAR_FUTURE });

    const changed = await sql.begin((tx) =>
      updateStatusIf(tx, {
        eventId: id,
        from: ["UNDER_REVIEW", "AWAITING_CLARIFICATION"],
        to: "APPROVED",
        actorId: COORDINATOR,
      })
    );

    expect(changed).toMatchObject({ previousStatus: "UNDER_REVIEW", event: { id, status: "APPROVED" } });
    expect(await statusOf(id)).toBe("APPROVED");
  });

  it("changes nothing and returns null when the status is not in the from-list", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "REJECTED", endsAt: FAR_FUTURE });

    const changed = await sql.begin((tx) =>
      updateStatusIf(tx, { eventId: id, from: ["UNDER_REVIEW"], to: "APPROVED", actorId: COORDINATOR })
    );

    expect(changed).toBeNull();
    expect(await statusOf(id)).toBe("REJECTED");
  });

  it("writes the extra columns in the same statement as the status", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "UNDER_REVIEW", endsAt: FAR_FUTURE });

    const changed = await sql.begin((tx) =>
      updateStatusIf(tx, {
        eventId: id,
        from: ["UNDER_REVIEW"],
        to: "APPROVED",
        actorId: COORDINATOR,
        set: tx`decided_by = ${COORDINATOR}, decided_at = now(),`,
      })
    );

    expect(changed!.event).toMatchObject({ status: "APPROVED", decidedBy: COORDINATOR });
    expect(changed!.event.decidedAt).toBeTruthy();
  });

  it("applies the extra condition, changing nothing when it does not hold", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: FAR_FUTURE });

    const changed = await sql.begin((tx) =>
      updateStatusIf(tx, {
        eventId: id,
        from: ["CONFIRMED"],
        to: "COMPLETED",
        actorId: null,
        onlyIf: endHasPassed(tx, new Date("2029-12-31T00:00:00.000Z")),
      })
    );

    expect(changed).toBeNull();
    expect(await statusOf(id)).toBe("CONFIRMED");
  });

  it("lets exactly one of two concurrent changes from the same status succeed", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "UNDER_REVIEW", endsAt: FAR_FUTURE });

    const results = await Promise.all(
      [COORDINATOR, OTHER_COORDINATOR].map((actorId) =>
        sql.begin((tx) =>
          updateStatusIf(tx, { eventId: id, from: ["UNDER_REVIEW"], to: "APPROVED", actorId })
        )
      )
    );

    expect(results.filter((result) => result !== null)).toHaveLength(1);
  });
});

describe("readStatus", () => {
  it("returns the event's status", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "PLANNING", endsAt: FAR_FUTURE });
    expect(await sql.begin((tx) => readStatus(tx, id))).toBe("PLANNING");
  });

  it("returns null for an event that does not exist", async () => {
    expect(
      await sql.begin((tx) => readStatus(tx, "af222222-ffff-ffff-ffff-ffffffffffff"))
    ).toBeNull();
  });
});

describe("listDueForCompletion (F1)", () => {
  it("lists Confirmed events whose end is at or before the time given, and nothing else", async () => {
    const now = new Date("2029-06-01T12:00:00.000Z");
    const endedEarlier = await seedEvent(sql, {
      ownerId: OWNER,
      status: "CONFIRMED",
      endsAt: new Date(now.getTime() - 1),
    });
    const endsExactlyNow = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: now });
    const endsLater = await seedEvent(sql, {
      ownerId: OWNER,
      status: "CONFIRMED",
      endsAt: new Date(now.getTime() + 1),
    });
    const approvedAndEnded = await seedEvent(sql, {
      ownerId: OWNER,
      status: "APPROVED",
      endsAt: new Date(now.getTime() - 1),
    });

    const due = await listDueForCompletion(sql, now);

    expect(due).toEqual(expect.arrayContaining([endedEarlier, endsExactlyNow]));
    expect(due).not.toContain(endsLater);
    expect(due).not.toContain(approvedAndEnded);
  });
});

describe("the permitted statuses in the database (F1)", () => {
  it("refuses a status outside the ten", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "SUBMITTED", endsAt: FAR_FUTURE });

    await expect(
      sql`update event.events set status = 'ARCHIVED' where id = ${id}`
    ).rejects.toMatchObject({ code: "23514" });
    expect(await statusOf(id)).toBe("SUBMITTED");
  });
});
```

- [ ] **Step 3: Run them and confirm they fail**

Run: `cd backend/services/event && npx vitest run tests/repo/eventStatus.test.ts`
Expected: FAIL. Cannot find module `../../src/repo/eventStatus.js`.

- [ ] **Step 4: Create `backend/services/event/src/repo/eventStatus.ts`**

```ts
import type { ISql, PendingQuery, Row, Sql, TransactionSql } from "postgres";
import type { EventStatus } from "@connectsphere/contracts";
import { transitionRule } from "../domain/statusMachine.js";
import { toEvent, type EventRow, type RawEvent } from "./events.js";

/**
 * F1 — the one statement in this service that changes an event's status.
 * Everything else reaches it through `transitionEvent`, which pairs it with the
 * transition table and the history entry; an architecture test fails if any
 * other statement sets `event.events.status`.
 */

/** A piece of SQL spliced into a statement: column assignments or a condition. */
export type Fragment = PendingQuery<Row[]>;

export interface StatusUpdate {
  eventId: string;
  from: readonly EventStatus[];
  to: EventStatus;
  /** Null for a system-initiated change. */
  actorId: string | null;
  /** Columns the action sets alongside the status, each followed by a comma. */
  set?: Fragment;
  /** A further condition on the row, beginning with `and`. */
  onlyIf?: Fragment;
}

/**
 * The condition in the `previous` CTE is the guard: the row is locked only if
 * its status is one the action may leave, so two concurrent actions cannot both
 * succeed — the second waits for the lock, re-reads the row, finds the status
 * moved on, and changes nothing (per-aggregate linearizability, §4.5). The
 * previous status comes from the same CTE, so the history entry can name it.
 */
export async function updateStatusIf(
  tx: TransactionSql,
  update: StatusUpdate
): Promise<{ event: EventRow; previousStatus: EventStatus } | null> {
  const rows = await tx<(RawEvent & { previous_status: EventStatus })[]>`
    with previous as (
      select id, status
      from event.events
      where id = ${update.eventId}
        and status in ${tx(update.from as string[])}
        ${update.onlyIf ?? tx``}
      for update
    )
    update event.events e set
      ${update.set ?? tx``}
      status = ${update.to},
      updated_at = now(),
      updated_by = ${update.actorId}
    from previous
    where e.id = previous.id
    returning e.*, previous.status as previous_status, (
      select a.coordinator_id from event.assignments a where a.event_id = e.id and a.is_active
    ) as assigned_coordinator_id
  `;
  const row = rows[0];
  return row ? { event: toEvent(row), previousStatus: row.previous_status } : null;
}

export async function readStatus(tx: TransactionSql, eventId: string): Promise<EventStatus | null> {
  const rows = await tx<{ status: EventStatus }[]>`
    select status from event.events where id = ${eventId}
  `;
  return rows[0]?.status ?? null;
}

/**
 * F1 AC6 — an event's end has passed once `now` reaches it. At exactly the end
 * instant it counts as passed: periods are half-open, `'[)'`, so the end
 * instant is not part of the event (implementation.md §4.4). The one place
 * this rule is written; both the completion guard and the sweep use it.
 */
export function endHasPassed(db: ISql, now: Date): Fragment {
  return db`and proposed_end_at <= ${now}`;
}

/** F1 — the events the completion sweep should complete, oldest ending first. */
export async function listDueForCompletion(sql: Sql, now: Date): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    select id from event.events
    where status in ${sql(transitionRule("COMPLETE").from as string[])}
      ${endHasPassed(sql, now)}
    order by proposed_end_at, id
  `;
  return rows.map((row) => row.id);
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `cd backend/services/event && npx vitest run tests/repo/eventStatus.test.ts`
Expected: PASS, 10 tests.

If `tsc` or Vitest rejects `ISql` as the type of `endHasPassed`'s first parameter, check that `import type { ISql } from "postgres"` resolves: it's declared in `node_modules/postgres/types/index.d.ts` inside `namespace postgres`, and both `Sql` and `TransactionSql` extend it.

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc -p backend/services/event/tsconfig.json --noEmit`
Expected: no errors.

```bash
git add backend/services/event/src/repo/eventStatus.ts backend/services/event/tests/support/seedEvent.ts backend/services/event/tests/repo/eventStatus.test.ts
git commit -m "feat(f1): add the one conditional statement that writes status

Its WHERE clause is the guard: a status outside the action's from-list
changes no row, and two concurrent actions cannot both succeed. The
end-has-passed rule is written once, for the completion guard and the
sweep alike.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `transitionEvent` and the column fragments

**Files:**
- Create: `backend/services/event/src/api/transitionEvent.ts`
- Modify: `backend/services/event/src/repo/events.ts` (append three functions, add one import)
- Create: `backend/services/event/tests/api/transitionEvent.test.ts`

- [ ] **Step 1: Write the failing tests**

`backend/services/event/tests/api/transitionEvent.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../support/testDb.js";
import { seedEvent } from "../support/seedEvent.js";
import { SYSTEM_ACTOR, transitionEvent } from "../../src/api/transitionEvent.js";
import { decisionColumns } from "../../src/repo/events.js";

/** F1 — the one way an event's status changes. */

const sql = testDb();

const OWNER = "af111111-0000-0000-0000-000000000001";
const COORDINATOR = "af111111-0000-0000-0000-000000000002";
const OTHER_COORDINATOR = "af111111-0000-0000-0000-000000000003";
const coordinator = { userId: COORDINATOR, role: "EVENT_COORDINATOR" };
const FAR_FUTURE = new Date("2030-01-01T12:00:00.000Z");

async function cleanUp() {
  await sql`delete from event.event_history where event_id in (
    select id from event.events where owner_id = ${OWNER}
  )`;
  await sql`delete from event.events where owner_id = ${OWNER}`;
}

async function statusOf(id: string) {
  const rows = await sql<{ status: string }[]>`select status from event.events where id = ${id}`;
  return rows[0]!.status;
}

async function historyOf(id: string) {
  return sql`
    select previous_status, new_status, actor_user_id, actor_role, triggering_action, occurred_at
    from event.event_history where event_id = ${id} and entry_type = 'STATUS_CHANGE'
    order by occurred_at
  `;
}

beforeEach(cleanUp);

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("transitionEvent (F1)", () => {
  it("applies a permitted transition and returns the event and its previous status", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "UNDER_REVIEW", endsAt: FAR_FUTURE });

    const result = await sql.begin((tx) => transitionEvent(tx, id, "APPROVE", coordinator));

    expect(result).toMatchObject({ ok: true, previousStatus: "UNDER_REVIEW", event: { status: "APPROVED" } });
    expect(await statusOf(id)).toBe("APPROVED");
  });

  it("writes a history entry with both statuses, the actor, their role, the action and the time", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "UNDER_REVIEW", endsAt: FAR_FUTURE });
    const before = Date.now();

    await sql.begin((tx) => transitionEvent(tx, id, "APPROVE", coordinator));

    const history = await historyOf(id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      previous_status: "UNDER_REVIEW",
      new_status: "APPROVED",
      actor_user_id: COORDINATOR,
      actor_role: "EVENT_COORDINATOR",
      triggering_action: "APPROVE",
    });
    expect(Math.abs(new Date(history[0]!.occurred_at).getTime() - before)).toBeLessThan(60_000);
  });

  it("refuses a transition not permitted from the current status, naming both, and stores nothing", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "REJECTED", endsAt: FAR_FUTURE });

    const result = await sql.begin((tx) => transitionEvent(tx, id, "APPROVE", coordinator));

    expect(result).toEqual({
      ok: false,
      currentStatus: "REJECTED",
      message: "This event is Rejected and cannot move to Approved.",
    });
    expect(await statusOf(id)).toBe("REJECTED");
    expect(await historyOf(id)).toHaveLength(0);
  });

  it("records a system-initiated change with no user and the SYSTEM role", async () => {
    const id = await seedEvent(sql, {
      ownerId: OWNER,
      status: "CONFIRMED",
      endsAt: new Date("2029-06-01T12:00:00.000Z"),
    });

    await sql.begin((tx) =>
      transitionEvent(tx, id, "COMPLETE", SYSTEM_ACTOR, { now: new Date("2029-06-01T12:00:00.001Z") })
    );

    const history = await historyOf(id);
    expect(history[0]).toMatchObject({ actor_user_id: null, actor_role: "SYSTEM", triggering_action: "COMPLETE" });
  });

  it("writes the action's own columns in the same statement as the status", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "UNDER_REVIEW", endsAt: FAR_FUTURE });

    const result = await sql.begin((tx) =>
      transitionEvent(tx, id, "REJECT", coordinator, {
        set: decisionColumns(tx, COORDINATOR, "No venue can host this date."),
      })
    );

    expect(result.ok && result.event).toMatchObject({
      status: "REJECTED",
      decidedBy: COORDINATOR,
      rejectionReason: "No venue can host this date.",
    });
  });

  it("lets exactly one of two concurrent approvals succeed, writing one history entry", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "UNDER_REVIEW", endsAt: FAR_FUTURE });

    const results = await Promise.all(
      [COORDINATOR, OTHER_COORDINATOR].map((userId) =>
        sql.begin((tx) => transitionEvent(tx, id, "APPROVE", { userId, role: "EVENT_COORDINATOR" }))
      )
    );

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toMatchObject({
      message: "This event is Approved and cannot move to Approved.",
    });
    expect(await historyOf(id)).toHaveLength(1);
  });

  it("throws for an event that does not exist", async () => {
    await expect(
      sql.begin((tx) =>
        transitionEvent(tx, "af111111-ffff-ffff-ffff-ffffffffffff", "APPROVE", coordinator)
      )
    ).rejects.toThrow("No event");
  });
});

describe("completing an event (F1)", () => {
  const END = new Date("2029-06-01T12:00:00.000Z");
  const at = (offsetMs: number) => new Date(END.getTime() + offsetMs);

  it("refuses one millisecond before the end, saying why", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: END });

    const result = await sql.begin((tx) => transitionEvent(tx, id, "COMPLETE", SYSTEM_ACTOR, { now: at(-1) }));

    expect(result).toMatchObject({
      ok: false,
      message: "This event is Confirmed and cannot move to Completed until its end date and time have passed.",
    });
    expect(await statusOf(id)).toBe("CONFIRMED");
    expect(await historyOf(id)).toHaveLength(0);
  });

  it("completes at exactly the end instant", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: END });

    const result = await sql.begin((tx) => transitionEvent(tx, id, "COMPLETE", SYSTEM_ACTOR, { now: at(0) }));

    expect(result.ok).toBe(true);
    expect(await statusOf(id)).toBe("COMPLETED");
  });

  it("completes one millisecond after the end", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: END });

    const result = await sql.begin((tx) => transitionEvent(tx, id, "COMPLETE", SYSTEM_ACTOR, { now: at(1) }));

    expect(result.ok).toBe(true);
  });

  it("refuses completing an Approved event whose end has passed", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "APPROVED", endsAt: END });

    const result = await sql.begin((tx) => transitionEvent(tx, id, "COMPLETE", SYSTEM_ACTOR, { now: at(60_000) }));

    expect(result).toMatchObject({ ok: false, message: "This event is Approved and cannot move to Completed." });
    expect(await statusOf(id)).toBe("APPROVED");
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd backend/services/event && npx vitest run tests/api/transitionEvent.test.ts`
Expected: FAIL. Cannot find module `../../src/api/transitionEvent.js`.

- [ ] **Step 3: Append the column fragments to `backend/services/event/src/repo/events.ts`**

Add to the imports at the top of the file:

```ts
import type { Fragment } from "./eventStatus.js";
```

Append at the end of the file:

```ts
/**
 * The columns each action sets in the same statement as its status change
 * (F1). They are fragments, not statements: `updateStatusIf` splices them into
 * its conditional UPDATE, so the decision, the review claim or the submission
 * can never be stored without the status change, or the other way round.
 */

/** D4/D5 — the decision, its maker and its time; the reason for a rejection. */
export function decisionColumns(
  tx: TransactionSql,
  deciderId: string,
  rejectionReason: string | null
): Fragment {
  return tx`decided_by = ${deciderId}, decided_at = now(), rejection_reason = ${rejectionReason},`;
}

/** D1 — the coordinator who opened the request, and when. */
export function reviewColumns(tx: TransactionSql, coordinatorId: string): Fragment {
  return tx`reviewing_coordinator_id = ${coordinatorId}, review_started_at = now(),`;
}

/**
 * B1/C2 — the reference and submission time, plus the values on screen when
 * they are sent with a draft's submission, so they are stored only if the
 * submission succeeds.
 */
export function submissionColumns(tx: TransactionSql, fields?: EventFields): Fragment {
  const values = fields
    ? tx`
        name = ${fields.name},
        purpose = ${fields.purpose},
        description = ${fields.description},
        proposed_start_at = ${fields.proposedStartAt},
        proposed_end_at = ${fields.proposedEndAt},
        expected_attendance = ${fields.expectedAttendance},
        venue_requirements = ${jsonOrNull(tx, fields.venueRequirements)},
        accessibility_needs = ${fields.accessibilityNeeds},
        equipment_required = ${fields.equipmentRequired},
        equipment_requirements = ${jsonOrNull(tx, fields.equipmentRequirements)},
        registration_required = ${fields.registrationRequired},
        registration_opens_at = ${fields.registrationOpensAt},
        registration_closes_at = ${fields.registrationClosesAt},
        last_saved_at = now(),
      `
    : tx``;
  return tx`
    ${values}
    reference = 'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'),
    submitted_at = now(),
  `;
}
```

- [ ] **Step 4: Create `backend/services/event/src/api/transitionEvent.ts`**

```ts
import type { TransactionSql } from "postgres";
import type { EventStatus } from "@connectsphere/contracts";
import {
  COMPLETION_NOT_DUE_MESSAGE,
  refusalMessage,
  transitionRule,
  type EventAction,
} from "../domain/statusMachine.js";
import { endHasPassed, readStatus, updateStatusIf, type Fragment } from "../repo/eventStatus.js";
import { recordStatusChange } from "../repo/eventHistory.js";
import type { EventRow } from "../repo/events.js";

/**
 * F1 — the one way an event's status changes. Given an action from the
 * transition table, it moves the event in a single conditional statement,
 * writes the history entry, and — when the action is not permitted from the
 * event's current status — changes nothing and says why, naming both statuses.
 *
 * Call it inside the transaction that does the rest of the action's work, and
 * call it first: a refusal then leaves nothing behind.
 *
 * Scope (A3) is the caller's job — look the event up in scope and answer 404
 * before calling this.
 */

export interface TransitionActor {
  userId: string | null;
  role: string;
}

/** A change nobody asked for — the completion sweep (implementation.md §3.3). */
export const SYSTEM_ACTOR: TransitionActor = { userId: null, role: "SYSTEM" };

export type TransitionOutcome =
  | { ok: true; event: EventRow; previousStatus: EventStatus }
  | { ok: false; currentStatus: EventStatus; message: string };

export async function transitionEvent(
  tx: TransactionSql,
  eventId: string,
  action: EventAction,
  actor: TransitionActor,
  options: { set?: Fragment; now?: Date } = {}
): Promise<TransitionOutcome> {
  const rule = transitionRule(action);

  // F1 AC6 — an event moves to Completed only after its end has passed. The
  // condition is part of the statement that changes the status, so no caller
  // can complete an event early.
  const onlyIf = action === "COMPLETE" ? endHasPassed(tx, options.now ?? new Date()) : undefined;

  const changed = await updateStatusIf(tx, {
    eventId,
    from: rule.from,
    to: rule.to,
    actorId: actor.userId,
    set: options.set,
    onlyIf,
  });

  if (!changed) {
    const currentStatus = await readStatus(tx, eventId);
    if (currentStatus === null) {
      throw new Error(`No event ${eventId} exists to transition.`);
    }
    const notYetDue = action === "COMPLETE" && rule.from.includes(currentStatus);
    return {
      ok: false,
      currentStatus,
      message: notYetDue ? COMPLETION_NOT_DUE_MESSAGE : refusalMessage(currentStatus, rule.to),
    };
  }

  await recordStatusChange(tx, eventId, {
    previousStatus: changed.previousStatus,
    newStatus: rule.to,
    actorUserId: actor.userId,
    actorRole: actor.role,
    triggeringAction: action,
  });

  return { ok: true, event: changed.event, previousStatus: changed.previousStatus };
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `cd backend/services/event && npx vitest run tests/api/transitionEvent.test.ts tests/repo/eventStatus.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck, run the whole event suite, and commit**

Run: `npx tsc -p backend/services/event/tsconfig.json --noEmit && npm test -w @connectsphere/event-service`
Expected: no type errors. All tests pass: nothing calls the new code yet, so the existing 173 are untouched.

```bash
git add backend/services/event/src/api/transitionEvent.ts backend/services/event/src/repo/events.ts backend/services/event/tests/api/transitionEvent.test.ts
git commit -m "feat(f1): add transitionEvent, the one way status changes

It moves the event in one conditional statement, writes the history
entry, and on refusal changes nothing and names both statuses.
Completing also requires the end to have passed, checked by the same
statement, so no caller can complete an event early.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Approve and reject through `transitionEvent` (D4, D5)

**Files:**
- Modify: `backend/services/event/src/api/decisions.ts` (whole file)
- Modify: `backend/services/event/tests/api/decisions.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `backend/services/event/tests/api/decisions.test.ts`:

```ts
describe("refused decisions store nothing (F1)", () => {
  async function historyCount(eventId: string) {
    const rows = await sql<{ n: number }[]>`
      select count(*)::int as n from event.event_history where event_id = ${eventId}
    `;
    return rows[0]!.n;
  }

  it("refuses approving a Rejected event, naming both statuses, and writes no history", async () => {
    const event = await givenEventUnderReview();
    await request(app)
      .post(`/api/v1/events/${event.id}/reject`)
      .set(bearer)
      .send({ reason: "No venue can host this date." });
    const before = await historyCount(event.id);

    const res = await request(app).post(`/api/v1/events/${event.id}/approve`).set(bearer).send();

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: "STATUS_TRANSITION_NOT_PERMITTED",
      message: "This event is Rejected and cannot move to Approved.",
    });
    expect(await historyCount(event.id)).toBe(before);
    const rows = await sql<{ status: string }[]>`select status from event.events where id = ${event.id}`;
    expect(rows[0]!.status).toBe("REJECTED");
  });

  it("lets exactly one of two concurrent approvals succeed", async () => {
    const event = await givenEventUnderReview();

    const responses = await Promise.all([
      request(app).post(`/api/v1/events/${event.id}/approve`).set(bearer).send(),
      request(app).post(`/api/v1/events/${event.id}/approve`).set(bearer).send(),
    ]);

    expect(responses.map((res) => res.status).sort()).toEqual([200, 409]);
    const approvals = await sql<{ n: number }[]>`
      select count(*)::int as n from event.event_history
      where event_id = ${event.id} and triggering_action = 'APPROVE'
    `;
    expect(approvals[0]!.n).toBe(1);
  });
});
```

- [ ] **Step 2: Run them and see what happens today**

Run: `cd backend/services/event && npx vitest run tests/api/decisions.test.ts`
Expected: the first new test passes already, since the pre-check refused it. The concurrent test may pass or fail depending on timing: today's race loser answers `409 EVENT_ALREADY_DECIDED`, which the status assertion allows. Both are regression locks for the refactor. Continue.

- [ ] **Step 3: Replace `backend/services/event/src/api/decisions.ts`**

```ts
import { Router, type Response } from "express";
import type { Sql } from "postgres";
import { EVENT_TOPICS } from "@connectsphere/contracts";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { decisionColumns, findEventInScope } from "../repo/events.js";
import { writeOutbox } from "../events/outbox.js";
import { transitionEvent } from "./transitionEvent.js";
import { rejectionBodySchema } from "./schemas.js";
import { refuse } from "./errors.js";

/**
 * D4, D5 — approving and rejecting an event request.
 *
 * A decision is one transition (F1): the status, the decision and its time are
 * written by one conditional statement, so an event that already carries a
 * decision cannot be decided again, and two coordinators deciding at once
 * cannot both succeed. The history entry and the organiser's notification are
 * written in the same transaction, so a refusal leaves no trace and a success
 * leaves no half-finished state.
 */
export function decisionsRouter(sql: Sql) {
  const router = Router();

  async function decide(
    req: ActorRequest,
    res: Response,
    outcome: "APPROVED" | "REJECTED",
    reason: string | null
  ) {
    const { userId, role, scope } = req.actor!;
    const action = outcome === "APPROVED" ? "APPROVE" : "REJECT";

    const event = await findEventInScope(sql, req.params.id, scope, userId);
    if (!event) {
      refuse(res, 404, "EVENT_NOT_FOUND", "No event with that reference is available to you.");
      return;
    }

    const result = await sql.begin(async (tx) => {
      const decided = await transitionEvent(
        tx,
        event.id,
        action,
        { userId, role },
        { set: decisionColumns(tx, userId, reason) }
      );
      if (!decided.ok) return decided;

      await writeOutbox(tx, {
        topic: outcome === "APPROVED" ? EVENT_TOPICS.approved : EVENT_TOPICS.rejected,
        messageType: outcome === "APPROVED" ? "event.approved" : "event.rejected",
        aggregateId: event.id,
        actor: { userId, role },
        correlationId: req.header("x-correlation-id") ?? null,
        payload:
          outcome === "APPROVED"
            ? {
                eventId: event.id,
                eventReference: event.reference,
                eventName: event.name,
                ownerId: event.ownerId,
                approvedBy: userId,
                approvedAt: decided.event.decidedAt!,
              }
            : {
                eventId: event.id,
                eventReference: event.reference,
                eventName: event.name,
                ownerId: event.ownerId,
                rejectedBy: userId,
                rejectedAt: decided.event.decidedAt!,
                reason: reason!,
              },
      });

      return decided;
    });

    if (!result.ok) {
      // F1 — a refused transition stores nothing, and names the status the
      // event is in and the one it could not move to.
      refuse(res, 409, "STATUS_TRANSITION_NOT_PERMITTED", result.message);
      return;
    }

    res.status(200).json(result.event);
  }

  /** D4 — approval alone creates no venue booking and no equipment reservation. */
  router.post(
    "/api/v1/events/:id/approve",
    ...authenticate,
    requireRole("EVENT_COORDINATOR"),
    async (req: ActorRequest, res) => {
      await decide(req, res, "APPROVED", null);
    }
  );

  router.post(
    "/api/v1/events/:id/reject",
    ...authenticate,
    requireRole("EVENT_COORDINATOR"),
    async (req: ActorRequest, res) => {
      const parsed = rejectionBodySchema.safeParse(req.body);
      const reason = parsed.success ? parsed.data.reason : null;

      // D5 — without a reason the rejection is not performed at all: the
      // status is unchanged and no rejection timestamp is recorded.
      if (typeof reason !== "string" || reason.trim().length === 0) {
        refuse(res, 400, "VALIDATION_FAILED", "A reason is required to reject an event request.", {
          fields: [{ field: "reason", message: "A reason is required." }],
        });
        return;
      }

      await decide(req, res, "REJECTED", reason.trim());
    }
  );

  return router;
}
```

- [ ] **Step 4: Run the decisions tests and confirm they pass**

Run: `cd backend/services/event && npx vitest run tests/api/decisions.test.ts`
Expected: PASS, including every pre-existing D4/D5 test.

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc -p backend/services/event/tsconfig.json --noEmit`
Expected: no errors.

```bash
git add backend/services/event/src/api/decisions.ts backend/services/event/tests/api/decisions.test.ts
git commit -m "refactor(f1): decide approvals and rejections through transitionEvent

The status and the decision are now written by one conditional
statement. A race loser is refused with STATUS_TRANSITION_NOT_PERMITTED
naming both statuses, like every other refused transition, rather than
EVENT_ALREADY_DECIDED.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Clarification request and response through `transitionEvent` (D2, D3)

**Files:**
- Modify: `backend/services/event/src/api/clarifications.ts`
- Modify: `backend/services/event/tests/api/clarifications.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `backend/services/event/tests/api/clarifications.test.ts`:

```ts
describe("a refused clarification request stores nothing (F1)", () => {
  it("refuses asking an Approved event for clarification, storing no clarification and no history", async () => {
    const event = await givenEventUnderReview();
    await request(app).post(`/api/v1/events/${event.id}/approve`).set(bearer).send();
    const before = await sql<{ history: number; clarifications: number }[]>`
      select
        (select count(*)::int from event.event_history where event_id = ${event.id}) as history,
        (select count(*)::int from event.clarifications where event_id = ${event.id}) as clarifications
    `;

    const res = await request(app)
      .post(`/api/v1/events/${event.id}/clarifications`)
      .set(bearer)
      .send({ message: "Please confirm the attendance." });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: "STATUS_TRANSITION_NOT_PERMITTED",
      message: "This event is Approved and cannot move to Awaiting Clarification.",
    });
    const after = await sql<{ history: number; clarifications: number }[]>`
      select
        (select count(*)::int from event.event_history where event_id = ${event.id}) as history,
        (select count(*)::int from event.clarifications where event_id = ${event.id}) as clarifications
    `;
    expect(after[0]).toEqual(before[0]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd backend/services/event && npx vitest run tests/api/clarifications.test.ts`
Expected: PASS already, since today's pre-check refuses it too. It's a regression lock for the reorder below. Continue.

- [ ] **Step 3: Change the imports at the top of `backend/services/event/src/api/clarifications.ts`**

Replace:

```ts
import { evaluateTransition } from "../domain/statusMachine.js";
import { applyAmendments, findEventInScope, setStatus, type EventRow } from "../repo/events.js";
```

with:

```ts
import { applyAmendments, findEventInScope, type EventRow } from "../repo/events.js";
```

replace:

```ts
import { recordFieldChanges, recordStatusChange } from "../repo/eventHistory.js";
```

with:

```ts
import { recordFieldChanges } from "../repo/eventHistory.js";
import { transitionEvent } from "./transitionEvent.js";
```

and add below the `hasContent` function:

```ts
/** Thrown inside the response transaction so that the status change rolls back. */
class NoOpenClarification extends Error {}
```

- [ ] **Step 4: Replace the clarification request's body (after the 404 check)**

In the `POST /api/v1/events/:id/clarifications` handler, replace everything from `const transition = evaluateTransition(event.status, "REQUEST_CLARIFICATION");` to the handler's closing `res.status(201).json(clarification);` with:

```ts
      const result = await sql.begin(async (tx) => {
        // F1 — the transition is the first write, so a refusal stores nothing:
        // no status change, no history entry and no clarification.
        const moved = await transitionEvent(tx, event.id, "REQUEST_CLARIFICATION", { userId, role });
        if (!moved.ok) return moved;

        const created = await insertClarification(tx, event.id, message.trim(), userId);

        await writeOutbox(tx, {
          topic: EVENT_TOPICS.clarificationRequested,
          messageType: "event.clarification-requested",
          aggregateId: event.id,
          actor: { userId, role },
          correlationId: req.header("x-correlation-id") ?? null,
          payload: {
            eventId: event.id,
            eventReference: event.reference,
            eventName: event.name,
            clarificationId: created.id,
            ownerId: event.ownerId,
            requestedBy: userId,
            requestedAt: created.requestedAt,
          },
        });

        return { ok: true as const, clarification: created };
      });

      if (!result.ok) {
        refuse(res, 409, "STATUS_TRANSITION_NOT_PERMITTED", result.message);
        return;
      }

      res.status(201).json(result.clarification);
```

- [ ] **Step 5: Replace the clarification response's body (after the 404 check)**

In the `POST /api/v1/events/:id/clarifications/respond` handler, replace everything from `const transition = evaluateTransition(event.status, "RESPOND_TO_CLARIFICATION");` to the handler's closing `res.status(200).json(result);` with:

```ts
      const result = await sql
        .begin(async (tx) => {
          // F1 — the transition is the first write, so a refusal stores nothing.
          const moved = await transitionEvent(tx, event.id, "RESPOND_TO_CLARIFICATION", {
            userId,
            role,
          });
          if (!moved.ok) return moved;

          const open = await findOpenClarification(tx, event.id);
          if (!open) throw new NoOpenClarification();

          const clarification = await recordResponse(
            tx,
            open.id,
            hasContent(message) ? message.trim() : null,
            userId
          );

          let updated: EventRow = moved.event;
          if (amendedFields.length > 0) {
            // D3 — the values as originally submitted are retained in the
            // history alongside the amended values.
            await recordFieldChanges(
              tx,
              event.id,
              amendedFields.map((field) => ({
                fieldName: field,
                previousValue: stringify(event[field as keyof EventRow]),
                newValue: stringify((amendments as Record<string, unknown>)[field]),
              })),
              { userId, role },
              "RESPOND_TO_CLARIFICATION"
            );

            updated = await applyAmendments(
              tx,
              event.id,
              Object.fromEntries(
                amendedFields.map((field) => {
                  const column = AMENDABLE_COLUMNS[field as keyof typeof AMENDABLE_COLUMNS];
                  const value = (amendments as Record<string, unknown>)[field];
                  // The requirements columns are jsonb, so structured values are
                  // sent as JSON rather than left to the driver to guess.
                  const isJson =
                    column === "venue_requirements" || column === "equipment_requirements";
                  return [column, isJson && value != null ? tx.json(value as never) : value];
                })
              ),
              userId
            );
          }

          await writeOutbox(tx, {
            topic: EVENT_TOPICS.clarificationResponded,
            messageType: "event.clarification-responded",
            aggregateId: event.id,
            actor: { userId, role },
            correlationId: req.header("x-correlation-id") ?? null,
            payload: {
              eventId: event.id,
              eventReference: event.reference,
              eventName: event.name,
              clarificationId: clarification.id,
              requestedBy: clarification.requestedBy,
              respondedBy: userId,
              respondedAt: clarification.respondedAt!,
              amendedFields,
            },
          });

          return { ok: true as const, clarification, event: updated };
        })
        .catch((error: unknown) => {
          // The throw rolled the transaction back, so the status is unchanged.
          if (error instanceof NoOpenClarification) return "NO_OPEN_CLARIFICATION" as const;
          throw error;
        });

      if (result === "NO_OPEN_CLARIFICATION") {
        refuse(res, 409, "NO_OPEN_CLARIFICATION", "This event has no outstanding clarification.");
        return;
      }

      if (!result.ok) {
        refuse(res, 409, "STATUS_TRANSITION_NOT_PERMITTED", result.message);
        return;
      }

      res.status(200).json({ clarification: result.clarification, event: result.event });
```

- [ ] **Step 6: Run the clarification tests and confirm they pass**

Run: `cd backend/services/event && npx vitest run tests/api/clarifications.test.ts`
Expected: PASS, including every pre-existing D2/D3 test.

- [ ] **Step 7: Typecheck and commit**

Run: `npx tsc -p backend/services/event/tsconfig.json --noEmit`
Expected: no errors.

```bash
git add backend/services/event/src/api/clarifications.ts backend/services/event/tests/api/clarifications.test.ts
git commit -m "refactor(f1): move clarification status through transitionEvent

The status change is now the first write in each transaction, so a
refused request stores no clarification, and two concurrent requests can
no longer both pass a check made outside the transaction.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Open for review through `transitionEvent` (D1)

**Files:**
- Modify: `backend/services/event/src/api/events.ts`

- [ ] **Step 1: Run the D1 tests as the baseline**

Run: `cd backend/services/event && npx vitest run tests/api/review.test.ts`
Expected: PASS. These tests (claiming moves to Under Review; a second coordinator sees the first reviewer) are the regression lock for this task.

- [ ] **Step 2: Change the imports in `backend/services/event/src/api/events.ts`**

Replace the `../repo/events.js` import and the `recordStatusChange` import:

```ts
import {
  claimForReview,
  findEventInScope,
  listEventsInScope,
  listReviewQueue,
  type EventRow,
} from "../repo/events.js";
import { listDraftsForOwner } from "../repo/drafts.js";
import { recordStatusChange } from "../repo/eventHistory.js";
```

with:

```ts
import {
  findEventInScope,
  listEventsInScope,
  listReviewQueue,
  reviewColumns,
  type EventRow,
} from "../repo/events.js";
import { listDraftsForOwner } from "../repo/drafts.js";
import { transitionEvent } from "./transitionEvent.js";
```

- [ ] **Step 3: Replace the claim in the `GET /api/v1/events/:id` handler**

Replace:

```ts
    const claimed = await sql.begin(async (tx) => {
      const opened = await claimForReview(tx, event.id, userId);
      if (opened) {
        await recordStatusChange(tx, event.id, {
          previousStatus: "SUBMITTED",
          newStatus: "UNDER_REVIEW",
          actorUserId: userId,
          actorRole: role,
          triggeringAction: "OPEN_FOR_REVIEW",
        });
      }
      return opened;
    });

    res.status(200).json(claimed ?? (await findEventInScope(sql, event.id, scope, userId)));
```

with:

```ts
    const opened = await sql.begin((tx) =>
      transitionEvent(tx, event.id, "OPEN_FOR_REVIEW", { userId, role }, { set: reviewColumns(tx, userId) })
    );

    // D1 — a second coordinator opening the same request is refused by the
    // transition and changes nothing, so they see the first reviewer.
    res.status(200).json(opened.ok ? opened.event : await findEventInScope(sql, event.id, scope, userId));
```

- [ ] **Step 4: Run the D1 tests and confirm they still pass**

Run: `cd backend/services/event && npx vitest run tests/api/review.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc -p backend/services/event/tsconfig.json --noEmit`
Expected: no errors.

```bash
git add backend/services/event/src/api/events.ts
git commit -m "refactor(f1): open requests for review through transitionEvent

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Submission through `transitionEvent` (B1, C2)

**Files:**
- Modify: `backend/services/event/src/repo/drafts.ts` (`insertDraft`, `jsonOrNull` types)
- Modify: `backend/services/event/src/api/submitEvent.ts` (whole file)
- Modify: `backend/services/event/src/api/events.ts` (`POST /api/v1/events` handler)
- Modify: `backend/services/event/src/api/drafts.ts` (submit handler)
- Modify: `backend/services/event/tests/api/submission.test.ts` (one test added)
- Create: `backend/services/event/tests/api/statusHistory.test.ts`

- [ ] **Step 1: Write the failing tests**

In `backend/services/event/tests/api/submission.test.ts`, directly after the test `"refuses to submit the same draft twice"` and inside the same `describe`, add:

```ts
  it("names the current status and Submitted when a request is submitted twice (F1)", async () => {
    const draft = await givenADraft(validRequest);
    await request(app).post(`/api/v1/event-drafts/${draft.id}/submit`).set(bearer).send();

    const again = await request(app).post(`/api/v1/event-drafts/${draft.id}/submit`).set(bearer).send();

    expect(again.body.error).toMatchObject({
      code: "DRAFT_ALREADY_SUBMITTED",
      message: "This event is Submitted and cannot move to Submitted.",
    });
  });
```

Create `backend/services/event/tests/api/statusHistory.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../support/testDb.js";

process.env.EVENT_COORDINATOR_POOL = "af555555-0000-0000-0000-00000000000a";

vi.mock("../../src/auth/verifyJwt.js", () => ({
  verifyJwt: (req: any, _res: any, next: any) => {
    req.auth = { supabaseUserId: "test-subject" };
    next();
  },
}));

vi.mock("../../src/auth/identityClient.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/auth/identityClient.js")>(
    "../../src/auth/identityClient.js"
  );
  return { ...actual, fetchCurrentUser: vi.fn(), fetchEventsScope: vi.fn() };
});

const { fetchCurrentUser, fetchEventsScope } = await import("../../src/auth/identityClient.js");
const { app } = await import("../../src/index.js");

const sql = testDb();

const ORGANISER = "af555555-0000-0000-0000-000000000001";
const COORDINATOR = "af555555-0000-0000-0000-000000000002";
const bearer = { Authorization: "Bearer test-token" };

function signedInAs(userId: string, role: string) {
  vi.mocked(fetchCurrentUser).mockResolvedValue({
    id: userId,
    email: "user@connectsphere.test",
    role: role as never,
  });
  vi.mocked(fetchEventsScope).mockResolvedValue(
    role === "EVENT_COORDINATOR" ? { scopeType: "ALL" } : { scopeType: "OWNED_BY_USER", userId }
  );
}

const validRequest = {
  name: "Annual Research Symposium",
  purpose: "Share faculty research",
  description: "A one-day symposium.",
  proposedStartAt: "2026-12-02T14:00:00.000Z",
  proposedEndAt: "2026-12-02T18:00:00.000Z",
  expectedAttendance: 150,
  registrationRequired: false,
  equipmentRequired: false,
};

async function cleanUp() {
  const owned = sql`select id from event.events where owner_id = ${ORGANISER}`;
  await sql`delete from event.event_history where event_id in (${owned})`;
  await sql`delete from event.assignments where event_id in (${owned})`;
  await sql`delete from event.outbox where envelope->'payload'->>'ownerId' = ${ORGANISER}`;
  await sql`delete from event.events where owner_id = ${ORGANISER}`;
}

beforeEach(async () => {
  vi.mocked(fetchCurrentUser).mockReset();
  vi.mocked(fetchEventsScope).mockReset();
  await cleanUp();
});

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("status history (F1)", () => {
  it("records every change on the way to Approved with both statuses, the actor, role, action and time", async () => {
    signedInAs(ORGANISER, "EVENT_ORGANISER");
    const created = await request(app).post("/api/v1/events").set(bearer).send(validRequest);
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");
    await request(app).get(`/api/v1/events/${created.body.id}`).set(bearer);
    await request(app).post(`/api/v1/events/${created.body.id}/approve`).set(bearer).send();

    const history = await sql`
      select previous_status, new_status, actor_user_id, actor_role, triggering_action, occurred_at
      from event.event_history
      where event_id = ${created.body.id} and entry_type = 'STATUS_CHANGE'
      order by occurred_at
    `;

    expect(history.map(({ occurred_at, ...entry }) => entry)).toEqual([
      {
        previous_status: "DRAFT",
        new_status: "SUBMITTED",
        actor_user_id: ORGANISER,
        actor_role: "EVENT_ORGANISER",
        triggering_action: "SUBMIT",
      },
      {
        previous_status: "SUBMITTED",
        new_status: "UNDER_REVIEW",
        actor_user_id: COORDINATOR,
        actor_role: "EVENT_COORDINATOR",
        triggering_action: "OPEN_FOR_REVIEW",
      },
      {
        previous_status: "UNDER_REVIEW",
        new_status: "APPROVED",
        actor_user_id: COORDINATOR,
        actor_role: "EVENT_COORDINATOR",
        triggering_action: "APPROVE",
      },
    ]);
    expect(history.every((entry) => entry.occurred_at !== null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd backend/services/event && npx vitest run tests/api/submission.test.ts tests/api/statusHistory.test.ts`
Expected: FAIL. The resubmission message is still "This request has already been submitted…". The history test may already pass: direct submission records `SUBMIT` today. That's fine; it locks the order and the fields.

- [ ] **Step 3: Let `insertDraft` run inside a transaction — `backend/services/event/src/repo/drafts.ts`**

Change the `postgres` type import to include `ISql`:

```ts
import type { ISql, Sql } from "postgres";
```

and change `jsonOrNull` and `insertDraft`'s first parameter from `Sql` to `ISql`:

```ts
function jsonOrNull(sql: ISql, value: unknown) {
  return value === null || value === undefined ? null : sql.json(value as never);
}

export async function insertDraft(sql: ISql, ownerId: string, fields: DraftFields): Promise<EventRow> {
```

The body of `insertDraft` is unchanged.

- [ ] **Step 4: Replace `backend/services/event/src/api/submitEvent.ts`**

```ts
import type { Sql } from "postgres";
import { EVENT_TOPICS } from "@connectsphere/contracts";
import { config } from "../config.js";
import { allocateCoordinator } from "../domain/assignment.js";
import { submissionColumns, type EventFields, type EventRow } from "../repo/events.js";
import { insertDraft } from "../repo/drafts.js";
import { insertAssignment, saveCursor, takeCursor } from "../repo/assignments.js";
import { writeOutbox } from "../events/outbox.js";
import { transitionEvent } from "./transitionEvent.js";

/**
 * B1 + E1 — submission, whether the request was saved as a draft first (C2) or
 * submitted directly. Everything happens in one transaction: the event, its
 * history entry, the coordinator assignment, and the outbox rows that become
 * notifications. If any part fails none of it happened, and no submission
 * timestamp is recorded (B1's last acceptance criterion).
 *
 * A request comes into existence as a Draft, and the SUBMIT transition is the
 * only way out of Draft (F1) — so a direct submission is inserted as a draft
 * and submitted in the same transaction. The caller has already established
 * that a draft being submitted belongs to the submitting organiser.
 */
export type SubmitResult = { ok: true; event: EventRow } | { ok: false; message: string };

export async function submitEvent(
  sql: Sql,
  params: {
    ownerId: string;
    actorRole: string;
    correlationId: string | null;
  } & ({ draftId: string; fields?: EventFields } | { fields: EventFields })
): Promise<SubmitResult> {
  return sql.begin(async (tx) => {
    const fromDraft = "draftId" in params;
    const draftId = fromDraft
      ? params.draftId
      : (await insertDraft(tx, params.ownerId, params.fields)).id;

    const submitted = await transitionEvent(
      tx,
      draftId,
      "SUBMIT",
      { userId: params.ownerId, role: params.actorRole },
      { set: submissionColumns(tx, fromDraft ? params.fields : undefined) }
    );
    if (!submitted.ok) return { ok: false as const, message: submitted.message };
    const event = submitted.event;

    await writeOutbox(tx, {
      topic: EVENT_TOPICS.submitted,
      messageType: "event.submitted",
      aggregateId: event.id,
      actor: { userId: params.ownerId, role: params.actorRole },
      correlationId: params.correlationId,
      payload: {
        eventId: event.id,
        eventReference: event.reference!,
        eventName: event.name,
        ownerId: event.ownerId,
        proposedStartAt: event.proposedStartAt!,
        proposedEndAt: event.proposedEndAt!,
        submittedAt: event.submittedAt!,
      },
    });

    // E1 — assignment is part of submission, not a separate user action.
    const allocation = allocateCoordinator(config.coordinatorPool, await takeCursor(tx));

    if (!allocation) {
      // E1 — with no eligible coordinator the event is still submitted and is
      // left awaiting assignment rather than refused.
      return { ok: true as const, event };
    }

    const assignment = await insertAssignment(
      tx,
      event.id,
      allocation.coordinatorId,
      allocation.assignmentRule,
      params.ownerId
    );
    await saveCursor(tx, allocation.nextCursor);

    await writeOutbox(tx, {
      topic: EVENT_TOPICS.coordinatorAssigned,
      messageType: "event.coordinator-assigned",
      aggregateId: event.id,
      actor: { userId: null, role: "SYSTEM" },
      correlationId: params.correlationId,
      payload: {
        eventId: event.id,
        eventReference: event.reference!,
        eventName: event.name,
        coordinatorId: assignment.coordinatorId,
        assignmentRule: assignment.assignmentRule,
        assignedAt: assignment.assignedAt,
      },
    });

    return { ok: true as const, event: { ...event, assignedCoordinatorId: assignment.coordinatorId } };
  });
}
```

- [ ] **Step 5: Update the direct-submission handler in `backend/services/event/src/api/events.ts`**

Replace:

```ts
      const event = await submitEvent(sql, {
        ownerId: req.actor!.userId,
        actorRole: req.actor!.role,
        fields: toEventFields(parsed.data),
        correlationId: req.header("x-correlation-id") ?? null,
      });

      res.status(201).json(event);
```

with:

```ts
      const submitted = await submitEvent(sql, {
        ownerId: req.actor!.userId,
        actorRole: req.actor!.role,
        fields: toEventFields(parsed.data),
        correlationId: req.header("x-correlation-id") ?? null,
      });

      if (!submitted.ok) {
        // Unreachable in practice: the draft was created in the same
        // transaction. Answered rather than assumed.
        refuse(res, 409, "STATUS_TRANSITION_NOT_PERMITTED", submitted.message);
        return;
      }

      res.status(201).json(submitted.event);
```

- [ ] **Step 6: Update the draft submit handler in `backend/services/event/src/api/drafts.ts`**

Add to the imports:

```ts
import { evaluateTransition } from "../domain/statusMachine.js";
```

Replace the first refusal (inside `if (existing) { … }`):

```ts
          refuse(
            res,
            409,
            "DRAFT_ALREADY_SUBMITTED",
            "This request has already been submitted and can no longer be edited here."
          );
          return;
```

with:

```ts
          // F1 — name the status the request is in and the one it cannot
          // reach again. The code stays DRAFT_ALREADY_SUBMITTED for the
          // screens and cards that read it (D5-T5).
          const refused = evaluateTransition(existing.status, "SUBMIT");
          refuse(
            res,
            409,
            "DRAFT_ALREADY_SUBMITTED",
            refused.permitted ? "This request can no longer be submitted." : refused.message
          );
          return;
```

and replace the tail of the handler:

```ts
      const event = await submitEvent(sql, {
        ownerId: req.actor!.userId,
        actorRole: req.actor!.role,
        draftId: draft.id,
        fields: sentFields,
        correlationId: req.header("x-correlation-id") ?? null,
      });

      if (!event) {
        refuse(
          res,
          409,
          "DRAFT_ALREADY_SUBMITTED",
          "This request has already been submitted and can no longer be edited here."
        );
        return;
      }

      res.status(201).json(event);
```

with:

```ts
      const submitted = await submitEvent(sql, {
        ownerId: req.actor!.userId,
        actorRole: req.actor!.role,
        draftId: draft.id,
        fields: sentFields,
        correlationId: req.header("x-correlation-id") ?? null,
      });

      if (!submitted.ok) {
        // A concurrent submission of the same draft won the transition.
        refuse(res, 409, "DRAFT_ALREADY_SUBMITTED", submitted.message);
        return;
      }

      res.status(201).json(submitted.event);
```

The `refused.permitted` branch only exists to satisfy the type. `findDraftForOwner` returned nothing, so the request isn't a Draft and the transition is always refused.

- [ ] **Step 7: Run the submission, draft and history tests and confirm they pass**

Run: `cd backend/services/event && npx vitest run tests/api/submission.test.ts tests/api/drafts.test.ts tests/api/statusHistory.test.ts`
Expected: PASS, including the existing `"refuses to submit the same draft twice"` (the code is still `DRAFT_ALREADY_SUBMITTED`).

- [ ] **Step 8: Typecheck, run the whole event suite, and commit**

Run: `npx tsc -p backend/services/event/tsconfig.json --noEmit && npm test -w @connectsphere/event-service`
Expected: no type errors; all tests pass.

```bash
git add backend/services/event/src/repo/drafts.ts backend/services/event/src/api/submitEvent.ts backend/services/event/src/api/events.ts backend/services/event/src/api/drafts.ts backend/services/event/tests/api/submission.test.ts backend/services/event/tests/api/statusHistory.test.ts
git commit -m "refactor(f1): submit through transitionEvent, from Draft only

A direct submission is now inserted as a draft and submitted in the same
transaction, so SUBMIT is the only way into Submitted. Resubmitting keeps
its DRAFT_ALREADY_SUBMITTED code, which D5-T5 reads, but the message now
names both statuses.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Retire the old status writers and guard against new ones (AC2)

**Files:**
- Modify: `backend/services/event/tests/repo/events.test.ts`
- Modify: `backend/services/event/tests/repo/eventHistory.test.ts`
- Modify: `backend/services/event/src/repo/events.ts` (delete five functions)
- Create: `backend/services/event/tests/architecture/statusWrites.test.ts`

- [ ] **Step 1: Write the architecture guard and watch it fail**

`backend/services/event/tests/architecture/statusWrites.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { EVENT_STATUSES } from "@connectsphere/contracts";

/**
 * F1 AC2 — status changes only through a defined action. In code that means
 * one statement writes `event.events.status` (repo/eventStatus.ts, reached
 * through transitionEvent), and a new event starts as a Draft. This test fails
 * if a later change adds another way.
 *
 * It reads SQL written as tagged templates. A status set through a dynamic
 * column list (`${tx(columns)}`) is not visible to it; AMENDABLE_COLUMNS is
 * what keeps status out of the amendable columns.
 */

const SRC = join(__dirname, "../../src");
const THE_ONE_WRITER = join(SRC, "repo/eventStatus.ts");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : [];
  });
}

/** The text of each `update event.events …` / `insert into event.events …` up to the closing backtick. */
function statements(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => match[1] ?? "");
}

/**
 * Only the SET clause counts: `where … status = 'DRAFT'` (repo/drafts.ts)
 * filters on status and must not be mistaken for writing it.
 */
export function updatesSetStatus(source: string): boolean {
  return statements(source, /update\s+event\.events\b([\s\S]*?)`/gi).some((text) => {
    const setClause = /\bset\b([\s\S]*?)(?:\bwhere\b|\bfrom\b|\breturning\b|$)/i.exec(text)?.[1] ?? "";
    return /\bstatus\s*=/.test(setClause);
  });
}

export function insertsPastDraft(source: string): boolean {
  const pastDraft = EVENT_STATUSES.filter((status) => status !== "DRAFT");
  return statements(source, /insert\s+into\s+event\.events\b([\s\S]*?)`/gi).some((text) =>
    pastDraft.some((status) => text.includes(`'${status}'`))
  );
}

describe("status writes (F1)", () => {
  it("recognises a status write and an insert past Draft when it sees them", () => {
    expect(updatesSetStatus("update event.events set status = 'APPROVED' where id = $1`")).toBe(true);
    expect(updatesSetStatus("update event.events set name = $1 where id = $2`")).toBe(false);
    expect(
      updatesSetStatus("update event.events set name = $1 where id = $2 and status = 'DRAFT'`")
    ).toBe(false);
    expect(insertsPastDraft("insert into event.events (status) values ('SUBMITTED')`")).toBe(true);
    expect(insertsPastDraft("insert into event.events (status) values ('DRAFT')`")).toBe(false);
  });

  it("has no statement other than updateStatusIf that sets an event's status", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => file !== THE_ONE_WRITER)
      .filter((file) => updatesSetStatus(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file));

    expect(offenders).toEqual([]);
  });

  it("inserts events at Draft only", () => {
    const offenders = sourceFiles(SRC)
      .filter((file) => insertsPastDraft(readFileSync(file, "utf8")))
      .map((file) => relative(SRC, file));

    expect(offenders).toEqual([]);
  });
});
```

Run: `cd backend/services/event && npx vitest run tests/architecture/statusWrites.test.ts`
Expected: FAIL. The offenders are `repo/events.ts`, which still holds `setStatus`, `claimForReview`, `recordDecision` and `submitDraft`, plus `insertSubmittedEvent`'s `'SUBMITTED'` insert. That's the list this task removes.

- [ ] **Step 2: Move `tests/repo/eventHistory.test.ts` off `insertSubmittedEvent`**

Replace its import of `insertSubmittedEvent` and the `fields` constant, and its `givenAnEvent` helper, with:

```ts
import { seedEvent } from "../support/seedEvent.js";
```

```ts
async function givenAnEvent() {
  return {
    id: await seedEvent(sql, {
      ownerId: OWNER,
      status: "SUBMITTED",
      endsAt: new Date("2026-10-02T18:00:00.000Z"),
      name: "History test",
    }),
  };
}
```

Remove the now-unused `type EventFields` import. Keep the `recordFieldChanges`/`recordStatusChange` import.

- [ ] **Step 3: Move `tests/repo/events.test.ts` off the old writers**

Replace its imports with:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../support/testDb.js";
import { seedEvent } from "../support/seedEvent.js";
import {
  decisionColumns,
  findEventInScope,
  listReviewQueue,
  reviewColumns,
} from "../../src/repo/events.js";
import { transitionEvent } from "../../src/api/transitionEvent.js";
import { QUEUE_STATUSES } from "../../src/domain/statusMachine.js";
```

Delete the `fields` constant. Replace `givenSubmittedEvent` with:

```ts
/** Inserts a submitted event outside any wider workflow, for tests that need one. */
async function givenSubmittedEvent(ownerId = OWNER, name = "Annual Research Symposium") {
  return {
    id: await seedEvent(sql, {
      ownerId,
      status: "SUBMITTED",
      endsAt: new Date("2026-10-02T18:00:00.000Z"),
      name,
    }),
  };
}

function openForReview(eventId: string, coordinatorId: string) {
  return sql.begin((tx) =>
    transitionEvent(
      tx,
      eventId,
      "OPEN_FOR_REVIEW",
      { userId: coordinatorId, role: "EVENT_COORDINATOR" },
      { set: reviewColumns(tx, coordinatorId) }
    )
  );
}

function decide(
  eventId: string,
  action: "APPROVE" | "REJECT",
  coordinatorId: string,
  reason: string | null
) {
  return sql.begin((tx) =>
    transitionEvent(
      tx,
      eventId,
      action,
      { userId: coordinatorId, role: "EVENT_COORDINATOR" },
      { set: decisionColumns(tx, coordinatorId, reason) }
    )
  );
}
```

Update every call of the form `givenSubmittedEvent(OWNER, { name: "X" })` to `givenSubmittedEvent(OWNER, "X")`. Every other `givenSubmittedEvent(…)` call in the file passes an owner id only and is unchanged.

Replace the queue test `"drops an event from the queue once it carries a decision"`, and the two D1 claim tests and three D4/D5 tests at the end of the file, with:

```ts
  it("drops an event from the queue once it carries a decision", async () => {
    const event = await givenSubmittedEvent();
    await openForReview(event.id, COORDINATOR);
    await decide(event.id, "APPROVE", COORDINATOR, null);

    const queue = await listReviewQueue(sql, QUEUE_STATUSES);

    expect(queue.map((row) => row.id)).not.toContain(event.id);
  });

  it("moves a submitted event to under review, recording the reviewer and the time", async () => {
    const event = await givenSubmittedEvent();

    const opened = await openForReview(event.id, COORDINATOR);

    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.event).toMatchObject({ status: "UNDER_REVIEW", reviewingCoordinatorId: COORDINATOR });
    expect(Date.parse(opened.event.reviewStartedAt!)).not.toBeNaN();
  });

  it("does not overwrite the reviewer when a second coordinator opens the same request", async () => {
    const event = await givenSubmittedEvent();
    await openForReview(event.id, COORDINATOR);

    const second = await openForReview(event.id, OTHER_COORDINATOR);

    expect(second.ok).toBe(false);
    const current = await findEventInScope(sql, event.id, { scopeType: "ALL" }, OTHER_COORDINATOR);
    expect(current!.reviewingCoordinatorId).toBe(COORDINATOR);
  });
});

describe("events repo — decisions (D4, D5)", () => {
  it("records an approval with the approving coordinator and the timestamp", async () => {
    const event = await givenSubmittedEvent();
    await openForReview(event.id, COORDINATOR);

    const decided = await decide(event.id, "APPROVE", COORDINATOR, null);

    expect(decided.ok).toBe(true);
    if (!decided.ok) return;
    expect(decided.event).toMatchObject({ status: "APPROVED", decidedBy: COORDINATOR });
    expect(Date.parse(decided.event.decidedAt!)).not.toBeNaN();
  });

  it("records a rejection with its reason", async () => {
    const event = await givenSubmittedEvent();
    await openForReview(event.id, COORDINATOR);

    const decided = await decide(event.id, "REJECT", COORDINATOR, "No venue can host this date.");

    expect(decided.ok && decided.event).toMatchObject({
      status: "REJECTED",
      rejectionReason: "No venue can host this date.",
    });
  });

  it("writes no second decision timestamp for an event already decided", async () => {
    const event = await givenSubmittedEvent();
    await openForReview(event.id, COORDINATOR);
    await decide(event.id, "APPROVE", COORDINATOR, null);
    const afterFirst = await findEventInScope(sql, event.id, { scopeType: "ALL" }, COORDINATOR);

    const second = await decide(event.id, "REJECT", OTHER_COORDINATOR, "Changed my mind");

    expect(second.ok).toBe(false);
    const unchanged = await findEventInScope(sql, event.id, { scopeType: "ALL" }, COORDINATOR);
    expect(unchanged).toMatchObject({
      status: "APPROVED",
      decidedBy: COORDINATOR,
      decidedAt: afterFirst!.decidedAt,
    });
  });
});
```

(The replaced block starts at the queue test and runs to the end of the file. The `describe("events repo — review queue (D1)"` opener and its first test, `"orders the queue by submission timestamp, oldest first"`, stay as they are, with only the `givenSubmittedEvent` call updated.)

Run: `cd backend/services/event && npx vitest run tests/repo`
Expected: PASS.

- [ ] **Step 4: Delete the old writers from `backend/services/event/src/repo/events.ts`**

Delete these functions and their doc comments entirely: `insertSubmittedEvent`, `submitDraft`, `claimForReview`, `lockEventInScope`, `setStatus`, `recordDecision`. Keep `jsonOrNull`, which `submissionColumns` uses.

- [ ] **Step 5: Run the guard, typecheck, and run the whole event suite**

Run: `cd backend/services/event && npx vitest run tests/architecture/statusWrites.test.ts`
Expected: PASS.

Run: `npx tsc -p backend/services/event/tsconfig.json --noEmit && npm test -w @connectsphere/event-service`
Expected: no type errors (nothing imports the deleted functions any more); all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/services/event/src/repo/events.ts backend/services/event/tests/repo backend/services/event/tests/architecture
git commit -m "refactor(f1): retire the old status writers and guard against new ones

setStatus accepted any status with no guard; it and the per-story
writers are gone. An architecture test now fails if any statement other
than updateStatusIf sets an event's status, or an event is inserted past
Draft, which keeps AC2 true after F1 merges.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: The completion sweep (AC6)

**Files:**
- Create: `backend/services/event/src/jobs/completeEvents.ts`
- Create: `backend/services/event/tests/jobs/completeEvents.test.ts`
- Create: `backend/services/event/tests/jobs/completeEventsIsolation.test.ts`

- [ ] **Step 1: Write the failing tests**

`backend/services/event/tests/jobs/completeEvents.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../support/testDb.js";
import { seedEvent } from "../support/seedEvent.js";
import { completeDueEvents } from "../../src/jobs/completeEvents.js";

/**
 * F1 AC6 — the completion sweep. The database is shared, so the sweep may also
 * complete other due Confirmed events; assertions look only at this file's.
 */

const sql = testDb();

const OWNER = "af333333-0000-0000-0000-000000000001";
const NOW = new Date("2029-06-01T12:00:00.000Z");
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

async function cleanUp() {
  await sql`delete from event.event_history where event_id in (
    select id from event.events where owner_id = ${OWNER}
  )`;
  await sql`delete from event.events where owner_id = ${OWNER}`;
}

async function statusOf(id: string) {
  const rows = await sql<{ status: string }[]>`select status from event.events where id = ${id}`;
  return rows[0]!.status;
}

async function completionsOf(id: string) {
  const rows = await sql<{ n: number }[]>`
    select count(*)::int as n from event.event_history
    where event_id = ${id} and triggering_action = 'COMPLETE'
  `;
  return rows[0]!.n;
}

beforeEach(cleanUp);

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("completeDueEvents (F1)", () => {
  it("completes a Confirmed event whose end has passed, as a system change", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: at(-60_000) });

    const run = await completeDueEvents(sql, NOW);

    expect(run.completed).toContain(id);
    expect(await statusOf(id)).toBe("COMPLETED");
    const history = await sql`
      select previous_status, new_status, actor_user_id, actor_role, triggering_action
      from event.event_history where event_id = ${id}
    `;
    expect(history).toEqual([
      {
        previous_status: "CONFIRMED",
        new_status: "COMPLETED",
        actor_user_id: null,
        actor_role: "SYSTEM",
        triggering_action: "COMPLETE",
      },
    ]);
  });

  it("completes an event at exactly its end instant", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: at(0) });

    expect((await completeDueEvents(sql, NOW)).completed).toContain(id);
  });

  it("completes an event that ended one millisecond earlier", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: at(-1) });

    expect((await completeDueEvents(sql, NOW)).completed).toContain(id);
  });

  it("leaves an event that ends one millisecond later Confirmed", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: at(1) });

    const run = await completeDueEvents(sql, NOW);

    expect(run.completed).not.toContain(id);
    expect(await statusOf(id)).toBe("CONFIRMED");
    expect(await completionsOf(id)).toBe(0);
  });

  it("leaves an Approved event whose end has passed Approved", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "APPROVED", endsAt: at(-60_000) });

    const run = await completeDueEvents(sql, NOW);

    expect(run.completed).not.toContain(id);
    expect(await statusOf(id)).toBe("APPROVED");
  });

  it("completes an event once when run twice", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: at(-60_000) });

    await completeDueEvents(sql, NOW);
    const second = await completeDueEvents(sql, NOW);

    expect(second.completed).not.toContain(id);
    expect(await completionsOf(id)).toBe(1);
  });

  it("completes an event once when two runs race", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: at(-60_000) });

    const runs = await Promise.all([completeDueEvents(sql, NOW), completeDueEvents(sql, NOW)]);

    expect(runs.flatMap((run) => run.completed).filter((completed) => completed === id)).toHaveLength(1);
    expect(runs.flatMap((run) => run.failed).map((failure) => failure.id)).not.toContain(id);
    expect(await completionsOf(id)).toBe(1);
  });
});
```

`backend/services/event/tests/jobs/completeEventsIsolation.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { testDb } from "../support/testDb.js";
import { seedEvent } from "../support/seedEvent.js";

/** F1 — one event's failure does not stop the sweep completing the others. */

const failing = vi.hoisted(() => ({ id: "" }));

vi.mock("../../src/api/transitionEvent.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/api/transitionEvent.js")>(
    "../../src/api/transitionEvent.js"
  );
  const transitionEvent: typeof actual.transitionEvent = async (tx, eventId, ...rest) => {
    if (eventId === failing.id) throw new Error("simulated failure");
    return actual.transitionEvent(tx, eventId, ...rest);
  };
  return { ...actual, transitionEvent };
});

const { completeDueEvents } = await import("../../src/jobs/completeEvents.js");

const sql = testDb();

const OWNER = "af444444-0000-0000-0000-000000000001";
const NOW = new Date("2029-06-01T12:00:00.000Z");

async function cleanUp() {
  await sql`delete from event.event_history where event_id in (
    select id from event.events where owner_id = ${OWNER}
  )`;
  await sql`delete from event.events where owner_id = ${OWNER}`;
}

beforeEach(cleanUp);

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

describe("completeDueEvents isolation (F1)", () => {
  it("records a failed event and still completes the rest, each in its own transaction", async () => {
    const endsAt = new Date(NOW.getTime() - 60_000);
    const broken = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt });
    const fine = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt });
    failing.id = broken;

    const run = await completeDueEvents(sql, NOW);

    expect(run.failed).toContainEqual({ id: broken, error: "simulated failure" });
    expect(run.completed).toContain(fine);
    const rows = await sql<{ id: string; status: string }[]>`
      select id, status from event.events where id in ${sql([broken, fine])}
    `;
    expect(Object.fromEntries(rows.map((row) => [row.id, row.status]))).toEqual({
      [broken]: "CONFIRMED",
      [fine]: "COMPLETED",
    });
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd backend/services/event && npx vitest run tests/jobs`
Expected: FAIL. Cannot find module `../../src/jobs/completeEvents.js`.

- [ ] **Step 3: Create `backend/services/event/src/jobs/completeEvents.ts`**

```ts
import type { Sql } from "postgres";
import { listDueForCompletion } from "../repo/eventStatus.js";
import { SYSTEM_ACTOR, transitionEvent } from "../api/transitionEvent.js";

/**
 * F1 AC6 — move every Confirmed event whose end has passed to Completed.
 *
 * The rule belongs to the event service; what triggers it does not. Until the
 * Scheduled Job Runner exists (plan.md §4), `npm run jobs:complete-events`
 * calls this directly; the scheduler will call the same function.
 *
 * Each event is completed in its own transaction, so one failure does not undo
 * the others. The sweep is idempotent: a second run finds nothing, and when
 * two runs race, the transition lets only one complete each event — the other
 * is refused and reported as skipped, not failed.
 */
export interface CompletionRun {
  completed: string[];
  skipped: string[];
  failed: { id: string; error: string }[];
}

export async function completeDueEvents(sql: Sql, now: Date): Promise<CompletionRun> {
  const run: CompletionRun = { completed: [], skipped: [], failed: [] };

  for (const id of await listDueForCompletion(sql, now)) {
    try {
      const outcome = await sql.begin((tx) =>
        transitionEvent(tx, id, "COMPLETE", SYSTEM_ACTOR, { now })
      );
      (outcome.ok ? run.completed : run.skipped).push(id);
    } catch (error) {
      run.failed.push({ id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return run;
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd backend/services/event && npx vitest run tests/jobs`
Expected: PASS, 8 tests.

- [ ] **Step 5: Run the architecture guard, typecheck, and commit**

Run: `cd backend/services/event && npx vitest run tests/architecture && cd ../../.. && npx tsc -p backend/services/event/tsconfig.json --noEmit`
Expected: PASS; no type errors. The sweep writes status only through `transitionEvent`.

```bash
git add backend/services/event/src/jobs/completeEvents.ts backend/services/event/tests/jobs
git commit -m "feat(f1): complete Confirmed events once their end has passed

The rule lives in the event service and is triggered from outside it.
Each event completes in its own transaction; a second or concurrent run
completes nothing twice.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: `npm run jobs:complete-events`

**Files:**
- Create: `backend/services/event/src/jobs/runCompleteEvents.ts`
- Modify: `package.json` (root, `scripts`)

- [ ] **Step 1: Create the entry point**

`backend/services/event/src/jobs/runCompleteEvents.ts`:

```ts
import { randomUUID } from "node:crypto";
import { sql } from "../db.js";
import { logger } from "../logger.js";
import { completeDueEvents } from "./completeEvents.js";

/**
 * `npm run jobs:complete-events` — runs the F1 completion sweep once, logs a
 * line per event and a summary (implementation.md §9), and exits non-zero if
 * any event could not be completed. The scheduler replaces this trigger when
 * it exists; the sweep itself does not change.
 */
async function main() {
  const correlationId = randomUUID();
  const route = "job complete-events";
  const started = Date.now();

  try {
    const run = await completeDueEvents(sql, new Date());

    for (const eventId of run.completed) {
      logger.info("event completed", { correlationId, userId: null, route, outcome: "success", code: null, eventId });
    }
    for (const eventId of run.skipped) {
      logger.info("event had already moved on; not completed", {
        correlationId,
        userId: null,
        route,
        outcome: "refused",
        code: "STATUS_TRANSITION_NOT_PERMITTED",
        eventId,
      });
    }
    for (const failure of run.failed) {
      logger.error("event could not be completed", {
        correlationId,
        userId: null,
        route,
        outcome: "error",
        code: null,
        eventId: failure.id,
        error: failure.error,
      });
    }

    logger.info("completion sweep finished", {
      correlationId,
      userId: null,
      route,
      durationMs: Date.now() - started,
      outcome: run.failed.length > 0 ? "error" : "success",
      code: null,
      completed: run.completed.length,
      skipped: run.skipped.length,
      failed: run.failed.length,
    });

    process.exitCode = run.failed.length > 0 ? 1 : 0;
  } finally {
    await sql.end();
  }
}

await main();
```

- [ ] **Step 2: Add the script to the root `package.json`**

In `scripts`, after `"test-cases:run"`, add:

```json
    "jobs:complete-events": "tsx --env-file=.env backend/services/event/src/jobs/runCompleteEvents.ts",
```

- [ ] **Step 3: Run it**

Run (from the repo root): `npm run jobs:complete-events`
Expected: exit code 0, and a final JSON line `"message":"completion sweep finished"` with `"completed":0` (nothing in the shared database should be Confirmed yet), `"failed":0`, and a `correlationId`.

If `tsc` rejects the top-level `await main();` under this package's settings, replace it with `void main();`.

- [ ] **Step 4: Build to prove the entry point compiles**

Run: `npm run build -w @connectsphere/event-service`
Expected: exit 0, with `backend/services/event/dist/jobs/runCompleteEvents.js` created.

- [ ] **Step 5: Commit**

```bash
git add backend/services/event/src/jobs/runCompleteEvents.ts package.json
git commit -m "feat(f1): run the completion sweep with npm run jobs:complete-events

Until the Scheduled Job Runner exists, a script triggers the sweep the
same way migrate and test-cases:reset already work, without inventing
the service-to-service auth an HTTP trigger would need.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Trace, run the cards, record, push, and open the PR

**Files:**
- Modify: `documentation/traceability/sprint-2.csv`
- Modify: `documentation/superpowers/specs/2026-09-30-f1-status-lifecycle-design.md`
- Modify: `tests/F1/*.md` (execution records)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add F1's four missing traceability rows**

Append to `documentation/traceability/sprint-2.csv`:

```csv
F1,"The permitted statuses are exactly: Draft, Submitted, Under Review, Awaiting Clarification, Approved, Planning, Confirmed, Completed, Cancelled, Rejected",backend/services/event/tests/domain/statuses.test.ts,"are exactly the ten the story names"
F1,"Status can only be changed by an action defined in another story; there is no screen that lets a user type or pick an arbitrary status",backend/services/event/tests/architecture/statusWrites.test.ts,"has no statement other than updateStatusIf that sets an event's status"
F1,"An event reaches Confirmed only through the confirmation action specified in F5; reaching it writes a history entry like any other transition",backend/services/event/tests/domain/statusMachine.test.ts,"reaches Confirmed from Approved or Planning (F1, performed by F5)"
F1,"An event moves to Completed only after its recorded end date/time has passed",backend/services/event/tests/jobs/completeEvents.test.ts,"leaves an event that ends one millisecond later Confirmed"
```

- [ ] **Step 2: Record the planning refinements in the spec**

Append to `documentation/superpowers/specs/2026-09-30-f1-status-lifecycle-design.md`:

```markdown
## 6. Refinements made while planning

- **The completion time guard is enforced by the transition**, not only by the sweep's selection,
  because AC6 says *only* after the end: `transitionEvent(…, "COMPLETE")` refuses early completion
  whoever calls it. The rule is written once, as `endHasPassed()` in `repo/eventStatus.ts`; the pure
  `isDueForCompletion()` of §3.1 was not needed and was not built.
- **Placement:** the conditional statement is `updateStatusIf()` in `src/repo/eventStatus.ts`;
  `transitionEvent()` is in `src/api/transitionEvent.ts`, beside `submitEvent.ts`.
- **Codes kept:** resubmission keeps `409 DRAFT_ALREADY_SUBMITTED` (D5-T5 reads it) with a message
  that now names both statuses. The race-loser decision refusal is now
  `STATUS_TRANSITION_NOT_PERMITTED`; `EVENT_ALREADY_DECIDED` is no longer emitted but stays in
  contracts.
- **The sweep reports `skipped` as well as `completed` and `failed`**: a refusal lost to a concurrent
  run is not a failure.
```

- [ ] **Step 3: Run the full verification**

Run (from the repo root): `npm test`
Expected: exit 0 across every workspace. On an event-service failure, re-run once before debugging (shared-database contention).

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Execute the F1 cards and record the results**

Run each card from `tests/F1/` exactly as written, after `npm run test-cases:reset`. Fill in each execution record: Actual Result, Status, Remarks with the commit SHA from `git rev-parse --short HEAD`, Executed By, and Date of Execution. F1-T7 stays Not Executed (it awaits F5). A Fail means a defect: fix it and re-run, don't edit the expected result.

- [ ] **Step 5: Add the CHANGELOG entry**

Insert directly below the header's `---` in `CHANGELOG.md` (newest first):

```markdown
# F1 — event status lifecycle: one guarded write path, Confirm and Complete

**Timestamp:** <ISO timestamp, SGT>
**Author:** Raphael, via Claude
**Scope:** F1 (and the D1–D5, B1, C2 code paths it routes through)
**Reason:** Sprint 1 built the transition rule its own stories needed, but only four of six
transitions consulted it, `setStatus()` accepted any status unguarded, and nothing completed an
event. F1's ACs need the table to be the only way status changes, Confirmed to be reachable, and
Completed to follow the recorded end.

## Added

- **`transitionEvent()`** — the one way status changes: one conditional statement, the history
  entry, and on refusal nothing stored and both statuses named.
- **`CONFIRM`** (Approved/Planning → Confirmed; F5 performs it) and **`COMPLETE`** (Confirmed →
  Completed, only once the end has passed, enforced by the transition itself).
- **The completion sweep** and **`npm run jobs:complete-events`** to trigger it until the Scheduled
  Job Runner exists.
- **An architecture test** that fails if any other statement sets an event's status.
- **`tests/F1/`** — eleven cards written from the ACs before any code, and **FX-SEEDED** in
  `tests/README.md`.

## Changed

- Submit, open-for-review, clarify, respond, approve and reject all go through `transitionEvent`.
  A direct submission is now inserted as a draft and submitted in the same transaction.
- Resubmitting keeps `409 DRAFT_ALREADY_SUBMITTED` but names both statuses. A decision lost to a
  concurrent one is now `STATUS_TRANSITION_NOT_PERMITTED`; `EVENT_ALREADY_DECIDED` is no longer
  emitted.
- New history rows record `SUBMIT` for both submission routes (previously `SUBMIT_FROM_DRAFT` for
  drafts). Existing rows are unchanged.

## Removed

- `setStatus`, `claimForReview`, `recordDecision`, `submitDraft`, `insertSubmittedEvent`,
  `lockEventInScope` from the event repo.

## Decided, and raised

- **§11.12 was waived for F1.** The team decided on 2026-09-30 that the cards are not confirmed by a
  second person before code is written, and dropped the agent pre-review. The human check moved to
  merge time: `main` requires an approving PR review, and the reviewer checks each card's expected
  result against its AC. `implementation.md` §11.12 still states the before-code rule; amending it
  for the whole team is a separate, reviewed change.

- **Only Confirmed events complete** — a gap in AC6, decided by Raphael on 2026-09-30. The Sprint 2
  Product Owner, when named, should see it.
- **No story moves an event into Planning.** Raised with the team; F1 does not invent the action.
- **Until F5 ships, nothing reaches Confirmed**, so AC6 is demonstrated against seeded events.

## Verified

- `npm test` and `npm run build` pass. F1 cards executed against <SHA>: <n> Pass, F1-T7 Not
  Executed (awaits F5).
```

Fill in the placeholders in angle brackets from the actual run. They are record-keeping values that only exist once Steps 3–4 have been done.

- [ ] **Step 6: Commit and push**

```bash
git add documentation/traceability/sprint-2.csv documentation/superpowers/specs/2026-09-30-f1-status-lifecycle-design.md tests/F1 CHANGELOG.md
git commit -m "docs(f1): trace F1's criteria, record the card runs and the change

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin feature-raphael/f1-status-lifecycle
```

- [ ] **Step 7: Open the PR**

Open a PR from `feature-raphael/f1-status-lifecycle` to `main` and ask for a peer review (§8.3). `main` requires an approving review before merge. **The reviewer's job includes the check §11.12 used to do before the code:** read each `tests/F1/` card's Expected Result next to its acceptance criterion and confirm it is what the story requires. Say so at the top of the PR body. The body then lists the six ACs with the test covering each, the three behaviour changes (resubmission message, race-loser code, `SUBMIT` history action), the "Decided, and raised" items, and ends with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Self-Review

**Spec coverage.** §3.1 table → Task 2. §3.2 `transitionEvent`, `extra`, retired functions, direct submission → Tasks 3, 4, 8, 9. §3.3 sweep, per-event transactions, idempotence, script, logging → Tasks 10, 11. §4.1 cards, FX fixture → Task 1; the before-code confirmation and agent pre-review were waived by the team, and the check moved to the PR review → Task 12. §4.2 unit, integration, concurrency, architecture guard, regression, traceability → Tasks 2–10, 12. §5 raised items → CHANGELOG in Task 12. Decision 2 (only Confirmed) → Tasks 2, 4, 10 and card F1-T10.

**Placeholders.** The only angle-bracket values are in Task 12's CHANGELOG entry. They record facts (a SHA, counts, a timestamp) that only exist once the preceding steps have run, and the steps say so.

**Type consistency.** `Fragment` is defined in `repo/eventStatus.ts` and used by `repo/events.ts` and `api/transitionEvent.ts`. `StatusUpdate { eventId, from, to, actorId, set?, onlyIf? }` matches every `updateStatusIf` call. `transitionEvent(tx, eventId, action, actor, { set?, now? })` matches every call in Tasks 4–10. `TransitionOutcome` is `{ ok: true; event; previousStatus } | { ok: false; currentStatus; message }`, and callers read `.ok`, `.event` and `.message` only. `SubmitResult` is `{ ok: true; event } | { ok: false; message }`, and both handlers read the same. `CompletionRun { completed, skipped, failed }` is used identically in Tasks 10 and 11.
