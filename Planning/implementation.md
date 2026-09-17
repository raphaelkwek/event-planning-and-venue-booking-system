# ConnectSphere — Implementation Standards

**Every agent and every team member follows this document.** It exists so that six people's work integrates without a rewrite. `plan.md` says what to build and where; this says how. Where this document specifies a format, that format is not negotiable by an individual agent — changing it needs a PR reviewed by another service owner.

---

## 1. Stack

| Layer | Choice | Version pinned in |
|---|---|---|
| Runtime | Node.js 20 LTS, TypeScript 5.x, strict mode | `.nvmrc`, `tsconfig.base.json` |
| Services | Express 4 | root `package.json` |
| Database | Supabase Postgres 15 | `docker-compose.yml` |
| DB access | `postgres` (porsager) or `pg` — **raw parameterised SQL, no ORM** | per service |
| Messaging | Apache Kafka (+ Zookeeper or KRaft), `kafkajs` | `docker-compose.yml` |
| Auth | Supabase Auth (GoTrue), `jose` for JWT verification | — |
| Frontend | React 18, TypeScript, Vite | `apps/web` |
| Internal UI | Atlassian Design System (`@atlaskit/*`) | `apps/web` |
| Testing | Vitest (unit/integration), Playwright (e2e), Testcontainers or compose-backed DB | root |
| CI | GitHub Actions | `.github/workflows/ci.yml` |

**No ORM** is deliberate: our hardest invariants are exclusion constraints and conditional updates, which ORMs hide. Write the SQL.

## 2. Repository layout

```
/apps
  /web                      SPA (all roles)
/services
  /identity  /event  /venue  /equipment  /registration  /notification
    /src
      /api                  Express routers + request validation
      /domain               business rules, pure, no I/O
      /repo                 SQL only, one function per query
      /events               outbox writer + Kafka consumers
      index.ts
    /migrations             NNNN_description.sql, forward-only
    /tests
/packages
  /contracts                event schemas, shared TS types, error codes  ← changing this needs review
  /testkit                  shared fixtures, seed data, flow runner
/tests                      functional test cases, one folder per user story (§8.4)
  /<story-id>               e.g. /tests/D5/D5-T1-reject-with-a-reason.md
/docs                       plan.md, implementation.md, C4 dsl, user stories
docker-compose.yml
```

**You may write inside your own service directory and your own migrations only.** `/packages/contracts` is shared: a PR touching it must be reviewed by at least one other service owner before merge.

## 3. Kafka message format (mandatory)

### 3.1 Topic naming

```
connectsphere.<aggregate>.<event-name>.v<major>
```

Examples: `connectsphere.event.submitted.v1`, `connectsphere.booking.confirmed.v1`, `connectsphere.registration.withdrawn.v1`.

Logs go to `connectsphere.logs.<service>.v1`. One topic per event type — not one firehose topic — so consumers subscribe only to what they need.

### 3.2 Message key

The **aggregate ID** (the UUID of the event, booking, reservation, or registration the message is about). This guarantees per-aggregate ordering within a partition, which is what our invariants need. Never use a random key.

### 3.3 Envelope

Every message body is JSON in exactly this shape. No exceptions — consumers validate against it and reject anything else.

```jsonc
{
  "messageId":    "018f2a...",      // UUIDv7, unique per message, used for consumer idempotency
  "messageType":  "event.submitted", // matches the topic, without prefix/version
  "schemaVersion": 1,                // bump on breaking payload change; new major = new topic
  "occurredAt":   "2026-09-15T08:31:22.104Z", // RFC3339 UTC, when the state change committed
  "producer":     "event-service",
  "correlationId":"018f29...",       // the originating HTTP request; propagate unchanged
  "causationId":  "018f2a...",       // messageId of the message that caused this one; null if user-initiated
  "actor": {
    "userId": "uuid | null",         // null for scheduler- or system-initiated
    "role":   "EVENT_ORGANISER | EVENT_COORDINATOR | VENUE_STAFF | TECH_SUPPORT_STAFF | ATTENDEE | SYSTEM"
  },
  "aggregate": {
    "type": "EVENT | BOOKING | HOLD | RESERVATION | REGISTRATION | NOTIFICATION",
    "id":   "uuid"
  },
  "payload": { }                     // event-specific; see /packages/contracts
}
```

