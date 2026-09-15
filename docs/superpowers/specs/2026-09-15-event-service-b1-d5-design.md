# Event Service — B1 to D5 design

**Date:** 2026-09-15
**Stories:** B1, B2, C1, C2, C3, D1, D2, D3, D4, D5 (focus: D4, D5). E1 is stubbed.
**Owner:** Seann
**Status:** approved, in implementation

---

## 1. Scope

Build `services/event` end to end: draft save and resume, submission with validation, the
coordinator review queue, clarification request and response, and approve/reject.

| Story | Delivered by |
|---|---|
| B1 Create and submit an event request | `POST /api/v1/events` |
| B2 Validate before submission | `domain/validation.ts`, applied by both submit paths |
| C1 Save an incomplete draft | `POST /api/v1/event-drafts` |
| C2 Resume, edit and submit a draft | `GET/PUT /api/v1/event-drafts/:id`, `POST /api/v1/event-drafts/:id/submit` |
| C3 Tell drafts apart from submitted requests | `GET /api/v1/events?kind=` (drafts and events in one list) |
| D1 Review the queue | `GET /api/v1/events/queue`, `GET /api/v1/events/:id` |
| D2 Request clarification | `POST /api/v1/events/:id/clarifications` |
| D3 Respond to a clarification | `POST /api/v1/events/:id/clarifications/respond` |
| D4 Approve an event request | `POST /api/v1/events/:id/approve` |
| D5 Reject an event request | `POST /api/v1/events/:id/reject` |

**Out of scope:** E2, F3, F4, F5, G1, G2, S1–S3, attachments, the live Kafka relay, and the
Notification service's own consumer. F1 and F2 are touched only insofar as every transition in
these ten stories writes a `status_history` row through one state machine.

## 2. Decisions

### 2.1 One table: a draft is an event at status Draft

Drafts and events are the same table. A draft is an `event.events` row at status `DRAFT`, and
submitting it updates that row in place — it keeps its id, its history, and everything already
entered, and gains a reference and a submission timestamp. This is what F1's status list already
implies by naming Draft as one of the ten statuses.

*(Superseded: the first cut of this service used a separate `event_drafts` table, per `plan.md`
§4's table list. Migration `0002_merge_drafts_into_events.sql` merges them. The two-table version
had to copy a draft into a new `events` row on submission, which meant the submitted event had a
different id from the draft the organiser had been working on, and C3's combined list needed a
`union all`. Neither bought anything the stories asked for.)*

Three consequences worth knowing:

- **The columns a submission needs are nullable**, because a draft may leave every field but its
  name empty (C1). What makes them mandatory is B2, applied at submission. A check constraint
  holds the line at the table level: anything past Draft has a reference and a submission time.
- **`ends_after_start` and `attendance_positive` are conditional on the status**, because C1 says
  the B2 rules are not applied on save — a draft may legitimately hold an attendance of zero.
- **Access scope now has to exclude other people's drafts.** With drafts in the events table, the
  coordinator scope (`ALL`) would otherwise expose them, and C1 says a draft is visible to nobody
  but its owner. The scope filter therefore reads "every event, plus my own drafts" rather than
  "every row". This is the one place where merging the tables removed a safety net that the
  schema used to provide for free, so it is covered by its own tests.

### 2.2 Identity is the source of the access-scope rule; the JWT is the source of the subject

Every request is authenticated locally with `jose` + Supabase JWKS, mirroring
`services/identity/src/auth/verifyJwt.ts`. Defence in depth: the service never assumes it was
called through a gateway (implementation.md §6).

The service then makes one synchronous call to Identity per request, the hop `plan.md` §5 permits
("any service → Identity: role and scope resolution"):

- `GET /api/v1/users/me` → `{ id, email, role }` — the caller's internal `identity.users.id` and role.
- `GET /api/v1/access-scope/events` → `{ scope }` — the A3 rule to apply.

`resolveAccessScope` is **not** duplicated here. The scope object comes back from Identity and is
applied as a query-time filter inside the repo layer, never as a post-filter and never in the UI
(implementation.md §6). `OWNED_BY_USER` filters `events.owner_id = scope.userId`; `ALL` applies no
filter; `NONE` and `PUBLISHED_OPEN_REGISTRATION` get no access to these routes. A request for an
event outside the caller's scope returns `404`, not a filtered empty `200`.

Actor references stored in the `event` schema (`owner_id`, `assigned_coordinator_id`,
`reviewing_coordinator_id`, `decided_by`, history and clarification actors) are
`identity.users.id` values — cross-service ID references with no foreign key, per `plan.md` §4.

**This required a new Identity endpoint.** `GET /api/v1/users/me` did not exist; the access-scope
response alone cannot identify a coordinator (`{scopeType:"ALL"}` carries no user id) and D1/D4/D5
must record who reviewed, approved or rejected. It is added to Identity in this change, in that
service's existing style, and flagged in the changelog for its owner's review.

If Identity is unreachable, the request is refused with `503` and nothing is written. That is the
CP posture `plan.md` §2 requires: refuse rather than guess at a caller's scope.

### 2.3 Coordinator assignment (E1) is a stub

E1 is not in this scope but D1/D4/D5 are meaningless without an assigned coordinator. Identity has
no "list active coordinators" endpoint, so the eligible pool is read from
`EVENT_COORDINATOR_POOL` (comma-separated `identity.users.id` values) and allocated round-robin
against a single cursor row in `event.assignment_cursor`. The cursor lives in the database rather
than in process memory so the service stays stateless (implementation.md §10).

