# F1 — Event status lifecycle design

**Date:** 2026-09-30
**Story:** F1 — Trust that an event's status reflects what has actually happened (Sprint 2)
**Owner:** Raphael
**Status:** approved in brainstorming, awaiting written-spec review

---

## 1. Where F1 starts from

Sprint 1 built the state machine B1 and D1–D5 needed (`plan.md` §9.1: "what Sprint 1 produced is
the transition rule its own stories needed"). Against each acceptance criterion:

| AC | Today | What F1 adds |
|---|---|---|
| 1. The ten permitted statuses | Done: `EVENT_STATUSES` in contracts, `check` on `event.events.status` | Tests that prove it |
| 2. Status changes only through a defined action; no screen picks a status | No endpoint or screen accepts a status, but `repo/events.ts` `setStatus()` writes any status unguarded | One write path, and a test that keeps it the only one |
| 3. A refused transition stores nothing and names current + target | Clarify, respond, approve and reject use the table | Submit and open-for-review use it too; submit's refusal currently names neither status |
| 4. Every change writes a full history entry | Done for the six existing transitions | Written by the one write path, so no caller can forget it |
| 5. Confirmed is permitted; reaching it writes history | Status exists; no transition reaches it | A `CONFIRM` row in the table. F5 (Sprint 4) adds the action and its readiness gates |
| 6. Completed only after the recorded end has passed | Nothing | A `COMPLETE` row, the due-date rule, and a completion sweep |

F1 needs **no change to `/backend/packages/contracts`**. The statuses, the `SYSTEM` actor role
(`implementation.md` §3.3) and the `STATUS_TRANSITION_NOT_PERMITTED` error code all exist already.

## 2. Decisions taken in brainstorming

1. **The event service owns the completion rule; the trigger is thin.** The plan's Scheduled Job
   Runner (`plan.md` §4) does not exist yet. F1 does not build it.
2. **Only Confirmed events complete.** An Approved or Planning event whose end has passed was never
   given a confirmed venue (F5), so it did not happen, and marking it Completed would contradict
   F1's own user story. It stays where it is; a coordinator cancels it through F3. *This fills a
   gap in AC6, which says when an event completes but not from which status. Confirmed by Raphael
   on 2026-09-30. He was Sprint 1's Product Owner; the Sprint 2 Product Owner is still an open
   retrospective action, so whoever takes that role should see this decision.*
3. **The trigger is a script now, an endpoint later.** No code implements the service-to-service
   token in `implementation.md` §6 (`INTERNAL_TOKEN_SECRET` is read nowhere), and F1 should not set
   that team-wide convention. `npm run jobs:complete-events` calls the sweep directly, as
   `migrate` and `test-cases:reset` already do.
4. **One guarded transition function is the only writer of `status`** (option A of three; the
   minimal change and a database trigger were rejected: the first leaves AC2/AC3 to review
   discipline, the second duplicates the rules in SQL and cannot see the actor).

## 3. Design

### 3.1 The transition table — `src/domain/statusMachine.ts`

Two rows are added; the existing six are unchanged.

| Action | From | To | Called by |
|---|---|---|---|
| `SUBMIT` | Draft | Submitted | B1, C2 |
| `OPEN_FOR_REVIEW` | Submitted | Under Review | D1 |
| `REQUEST_CLARIFICATION` | Under Review | Awaiting Clarification | D2 |
| `RESPOND_TO_CLARIFICATION` | Awaiting Clarification | Under Review | D3 |
| `APPROVE` | Under Review, Awaiting Clarification | Approved | D4 |
| `REJECT` | Under Review, Awaiting Clarification | Rejected | D5 |
| **`CONFIRM`** | **Approved, Planning** | **Confirmed** | **F5 (Sprint 4)** |
| **`COMPLETE`** | **Confirmed** | **Completed** | **the completion sweep** |

`evaluateTransition(current, action)` keeps its signature and its refusal message:
*"This event is {current} and cannot move to {target}."*

A pure `isDueForCompletion(endsAt, now)` returns `endsAt <= now`. At exactly the end instant the
event counts as ended, following the half-open `'[)'` convention of `implementation.md` §4.4: the
end instant is not part of the event. The only recorded end is `proposed_end_at`.

### 3.2 The one write path — `transitionEvent`

```ts
transitionEvent(
  tx, eventId, action,
  actor: { userId: string | null; role: string },
  extra?: Record<string, unknown>   // columns the action sets in the same statement
): Promise<{ ok: true; event: EventRow } | { ok: false; message: string }>
```

In the caller's transaction it:

1. Runs one conditional statement:
   `update event.events set status = <to>, <extra>, updated_at = now(), updated_by = <actor>
   where id = $id and status = any(<from>) returning *`. The `where` clause is the guard, so two
   concurrent approvals cannot both succeed. This is the per-aggregate linearizability of §4.5,
   obtained from the shape of the statement, not from a read-then-write.
2. If no row changed, reads the current status and returns the refusal message. Nothing is stored.
3. If a row changed, inserts the `STATUS_CHANGE` history row: previous status, new status,
   `actor_user_id`, `actor_role`, the action name as `triggering_action`, `occurred_at`.

Scope (A3) stays the caller's job: callers find or lock the event in scope first, and answer `404`
when it is outside it, exactly as today.

`extra` exists because some actions set other columns in the same statement, and splitting them
into a second statement would reopen the window the conditional update closes:

| Action | `extra` |
|---|---|
| `SUBMIT` | `reference`, `submitted_at`, and any fields sent with the submission. Required by the `submitted_requests_are_referenced` check: nothing past Draft may lack them. |
| `OPEN_FOR_REVIEW` | `reviewing_coordinator_id`, `review_started_at` |
| `APPROVE`, `REJECT` | `decided_by`, `decided_at`, and `rejection_reason` for a rejection |

`setStatus()`, `recordDecision()` and `claimForReview()` are removed; their callers use
`transitionEvent`. Their extra guards are implied by the from-list, so nothing is lost:
`decided_at is null` holds exactly while the status is Under Review or Awaiting Clarification, and
`reviewing_coordinator_id is null` holds exactly while it is Submitted.

**Direct submission** (B1 without a draft) inserts the row at Draft and applies `SUBMIT` in the same
transaction, so there is no way into Submitted except the transition. New history rows therefore
record `SUBMIT` for both routes, where today they record `SUBMIT` or `SUBMIT_FROM_DRAFT`. No
acceptance criterion distinguishes the two; existing rows are not rewritten.

### 3.3 The completion sweep — `src/jobs/completeEvents.ts`

`completeDueEvents(sql, now)`:

1. Selects the ids of events with status Confirmed and `proposed_end_at <= now`.
2. For each, in **its own transaction**, calls `transitionEvent(tx, id, "COMPLETE",
   { userId: null, role: "SYSTEM" })`. One failure does not roll back the others.
3. Returns `{ completed: string[]; failed: { id: string; error: string }[] }`.

`now` is a parameter so that tests can place it exactly at the boundary.

The sweep is idempotent by construction: a second run finds nothing, because completed events are
no longer Confirmed. Two concurrent runs are also safe: the conditional update lets only one
complete each event, and the other's refusal is logged as a skip, not a failure.

`npm run jobs:complete-events` (root `package.json`) runs the file's entry point: it connects with
the service's configuration, calls `completeDueEvents(sql, new Date())`, logs one line per event
and a summary in the `implementation.md` §9 format with a `correlationId` generated for the run,
and exits non-zero if any event failed.

**Limit to state in the sprint review:** nothing can reach Confirmed until F5 ships in Sprint 4.
Until then AC6 is demonstrated against a Confirmed event seeded by SQL. The rule is built and
tested; no user journey exercises it yet.

## 4. Testing

**The functional cards are written first, from the ACs alone, before any code.**

`implementation.md` §11.12 also requires the story owner to confirm every expected result before
code is written against it. **The team waived that confirmation for F1 on 2026-09-30**, along with
the optional agent pre-review, and moved the human check to merge time: `main` requires an
approving PR review, and the reviewer checks each card's expected result against its AC. The cost,
recorded so the choice is visible: a reviewer who has already seen the code tends to read the tests
through it, which is the blind spot §11.12 guards against. §11.12 still states the before-code rule
for everyone else; amending it is a separate, reviewed change to `implementation.md`. The owner
remains accountable for the trace (§11 rule 10).

### 4.1 Functional cards — `tests/F1/`

| ID | AC | Category | Scenario |
|---|---|---|---|
| F1-T1 | 1 | Negative | The database refuses a status outside the ten (SQL editor, `ARCHIVED`) |
| F1-T2 | 2 | Cross-cutting | No screen offers a way to set status; it is a read-only lozenge for organiser and coordinator |
| F1-T3 | 2 | Negative | A `status` sent in a draft `PUT` body is ignored; the status is unchanged |
| F1-T4 | 3 | Negative | Approving a Rejected event: `409`, "This event is Rejected and cannot move to Approved.", no status change, no history row |
| F1-T5 | 3 | Negative | Submitting an already-submitted request: the refusal names the current status and Submitted |
| F1-T6 | 4 | Happy path | After FX-APPROVED, history holds three rows, each with previous, new, actor, role, timestamp and action |
| F1-T7 | 5 | Happy path | Confirming writes a history row — `Not Executed` until F5; automated test only |
| F1-T8 | 6 | Happy path | A seeded Confirmed event that ended one minute ago becomes Completed, with a `SYSTEM` / `COMPLETE` history row |
| F1-T9 | 6 | Boundary — just below | A seeded Confirmed event ending one minute from now stays Confirmed |
| F1-T10 | 6 | Negative | A seeded Approved event whose end has passed stays Approved (decision 2) |
| F1-T11 | 6 | Negative | Running the job twice completes the event once and writes one history row |

The exactly-at boundary cannot be hit reliably by hand; the automated tests cover it with an
injected `now`.

F1-T5, run while the event is still Submitted, reads "This event is Submitted and cannot move to
Submitted." That is what AC3 prescribes; it is accepted as written rather than special-cased.

**New fixture — FX-CONFIRMED:** a SQL block in `tests/README.md` that inserts a Confirmed event
owned by `organiser@connectsphere.test`, with the end time the case gives. The existing reset
already removes every request owned by the seeded organisers, so it cleans up too.

### 4.2 Automated tests, in the same PR (§11.8)

- **Unit — `tests/domain/statusMachine.test.ts`:** every table row permitted and refused, and
  `isDueForCompletion` at one millisecond before, exactly at, and one millisecond after the end:
  100% of the domain code (§8.1).
- **Integration — against the hosted Postgres:** each AC through the API; the sweep with an
  injected `now`; idempotence; two concurrent approvals of one event, exactly one of which wins.
- **Architecture guard:** a test that fails if any `update event.events` statement under `src`
  other than the one in `transitionEvent` sets `status`, or any `insert into event.events` sets a
  status other than `'DRAFT'`. Inserting a new draft (C1, and direct submission's first step) is
  the one legitimate way a status comes into existence; every other value is reached by a
  transition. The `status` columns of other tables (clarifications, reassignment proposals) are
  not event statuses and are out of its scope. This keeps AC2 true after F1 merges.
- **Regression:** the existing event-service suite (173 tests) stays green through the refactor.
- **Traceability:** one row per AC in `documentation/traceability/sprint-2.csv`. Two exist; four
  are added.

## 5. Out of scope, raised with the team

- **No story moves an event into Planning.** Planning is a permitted status and F5 confirms from
  Approved or Planning, but no story defines the action that reaches it. F1 does not invent one;
  the gap goes to the Product Owner.
- **F2's history view.** `plan.md` §9.1 mentions "its history view" alongside F1, but viewing history
  is F2's acceptance criteria.
- **The Scheduled Job Runner, and the internal-token auth it will need** (decision 3).
- **An `event.completed` message.** No story consumes completion; F3 only refuses to cancel a
  Completed event. It is added, with its contract, when a consumer needs it.
- **Merge risk.** The refactor touches `decisions.ts`, `clarifications.ts`, `submitEvent.ts` and
  `events.ts` in the event service. Check with the team for open work in those files before
  starting.