**Rules:**
- `payload` carries the facts needed by a consumer, not the whole aggregate. Include IDs and the changed values.
- Never put a JWT, password, or full user record in a payload.
- Payload fields are additive only within a `schemaVersion`. Removing or retyping a field means a new version and a new topic.
- Timestamps are always RFC3339 UTC with milliseconds. Never local time, never epoch ints.
- Every event type has a TypeScript type and a runtime validator (zod) in `/packages/contracts`. Producing an event without one is a failed review.

### 3.4 Transactional outbox (required of every producer)

A domain event must exist if and only if its state change committed. Every service has:

```sql
create table <schema>.outbox (
  id              uuid primary key default gen_random_uuid(),
  topic           text        not null,
  message_key     text        not null,
  envelope        jsonb       not null,
  created_at      timestamptz not null default now(),
  published_at    timestamptz,
  attempts        int         not null default 0,
  last_error      text
);
create index on <schema>.outbox (published_at) where published_at is null;
```

Write the outbox row **inside the same transaction** as the state change. A separate relay polls unpublished rows and produces to Kafka. Never produce to Kafka from inside a request handler.

### 3.5 Consumers

At-least-once delivery means duplicates. Every consumer:

```sql
create table <schema>.consumed_messages (
  message_id   uuid primary key,
  consumer     text        not null,
  consumed_at  timestamptz not null default now()
);
```

Insert the `messageId` in the same transaction as the side effect; a duplicate key means already processed, so skip. Consumers must be idempotent regardless. On unrecoverable failure, write to `connectsphere.dlq.<service>.v1` rather than blocking the partition.

## 4. Database standards (mandatory)

### 4.1 Naming

- `snake_case` everywhere; tables plural (`booking_requests`), columns singular.
- Primary key is always `id uuid primary key default gen_random_uuid()`.
- Foreign keys **within** a schema: `<singular>_id`, with a real FK constraint.
- References **across** schemas: `<singular>_id uuid not null`, **no FK constraint**, and a comment naming the owning service.
- Booleans read as assertions: `is_active`, `has_registration`. Never `flag`, never `status_bool`.
- Enumerated values: `text` + `check (col in (...))`, not Postgres `enum` types (migrating an enum is painful). The permitted values live in `/packages/contracts`.

### 4.2 Columns every table has

```sql
id           uuid        primary key default gen_random_uuid(),
created_at   timestamptz not null default now(),
created_by   uuid,                      -- null only for system/seed rows
updated_at   timestamptz not null default now(),
updated_by   uuid
```

### 4.3 Columns every *state-bearing* table has

```sql
status       text        not null check (status in (...)),
```

**Nothing is ever hard-deleted.** Withdrawal, rejection, cancellation and release are status values. A `DELETE` statement in a migration or a repo function is a failed review. The stories depend on this: "the record is retained, not deleted" appears in L2, Q2, R4, R6, F4.

### 4.4 Time periods

Every bookable or reservable period is stored as **two timestamptz columns plus a generated range**:

```sql
starts_at   timestamptz not null,
ends_at     timestamptz not null,
period      tstzrange generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
constraint ends_after_start check (ends_at > starts_at)
```

`'[)'` is what makes touching periods not overlap — the rule in I2, J1, L3, N1, P1. Do not hand-roll an overlap comparison anywhere; use `&&` on `period`.

### 4.5 What consistency guarantee we actually need

We do **not** provide strict serializability. That is a distributed guarantee — every operation appearing in one global order that respects real time — and nothing in this stack offers it: Postgres `SERIALIZABLE` is per-database, Kafka orders per-partition, and there is no synchronised clock. No acceptance criterion asks for it either. Do not claim it.

What the criteria actually require is **linearizability per aggregate**: each individual slot, equipment type, or event behaves as if operations on *it* happened one at a time. Three objects need it, and each gets it from a single-row write rather than from an isolation level:

| Object | Story | What provides it |
|---|---|---|
| A venue slot (venue + period) | N1, L3 | The `EXCLUDE USING gist` constraint — a single row insert, so linearizable by construction |
| An equipment type's available quantity | Q1 | Conditional `UPDATE` on one counter row |
| An event's registration count | R2, R7 | Conditional `UPDATE` on one counter row |

This is why "never read-then-write on a contended resource" matters more than any isolation setting: the guarantee comes from the shape of the statement.

### 4.6 The three concurrency invariants

**Venue slot exclusivity** (N1, L3) — one hold *or* confirmed booking per venue and period:

```sql
create extension if not exists btree_gist;
alter table venue.venue_slots add constraint venue_slot_no_overlap
  exclude using gist (venue_id with =, period with &&)
  where (status in ('HELD','CONFIRMED'));
```

Model holds and confirmed bookings as rows in one table (`venue_slots`) so a single constraint covers both. Two concurrent inserts: exactly one succeeds, the other raises `23P01`, which you translate into the refusal message naming the conflicting reference.

**Equipment availability** (Q1) — never over-reserve:

```sql
update equipment.availability_counters
   set reserved = reserved + $qty
 where equipment_type_id = $id and (total - reserved) >= $qty
 returning *;
```

Zero rows returned means insufficient availability. Never `SELECT` then `INSERT`.

**Registration capacity** (R2, R7) — the ceiling is read **synchronously from the Venue Service at the moment of registration**, never from a cached figure:

1. Call Venue for the current layout capacity of the event's confirmed booking. If Venue is unreachable or the event has no confirmed booking, refuse (`503` / `422`) — do not fall back to a stored value.
2. Apply the atomic conditional update against `registration.capacity_counters`, passing the freshly read ceiling:

```sql
update registration.capacity_counters
   set registered = registered + 1
 where event_id = $id and (registered + manually_added) < $ceiling
 returning *;
```

Zero rows returned means full; offer the waitlist (R6).

`capacity_counters.cached_ceiling` may exist **for display only** — the browse list and the places-remaining badge may read it. The write path must never trust it. Rationale: Venue Staff can reduce a layout's capacity at any time, and an over-admitted attendee cannot be un-invited, whereas a refused registration is recoverable. Venue also publishes `venue.layout-capacity.changed`, which Registration consumes to refresh the cached figure and to flag an event that is now over-subscribed for manual handling (the customer confirmed capacity reductions are resolved manually, not automatically).

### 4.7 Transactions and isolation

- Default `READ COMMITTED`. The three patterns above are safe at that level because the constraint or the `WHERE` clause does the work.
- Use `SERIALIZABLE` only when an invariant spans rows you must **read before writing**. Exactly two operations qualify:
  - **P2** — refusing a total-quantity reduction below what is already reserved across overlapping periods (reads many reservation rows, then writes).
  - **R7** — a manual add weighed against registered + manually-added versus the ceiling, if you keep those as two counters. Preferred alternative: fold both into one counter row and use the conditional-update pattern instead, which removes the need for `SERIALIZABLE` entirely.
- Handle `40001` by retrying once, then surfacing the error. Put a comment above any `SERIALIZABLE` transaction naming the invariant that forced it, so a reviewer can see it was deliberate.
- **F1's Confirmed transition cannot be made serializable at all**, because it reads across service boundaries (Venue and Equipment). Re-verify both arrangements inside the writing transaction, accept the residual window, and rely on S3 to re-flag the event if an arrangement changes afterwards. Be able to say this plainly in the Q&A rather than overclaiming.
- **Never** hold a transaction open across an HTTP call to another service.
- Statement timeout: 5 s. Connection pool max 10 per service.

### 4.8 Migrations

Forward-only, numbered, one concern per file: `0007_add_venue_slots_exclusion.sql`. Never edit a merged migration. Seed data (internal staff accounts, venues, equipment types) lives in `/services/<svc>/migrations/seed/` and is idempotent.

## 5. HTTP API conventions