The allocation rule name recorded on each assignment is `ROUND_ROBIN_STUB`, so a later real E1 can
tell stub assignments from real ones. Every touch point is marked `TODO(E1)`.

Where the pool is empty, the event is still submitted and recorded as awaiting assignment, which
is what E1's last acceptance criterion asks for.

### 2.4 Outbox only, no relay

Every state change writes an `event.outbox` row **inside the same transaction**, with the full
envelope from implementation.md §3.3 and the topic naming of §3.1. No Kafka producer runs yet and
the Notification service does not exist, so rows accumulate unpublished — which is the correct
resting state for a transactional outbox and means notification acceptance criteria on these
stories are satisfied at the point this service is responsible for.

Topics produced: `connectsphere.event.submitted.v1`, `connectsphere.event.coordinator-assigned.v1`,
`connectsphere.event.clarification-requested.v1`, `connectsphere.event.clarification-responded.v1`,
`connectsphere.event.approved.v1`, `connectsphere.event.rejected.v1`.

Each has a zod schema in `packages/contracts`. That package is shared, so its additions need a
second owner's review before merge (implementation.md §2).

## 3. Schema — `event`

| Table | Purpose |
|---|---|
| `events` | C1 onward — a request from its first save to its decision. Owner and `name` are all a draft needs; `reference` (`EVT-000123` from a sequence) and `submitted_at` arrive at submission. Also `status`, `last_saved_at`, `reviewing_coordinator_id`, `review_started_at`, `decided_by`, `decided_at`, `rejection_reason`. |
| `assignments` | E1 stub. One active row per event: `coordinator_id`, `assignment_rule`, `assigned_at`, `ended_at`, `is_active`. Shaped so E2 can add rows later without migration churn. |
| `assignment_cursor` | Single row. Round-robin pointer for the stub. |
| `status_history` | F1. `previous_status`, `new_status`, `actor_user_id`, `actor_role`, `triggering_action`, `occurred_at`. Append only. |
| `clarifications` | D2/D3. One row per round, `OPEN` or `RESPONDED`, ordered by `requested_at`. |
| `event_field_edits` | D3's "originals retained alongside amended values". `field_name`, `previous_value`, `new_value`, actor, timestamp, `source`. |
| `outbox` | implementation.md §3.4, unchanged shape. |

Proposed timing is stored as `proposed_start_at`/`proposed_end_at` `timestamptz`, not a date plus
two times, because every B2 rule compares instants. No `tstzrange` or exclusion constraint: this
service owns no bookable period — that invariant belongs to Venue.

Enumerations are `text` + `check`, never Postgres enums (implementation.md §4.1). Cross-service
references carry no foreign keys and are commented with their owning service.

## 4. Domain layer

Pure, no I/O, unit tested without a database:

- `validateSubmission()` — B2's full rule set, returning **every** failing field, because B2's
  second criterion makes returning only the first a failed test. Feeds the error envelope's
  `fields[]`.
- `statusMachine.ts` — the permitted transitions these stories use:
  `Submitted → Under Review`, `Under Review ⇄ Awaiting Clarification`,
  `{Under Review, Awaiting Clarification} → Approved | Rejected`.
  A refused transition names the current status and the attempted target (F1).
- `assignment.ts` — round-robin selection over a pool and cursor.
- `text.ts` — the "at least one non-whitespace character" rule shared by D2's message, D3's
  response and D5's reason.

## 5. Refusal behaviour

Refusals are features (implementation.md §11.5). Each is tested and each writes nothing:

| Case | Status | Code |
|---|---|---|
| Invalid submission | 400 | `VALIDATION_FAILED` with `fields[]` |
| Role not permitted (A2) | 403 | `ROLE_NOT_AUTHORISED` |
| Event outside caller's scope (A3) | 404 | `EVENT_NOT_FOUND` |
| Transition not permitted from current status (F1) | 409 | `STATUS_TRANSITION_NOT_PERMITTED` |
| Second decision on a decided event (D4/D5) | 409 | `EVENT_ALREADY_DECIDED` |
| Empty clarification message / rejection reason | 400 | `VALIDATION_FAILED` |
| Responding with neither message nor amendment (D3) | 400 | `VALIDATION_FAILED` |
| Identity unreachable | 503 | `IDENTITY_UNAVAILABLE` |

Every error uses the envelope in implementation.md §5, carries the `correlationId`, and is logged
with its code.

## 6. Testing

Following the conventions already established in `services/identity/tests`: `vi.mock` the JWT
verifier and the Identity client, run everything else against the real database.

- **Unit** (`tests/domain`) — validation, status machine, assignment, text rules.
- **Repo** (`tests/repo`) — draft round-trip, scope filtering, decision guards, that an outbox row
  and its state change commit together.
- **API** (`tests/api`) — one test per acceptance criterion that spans layers, including every
  refusal in §5.

Traceability rows go to `packages/testkit/sprint-1/traceability.csv` for B1–C3 and D1, and a new
`packages/testkit/sprint-2/traceability.csv` for D2–D5, matching the sprint allocation in
`plan.md` §10.

## 7. Follow-ups for the team

1. `packages/contracts` gained event statuses, error codes and six envelope schemas — needs a
   second service owner's review.
2. `GET /api/v1/users/me` was added to Identity by the Event service's owner. Its owner should
   review it.
3. E1's assignment is a stub. Making it real needs an Identity endpoint listing active users
   holding `EVENT_COORDINATOR`.
4. No Kafka relay exists. Outbox rows accumulate unpublished until someone owns the relay.