- Base path `/api/v1/<resource>`; plural nouns; no verbs in paths.
- Status codes: `200` read, `201` create, `204` no content, `400` validation, `401` unauthenticated, `403` role/scope refusal, `404` not found *or* out of scope (never reveal existence), `409` invariant conflict (double-booking, capacity, duplicate), `422` valid shape but rejected by a business rule, `503` dependency unavailable (our CP refusal).
- **Every error uses this envelope:**

```jsonc
{
  "error": {
    "code": "BOOKING_SLOT_CONFLICT",      // SCREAMING_SNAKE, defined in /packages/contracts
    "message": "Venue Hall A is already booked for 2026-10-02 14:00–16:00 (booking BK-00231).",
    "details": { "conflictingBookingRef": "BK-00231" },   // optional, structured
    "fields": [ { "field": "expectedAttendance", "message": "must be greater than zero" } ],
    "correlationId": "018f29..."
  }
}
```

The `message` is user-facing and must name the specific values the story requires. B2 says "the message names every field that caused the rejection" — that is what `fields[]` is for, and returning only the first is a failed acceptance test.

- Every request carries `Authorization: Bearer <supabase-jwt>` and `X-Correlation-Id` (the gateway generates one if absent; services propagate it into logs and message envelopes).
- Lists are paginated: `?limit=` (default 25, max 100) `&cursor=`. Response `{ "items": [...], "nextCursor": "..." | null }`.
- Dates in JSON are RFC3339 UTC strings. The client localises; the server never does.

## 6. Authorisation

- The gateway verifies the JWT and applies the coarse role check. **Every service re-checks.** Defence in depth — a service must never assume it was called through the gateway.
- Role claim values are exactly: `EVENT_ORGANISER`, `EVENT_COORDINATOR`, `VENUE_STAFF`, `TECH_SUPPORT_STAFF`, `ATTENDEE`.
- Access scope (A3) is a **query-time filter in the repo layer**, not a post-filter in the API layer and never in the UI. A user outside the scope gets `404`, not a filtered-empty `200`.
- Services connect to Postgres with a service role, which **bypasses RLS**. Enable RLS anyway as a second line of defence, but the authoritative check is in our code — be ready to say this in the Q&A.
- Service-to-service calls carry a short-lived internal token plus the original `correlationId` and acting user, so the audit trail survives the hop.

## 7. Frontend

### 7.1 Internal roles (Organiser, Coordinator, Venue Staff, Tech Support)

Use **Atlassian Design System** components (`@atlaskit/*`) and do not restyle them. Rationale: it is the customer's stated preference, it gives us a dense data-first UI for free, and six people building screens from the same component set will produce something coherent without a design review.

Standard screen shapes:
- **Queue/list screens** (D1 review queue, M1 booking queue, R5 registrations): `@atlaskit/dynamic-table` with column sort, status `@atlaskit/lozenge`, cursor pagination.
- **Detail screens**: two-column — content left, metadata/status/history right.
- **Status** is always a lozenge with a fixed colour per status. Define the map once in `apps/web/src/shared/status.ts`; never inline a colour.
- **Destructive or irreversible actions** (reject, cancel, release) use a confirmation modal that restates what will happen, and the mandatory-reason field lives in that modal.
- **Refusals** render as an inline `@atlaskit/section-message` with the server's `message`, never a generic toast. Field errors bind to the field via `fields[]`.

### 7.2 Attendees

A separate, simpler, public-facing surface — do not put Jira chrome in front of attendees. Base design, to be improved by whoever owns it:

- Single-column, max width 720px, generous spacing, one primary action per screen.
- Three screens only: **browse open events** (card list: name, date, time, venue, places remaining or a Full badge), **event detail + register** (published fields only — no coordinator notes, review comments, or internal history), **my registrations** (status per row: Registered / Waitlisted / Withdrawn / Cancelled).
- Register, Join waitlist, and Withdraw are the only actions. Withdraw confirms before acting.
- Tokens: system font stack, 8px spacing scale, one accent colour, WCAG AA contrast. Accessibility is a customer requirement elsewhere in the brief — don't let the attendee UI be the part that fails it.

### 7.3 The shared UI shell — Sprint 1

These belong to no single story but every screen depends on them, so they are built in Sprint 1 alongside A1 and A2. If they arrive later, each story reinvents a piece of them differently.

- **Session store and route guard** — token and active role held in context; navigation renders only the functions the role may use (A2); logout clears state so a back-navigation shows no event data (A1).
- **API client** — attaches the bearer token and `X-Correlation-Id`, and parses the standard error envelope (§5) into a refusal message plus per-field errors.
- **Refusal display** — one inline component for the server's `message`, and one binding of `fields[]` to form inputs. Most stories specify what the user is told on refusal; this is where that happens. Never a generic toast.
- **Status lozenge map** — `apps/web/src/shared/status.ts`, one colour per event, booking, reservation and registration status. No inline colours anywhere.
- **App layout and empty/loading states** — page shell, list and detail skeletons, and the "no results, here are the filters you applied" empty state J1 requires.

The attendee shell (§7.2) is separate and is built in Sprint 3 with R1, not in Sprint 4 — see `plan.md` §9.1.

## 8. Testing and the sprint test kit

### 8.1 Levels

| Level | Tool | What it covers |
|---|---|---|
| Unit | Vitest | `/domain` — pure rules: overlap, validation, status transitions, capacity maths. Fast, no DB. |
| Integration | Vitest + real Postgres | `/repo` and the concurrency invariants. **The exclusion constraint and both conditional updates must each have a test that fires two operations concurrently and asserts exactly one wins.** |
| Contract | Vitest | Every produced event validates against its `/packages/contracts` schema; every consumer handles a duplicate `messageId` without a second side effect. |
| E2E | Playwright | Full user flows through the SPA against the composed stack. |

**Target: 100% coverage of `/domain`,** and where it isn't reachable, a comment in the test file saying why. The rubric asks for exactly this.

### 8.2 The sprint test kit — build it *before* the sprint

At sprint planning, before any story is started, the sprint owner creates `/packages/testkit/sprint-<n>/`:

1. **`flow.md`** — the end-to-end journey the sprint must demonstrate, written as numbered steps with the expected observable outcome at each. Derived from the sprint's stories, not invented.
2. **`seed.sql`** — idempotent fixture data for that flow (staff accounts, venues, equipment, an attendee).
3. **`flow.spec.ts`** — a Playwright test that walks `flow.md` start to finish and fails loudly at the first divergence.
4. **`traceability.csv`** — `story_id, acceptance_criterion, test_file, test_name`, one row per AC. This *is* deliverable 3.

The flow test goes red on day one and must be green before the sprint review. It is the sprint's definition of done at the system level, and it catches integration breakage between six people's services on the day it happens rather than in Week 12.

### 8.3 Definition of Done (applies to every story)

- Code merged to `main` via pull request with at least one peer review.
- Unit tests for the story's logic, and at least one integration or e2e test per acceptance criterion that spans layers.
- CI pipeline green: build, lint, typecheck, test.
- All acceptance criteria demonstrated to the Product Owner in the sprint review.
- No new failing tests; existing tests still pass.
- Story traced to its tests in `traceability.csv`.
- Functional test cases written for the story in `/tests/<story-id>/` (§8.4), each with a latest execution record, and every acceptance criterion covered by at least one of them.
- Any new event type registered in `/packages/contracts` with a schema and a validator.

### 8.4 Functional test cases

Every user story gets **functional test cases**: specific, written descriptions of the inputs, conditions and expected behaviour that show whether the story works as its acceptance criteria say. They are the human-readable specification of a story, the thing a tester follows by hand and the Product Owner reads in the sprint review. The automated tests in §8.1 are how some of them are then made repeatable; a functional test case is not replaced by an automated one, it is what the automated one is checking.

A test case must be specific enough that **anyone on the team can execute it without asking**. "Log in to the app" is not a test step; "sign in as `coordinator@connectsphere.test` with password `ConnectSphere-Test-1234!`" is.

#### Where they live

- `/tests/<story-id>/` — one folder per story, e.g. `/tests/D5/`.
- **One file per test case**, named `<story-id>-T<n>-<short-slug>.md`, e.g. `D5-T3-reason-of-whitespace-only.md`.
- The test case ID is `<story-id>-T<n>`, numbered from 1 within the story. **This is the same ID as the test's Jira issue** (`D5-T3 — Reason of whitespace only`), so a file and its ticket can always be matched.
- A test case that genuinely spans several stories in one feature is tagged with the feature letter alone and lives in `/tests/<letter>/`, e.g. `/tests/E/E-T1-...md` — the same convention Jira already uses for shared test issues.
- Evidence from an execution (screenshots, exported responses) goes in `/tests/<story-id>/evidence/`, named after the test case and the date it was run.
- `/tests/TEMPLATE.md` is the blank starting point. Copy it; do not invent a different layout.
- `/tests/README.md` defines what every case shares — the standard environment, the seeded accounts, the standard request, and named setup procedures such as `FX-UNDER-REVIEW`. A pre-condition names a procedure rather than repeating its steps, which keeps cases short without making them vague. If a story needs a new shared procedure, add it there.
- `npm run test-cases:reset` resets the data before a run. It touches only requests owned by the seeded organiser accounts, because the database is shared by the team.

#### The format

Each file has two parts. The **specification** is written once and changes only when the requirement changes. The **execution record** is overwritten on every run, so the file always shows the latest result.

**Specification — written once**

| Item | Description |
|---|---|
| **Test Case ID** | Unique ID, `<story-id>-T<n>` |
| **Test Scenario** | Succinct summary of what the case checks |
| **Pre-conditions** | What must be true before the steps start, including the state of the data. Name the script or the steps that produce it. |
| **Test Steps** | Numbered, step-by-step procedure the tester follows |
| **Test Data** | The exact inputs used |
| **Expected Result** | What should be observed, specifically enough that pass or fail is not a judgement call |
| Created By | Author of the test case |
| Date of Creation | When it was written |

**Execution record — the latest run**

| Item | Description |
|---|---|
| **Actual Result** | What was actually observed |
| **Status** | Exactly one of `Pass`, `Fail`, `Not Executed`, `Blocked` |
| **Remarks** | The commit SHA the run was against, the evidence file, and a defect link on a fail. `Blocked` says what blocked it. |
| Executed By | Who ran it |
| Date of Execution | When |

Created By, Date of Creation, Executed By and Date of Execution are optional in the template, but fill them in: they are what makes a record trustworthy when Week 13 asks who verified a story and when.

A pass is only ever **"passing as of that build"** — which is why Remarks carries the commit SHA. The same case is re-run to catch regressions, and each run replaces the record.

**Reset the data before every run.** The pre-conditions must name how the starting state is produced, and that state must be reproducible — seeded, not whatever happened to be left in the database — because one test case's writes can change another's outcome. The sprint's `packages/testkit/sprint-<n>/seed.sql` (§8.2) is the default place for that fixture data.

#### Deriving the cases from a story

Work through the story's acceptance criteria in this order. Most stories need cases from **every** category, and several cases per criterion is normal; one case per criterion almost always means only the happy path was tested.

1. **Visualise the workflow.** Put yourself in the user's position: what they see, what they click, and what they might do that nobody intended. Test cases can and should be written *before* the feature is built, from the story alone.
2. **Happy path.** The route through the story that meets no errors. Write and run these first: if the happy path fails, nothing else is worth running yet.
3. **Cross-cutting quality expectations.** Authorisation, accessibility, consistent error handling, the design-system behaviour of §7. **Do not repeat a generic check in every story** — that bar is set once, in the Definition of Done and the shared UI shell (§7.3). Do write a dedicated case when the concern produces behaviour *specific to this story*: "the rejection reason is visible to the owning organiser and to no other organiser" is story-specific; "a non-coordinator cannot reach coordinator screens" is not.
4. **Negative testing.** Erroneous input, business exceptions, and unavailable systems — for us, Identity or another service not responding (a `503` refusal under CP is correct behaviour and needs a case of its own). Check the refusal the user sees, not only that the action did not happen, and check that nothing was stored.
5. **Boundary testing.** Wherever an input has a range or a threshold, test **just below, exactly at, and just above** it — logic errors cluster at boundaries. Pair it with equivalence partitioning: group inputs that should behave alike, test one from each group, then test the edges between groups.

A scenario-style acceptance criterion maps straight onto a test case, and writing a checklist criterion out as one or more *Given / When / Then* scenarios first is a useful way to find the cases:

| Acceptance criterion | Test case |
|---|---|
| Given… | Pre-conditions |
| When… | Test Steps + Test Data |
| Then… | Expected Result |

#### Worked example — D5, reject an event request

The cases D5's criteria produce, one line each:

| ID | Category | Scenario |
|---|---|---|
| D5-T1 | Happy path | Reject a request under review, giving a reason |
| D5-T2 | Negative | Reject with the reason left empty |
| D5-T3 | Boundary — just below | Reject with a reason of whitespace only |
| D5-T4 | Boundary — exactly at | Reject with a reason of a single character |
| D5-T5 | Negative | Try to amend or resubmit a request that has already been rejected |
| D5-T6 | Cross-cutting, story-specific | The reason is shown to the owning organiser, and a different organiser cannot see the request |
| D5-T7 | Happy path | The organiser is notified of the rejection — `Blocked` until the Notification service exists |

D5-T1 in full:

**Specification**

| Item | Content |
|---|---|
| Test Case ID | D5-T1 |
| Test Scenario | Reject a request under review, giving a reason |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed. The coordinator is on the review screen. |
| Test Steps | 1. Click "Reject".<br>2. Enter the reason in the dialog.<br>3. Click "Reject request". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` · Reason: `No venue can host 150 people on 2 December.` |
| Expected Result | The dialog closes. The status shows "Rejected". The page shows the reason "No venue can host 150 people on 2 December." and the decision date and time. "Approve" and "Reject" are both disabled. |
| Created By | Seann, via Claude |
| Date of Creation | 2026-09-17 |

**Execution record**

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | |
| Executed By | |
| Date of Execution | |

Note how D5-T3 and D5-T4 sit either side of the criterion's "at least one non-whitespace character", and how D5-T7 is recorded as `Blocked` with its reason rather than quietly left out.

## 9. Logging and observability

Structured JSON to stdout **and** to `connectsphere.logs.<service>.v1`:

```jsonc
{ "ts": "...", "level": "info|warn|error", "service": "event-service",
  "correlationId": "...", "userId": "... | null", "route": "POST /api/v1/events",
  "durationMs": 42, "outcome": "success|refused|error", "code": "BOOKING_SLOT_CONFLICT | null",
  "message": "..." }
```

Log every refusal with its `code` — refusals are correct behaviour under CP and we need to show they happen deliberately. **Never log** JWTs, passwords, or full attendee records. `correlationId` must appear in the HTTP response, the log line, and any message envelope produced during that request; that chain is what makes a Week 13 trace demonstration possible.

## 10. Configuration and deployment

All config from environment variables, documented in `.env.example`. No secrets in the repo, no `localhost` in code. Required per service: `PORT`, `DATABASE_URL`, `DATABASE_SCHEMA`, `KAFKA_BROKERS`, `SUPABASE_URL`, `SUPABASE_JWKS_URL`, `SERVICE_NAME`, `LOG_LEVEL`, `INTERNAL_TOKEN_SECRET`.

Cloud-readiness rules to follow now so the move is boring later: services are stateless (no in-process cache, no local disk writes, sessions in the token); health endpoints `/healthz` (liveness) and `/readyz` (checks DB and Kafka); graceful shutdown drains in-flight requests and commits Kafka offsets; every service runs from a Dockerfile, never from `npm run dev` in the compose file.

## 11. Rules for coding agents

Each of us is running Claude Code against a shared repo. These exist to stop six agents producing six incompatible interpretations.

1. **Read `plan.md` §4–§6 and this document's §3 and §4 before writing code.** They contain the contracts the rest of the team depends on.
2. **Stay inside your service directory and your own migrations.** Do not "helpfully" fix another service.
3. **Do not invent fields, event types, error codes, status values, or endpoints.** If the story needs one that isn't in `/packages/contracts`, stop, propose it to the team, add it in a reviewed PR.
4. **Implement the acceptance criteria as written.** If an AC seems wrong or impossible, raise it — do not silently improve it. The ACs are the spec and the test basis.
5. **Refusal paths are features.** Most stories specify what happens when an action is refused and assert nothing is stored. Implement and test those alongside the happy path.
6. **No `DELETE`. No read-then-write on a contended resource. No HTTP inside a transaction. No ORM.**
7. **Every state change that other services care about produces an outbox row in the same transaction.** Never produce directly to Kafka.
8. **Write the test with the code, in the same PR,** and add the traceability row.
9. **If you are unsure which service owns a behaviour, ask** — do not implement it in both.
10. **You are accountable for what you ship.** Week 13 picks a feature at random and asks you to trace story → AC → test → code. "The agent wrote it" is not an answer, so read the diff before you commit it.
11. **Follow the commit message standard below.** A human has to verify agent output fast — an inconsistent history costs them time we don't have.
12. **Write the functional test cases before the code, from the story — never from the implementation** (§8.4). A case derived by reading the code checks what the code does, not what the story requires, and when an agent writes both the code and its tests they share the same blind spot. An agent may draft test cases, but the story owner confirms every expected result against the acceptance criteria before any code is written to satisfy them. Agent-drafted cases read as confident and complete whether or not they are; watch for many cases that all exercise the same happy path.

### 11.1 Commit message standard

**Commit early and often.** Small, frequent commits are easier for a human to verify and keep merge conflicts small. Don't batch an entire story into one commit.

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
type(scope): short summary in the imperative mood

Why this change was necessary and what it accomplishes.

Resolves: #123
```

- **type** — one of:

  | Type | Meaning |
  |---|---|
  | `feat` | a new feature for the user |
  | `fix` | a bug fix for the user |
  | `docs` | documentation only |
  | `style` | formatting only, no logic change |
  | `refactor` | restructuring code with no behaviour change |
  | `test` | adding or fixing tests |
  | `chore` | tooling, dependencies, config |

- **scope** — the story ID or service, e.g. `feat(f2)`, `fix(event-service)`.
- **summary** — imperative mood ("add", not "added" or "adds"), one line, one change. Don't bundle two unrelated things in one commit or message.
- **body** — required whenever the "why" isn't obvious from the summary alone (most stories). State the reason, not a restatement of the diff.
- **footer** — `Resolves: #123` when the commit closes a Jira/GitHub issue.

**Bad:** `fixed the bug` · `added a button and also fixed a typo in config` · `stuff.`
**Good:** `feat(a1): add biometric login option` · `fix(event-service): repair profile picture upload crash`

### 11.2 `CHANGELOG.md` is the record of what happened

`CHANGELOG.md` is the single point of authorship for "what got done, when, and why" — not Jira,
not the commit log. Jira tracks tickets moving through a workflow; the commit log records diffs.
Neither captures the reasoning — why a design changed, what a fix actually was, what's still
unverified — that a teammate or the Week 13 panel needs and that git alone cannot explain. That's
what `CHANGELOG.md` is for, and it stands on its own regardless of whether a Jira ticket exists for
the work. It also feeds the Confluence sprint log directly (`npm run confluence:digest`, README.md)
— write it once here, not a second time by hand there.

**Every push, and every distinct chunk of work within it, gets an entry before you push.** A chunk
is a story slice, a bugfix, a refactor, a docs/tooling change — anything you'd want a teammate to
be able to find later without reading the diff. Insert newest-first, directly below the header, per
the convention at the top of the file. A push with no corresponding entry is not done.

---

## Appendix — decisions still open

Keep this list short and kill items as they're decided.

- Email delivery: in-app notification only satisfies T2. Email is a stretch goal behind an adapter.
- Kafka single-broker locally; replication factor and partition count for cloud not yet chosen.
- Whether waitlist invitations expire (customer left it open).
- Whether a rejected event can be revived (customer left it to us; currently terminal).
