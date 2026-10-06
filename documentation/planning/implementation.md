# ConnectSphere — Implementation Standards

**Every agent and every team member follows this document.** It exists so that six people's work integrates without a rewrite. `plan.md` says what to build and where; this says how. Where this document specifies a format, that format is not negotiable by an individual agent — changing it needs a PR reviewed by another service owner.

> **Architecture update, 2026-10-01.** ADR-0004 to ADR-0015 were accepted. §4.5 to §4.7 below are updated to match. Some sections still describe the earlier six-service design and conflict with the ADRs, and **where they conflict, the ADR wins** until those sections are rewritten:
>
> | Section | What still reflects the old design | ADR | Rewrite owner |
> |---|---|---|---|
> | §4.6 | Registration capacity counters | ADR-0005 (seat rows) | EN-13 |
> | §6 | Authorisation | ADR-0010 (Cerbos and RLS) | EN-07 |
> | §9 | Logs written to a Kafka topic per service | ADR-0013 (OpenTelemetry, Grafana Loki) | EN-08 |
>
> §2 was rewritten for ADR-0004 on 2 Oct 2026, when EN-01 merged Identity and Event into `planning-core`. §3 was rewritten for ADR-0008 on 3 Oct 2026 (EN-04.1).

---

## 1. Stack

| Layer | Choice | Version pinned in |
|---|---|---|
| Runtime | Node.js 20 LTS, TypeScript 5.x, strict mode | `.nvmrc`, `backend/tsconfig.base.json` |
| Services | Express 4 | root `package.json` |
| Database | Supabase Postgres 15, hosted | the team's Supabase project |
| DB access | `postgres` (porsager) or `pg` — **raw parameterised SQL, no ORM** | per service |
| Messaging | Apache Kafka, one hosted cluster shared by the team (ADR-0008), `kafkajs` | the hosted provider |
| Auth | Supabase Auth (GoTrue), `jose` for JWT verification | — |
| Frontend | React 18, TypeScript, Vite | `frontend` |
| Internal UI | Atlassian Design System (`@atlaskit/*`) | `frontend` |
| Testing | Vitest (unit/integration), Playwright (e2e), against the hosted Supabase project | root |
| CI | GitHub Actions | `.github/workflows/ci.yml` |

**No ORM** is deliberate: our hardest invariants are exclusion constraints and conditional updates, which ORMs hide. Write the SQL.

## 2. Repository layout

Staff-facing code is **one deployable, `planning-core`**, made of modules (ADR-0004). Notification is a separate service (EN-04.3, ADR-0008), and Registration will be one when EN-13 builds it (ADR-0005).

```
/frontend                   SPA (all roles)
  /src  /tests
/backend
  /services
    /planning-core          one Express app, one process (ADR-0004)
      /src
        index.ts            starts the app listening
        app.ts              mounts each module's router; nothing else
        /shared             config, db pool, logger, JWT verification, health
        /modules
          /identity  /event  /venue  /equipment  /change
            /api            Express routers + request validation
            /domain         business rules, pure, no I/O
            /repo           SQL only, this module's schema only, one function per query
            /events         outbox writer + Kafka consumers
            index.ts        the module's public interface: the only file other modules import
      /migrations/<module>  NNNN_description.sql, forward-only; identity's seed SQL in /identity/seed
      /tests/<module>       unit and integration tests for that module
      /scripts              the schema boundary check
      .dependency-cruiser.mjs  the import boundary check
    /registration           EN-13, not built yet
    /notification           EN-04.3: Kafka consumer, inbox, retry and DLQ, T2's recipient rules;
                            T2: the read and mark-as-read API (who is calling: identity's /users/me);
                            its own schema, migrations/ and /healthz, /readyz on NOTIFICATION_PORT
  /packages
    /contracts              event schemas, shared TS types, error codes  ← changing this needs review
    /kafka                  the KAFKA_* reader, credential redaction, broker probe, client builder
  /scripts                  migrate.ts (`npm run migrate -- <module-or-service>`), kafka-check.ts
  /supabase                 Supabase CLI config (run as `npx supabase --workdir backend …`)
  tsconfig.base.json        extended by planning-core and contracts
/documentation
  /planning                 plan.md, implementation.md, definition-of-ready.md, Jira snapshot
  /adr                      architecture decision records
  /proposals                decisions still being agreed
  /superpowers              /specs and /plans written by the Superpowers plugin
  /traceability             sprint-<n>.csv (§8.2)
  /scripts                  confluence-digest.ts
  /transcript               meeting transcripts
  final user stories.md, sprint allocation.csv
/tests                      functional test cases, one folder per user story (§8.4)
  /<story-id>               e.g. /tests/D5/D5-T1-reject-with-a-reason.md
  /flows/sprint-<n>         the sprint flow test: flow.md, seed.sql, flow.spec.ts (§8.2)
  /fixtures                 test-data reset
CHANGELOG.md  README.md  CLAUDE.md  package.json  .env
```

`tests/` is its own top-level folder because its cases and their automated scripts drive the running web app against the running backend, so they belong to neither half. Unit and integration tests stay next to the code they test. The root keeps only what must live there: npm workspaces and the root `npm run dev` that starts the whole stack, the shared `.env`, and the files GitHub, Claude Code and §11.2 expect at the root.

**You may write inside your own module, its migrations and its tests only.** A module owns its Postgres schema of the same name (`identity`, `event`, `venue`, `equipment`, `change`).

- **Reading another module's data:** call a function exported from that module's `index.ts`. Never import its other files, never query its schema, and never call it over HTTP. Inside the core, a cross-module rule (F4, F5, S2/S3, G2) is one Postgres transaction (ADR-0004).
- **`npm run lint:boundaries` enforces this** and fails on either kind of breach: dependency-cruiser rejects an import of another module's internals, and a SQL check rejects a reference to another module's schema in `src/` or `migrations/`.
- **`/backend/packages/contracts` is shared:** a PR touching it must be reviewed by at least one other module owner before merge.

## 3. Kafka message format (mandatory)

Rewritten on 3 Oct 2026 for ADR-0008 (EN-04.1). The contract is code in `/backend/packages/contracts`, and this section explains it:

| File | What it fixes |
|---|---|
| `src/topics.ts` | the topic names, retry and dead-letter naming, and which topics exist before the cutover |
| `src/cloudEvent.ts` | the CloudEvents 1.0 envelope, its extensions, and `parseCloudEvent` |
| `src/eventEvents.ts` | the `data` schema for each event-module message type |
| `tests/cloudEvent.test.ts` | an example message for every message type, validated |

> **Transition.** Since EN-04.2 the event module writes CloudEvents. Outbox rows written earlier in the old envelope (`src/envelope.ts`) are converted by the relay as it publishes them, using the mapping in §3.3. `envelope.ts` goes once no such row is left unpublished.

### 3.1 Topics

**One topic per aggregate type**, named `connectsphere.<aggregate>.v<major>`:

| Topic | Aggregate | Produced by |
|---|---|---|
| `connectsphere.event.v1` | an event (A–G) | planning-core, event module |
| `connectsphere.venue-booking.v1` | a venue's holds, booking requests and bookings (L, M, N, I2) | planning-core, venue module |
| `connectsphere.equipment-request.v1` | an event's equipment request lines (O1, O2) | planning-core, equipment module |
| `connectsphere.equipment-reservation.v1` | a reservation of equipment units (Q1, Q2) | planning-core, equipment module |
| `connectsphere.registration.v1` | a registration or waitlist entry (R) | registration service |

- **Every message about one aggregate goes to its aggregate's topic,** whatever happened to it. That keeps them in order, because they share a key (§3.2). The CloudEvents `type` says what happened (§3.3), so a consumer subscribes to the aggregate topic and ignores the types it doesn't handle.
- **Use the constants from `contracts`** (`KAFKA_TOPICS.event` and so on). Never type a topic name into a module.
- **A new aggregate topic needs a reviewed `contracts` PR.** The topic name's major version changes only if every message on it would need to change.

**Retry and dead-letter topics belong to a consumer:**
- named `connectsphere.<consumer>.retry.v1` and `connectsphere.<consumer>.dlq.v1`;
- built with `retryTopic()` and `deadLetterTopic()`, which refuse a consumer name that isn't lowercase kebab-case;
- `KAFKA_TOPICS` holds the ones in use, today only the notification consumer's.

**Before the cutover to Confluent (13 Oct 2026):**
- the cluster is Aiven's free plan, which allows five topics with 2 partitions each;
- only `TOPICS_BEFORE_CUTOVER` exists (event, equipment-request, and the notification consumer's retry and dead-letter topics), and a contract test keeps that list at five or fewer;
- the rest of `KAFKA_TOPICS` is created at the cutover;
- `npm run kafka:check` shows which is which. The ADR-0008 decision note of 2 Oct has the details.

**The old per-type names** (`connectsphere.event.submitted.v1` and the rest) are kept in `LEGACY_EVENT_TOPICS`:
- outbox rows written before 2 Oct still carry them;
- the relay sends each row to `aggregateTopicFor(row.topic)`, which maps a legacy name to its aggregate's topic and refuses a name it doesn't know;
- never publish to them.

**Logs don't go to Kafka.** They go to Grafana Loki (ADR-0013).

**Consumer groups:**
- a deployed consumer joins `connectsphere.<service>.<consumer>`, e.g. `connectsphere.notification.event-notifier`;
- on a laptop, `.<KAFKA_GROUP_SUFFIX>` is appended (set to `dev-<initials>` in `.env`), so a local consumer never takes partitions from the deployed one or from a teammate's;
- topics are shared, so there are no per-person topics.

### 3.2 Message key

The key is the **aggregate's id**: the UUID of the event, booking, request line, reservation or registration that the message is about.
- It's the same value as the envelope's `subject`, and the outbox's `message_key`.
- It puts every message about one aggregate on one partition, in order, which is what our invariants need.
- Never use a random key.

### 3.3 Envelope: CloudEvents 1.0

Every message is a **CloudEvents 1.0** event in structured mode:
- the whole event, attributes and `data`, is the JSON value of the Kafka message;
- the relay sets the Kafka header `content-type: application/cloudevents+json; charset=UTF-8`.

```jsonc
{
  "specversion":     "1.0",
  "id":              "018f2a6b-3c4d-4e5f-8a9b-0c1d2e3f4a5b", // UUID, unique per message; consumers deduplicate on it
  "source":          "/connectsphere/planning-core/event",    // /connectsphere/<service>[/<module>]
  "type":            "event.submitted",                       // selects the data schema
  "subject":         "6f1c2a4e-8b1d-4c3a-9e2f-1a2b3c4d5e6f",  // the aggregate's id = the message key
  "time":            "2026-10-03T08:31:22.104Z",              // when the state change committed
  "datacontenttype": "application/json",
  "correlationid":   "9b2e7c1a-5d3f-4a8b-9c0d-1e2f3a4b5c6d",  // extension
  "traceparent":     "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01", // extension
  "actor":           "EVENT_COORDINATOR:00000000-0000-0000-0000-000000000002",   // extension
  "data":            { }                                      // the payload schema for `type`
}
```

| Attribute | Rule |
|---|---|
| `specversion` | always `"1.0"` |
| `id` | a new UUID per message. Each consumer's inbox (§3.5) deduplicates on it. |
| `source` | `/connectsphere/<service>`, plus `/<module>` inside planning-core |
| `type` | `<aggregate>.<what-happened>`, e.g. `event.submitted`. It must be a key of `MESSAGE_DATA_SCHEMAS`. |
| `subject` | the aggregate's UUID, the same as the message key (§3.2) |
| `time` | RFC 3339 UTC with milliseconds: when the state change committed |
| `datacontenttype` | always `"application/json"` |
| `correlationid` | the request's `X-Correlation-Id`, propagated unchanged. Left out, not empty, when no request started it (e.g. a scheduled job). |
| `traceparent` | the W3C Trace Context of the span that made the change. Until ADR-0013's OpenTelemetry SDK is wired in, the producer starts a new trace for each request. |
| `actor` | `ROLE:userId` for a user, or `SYSTEM` for the scheduler. CloudEvents extensions must be strings, so it's one string. Use `formatActor` and `parseActor`. |
| `data` | the payload. Its schema is chosen by `type`. |

**Rules:**
- **Anything else is refused.** The schema is strict, so an extra attribute, such as the old camelCase `correlationId`, fails validation. A new extension needs a reviewed `contracts` PR. Its name must be lowercase letters and digits, at most 20 characters.
- **`data` carries the facts a consumer needs, not the whole aggregate.** Include ids and the changed values. Never put a JWT, password or full user record in it.
- **`data` fields are additive only.**
  - Removing or retyping a field is a breaking change. It needs a new `type` (e.g. `event.submitted.v2`) in a reviewed `contracts` PR.
  - From EN-05, the schema registry's compatibility check refuses a breaking change in CI.
- **Timestamps are RFC 3339 UTC with milliseconds,** in `time` and in `data`. Never local time, never epoch integers.
- **Every `type` has a zod schema in `MESSAGE_DATA_SCHEMAS`,** and an example message in `tests/cloudEvent.test.ts`. A type without both fails the contract test, and producing one fails review.
- **Producers validate before writing the outbox row, and consumers validate on receipt,** both with `parseCloudEvent`.
  - It checks the envelope, then the `data` for its `type`, and refuses an unknown type.
  - A message that fails validation won't succeed on a retry, so a consumer sends it straight to its dead-letter topic.

**From the old envelope.** The relay converts outbox rows written before CloudEvents, attribute by attribute:

| Old envelope | CloudEvents |
|---|---|
| `messageId` | `id` |
| `messageType` | `type` |
| `occurredAt` | `time` |
| `producer` (`event-service`) | `source` (`/connectsphere/planning-core/event`) |
| `correlationId` | `correlationid`, left out if null |
| `actor` `{ userId, role }` | `actor`, via `formatActor` |
| `aggregate.id` | `subject` |
| `payload` | `data` |
| none | `traceparent`: a new trace, since none was recorded |

Three old fields have no attribute:
- `schemaVersion`, because versioning is now by `type` and the registry;
- `aggregate.type`, because the topic gives it;
- `causationId`, which no producer ever set. If a consumer needs causation, propose a `causationid` extension.

### 3.4 Transactional outbox (required of every producer)

A domain event must exist if and only if its state change committed. Every module that produces has:

```sql
create table <schema>.outbox (
  id              uuid primary key default gen_random_uuid(),
  seq             bigint generated always as identity,  -- write order; the relay publishes by it
  topic           text        not null,  -- a KAFKA_TOPICS value
  message_key     text        not null,  -- the aggregate id = the envelope's subject
  envelope        jsonb       not null,  -- the CloudEvent, validated by parseCloudEvent
  created_at      timestamptz not null default now(),
  published_at    timestamptz,
  attempts        int         not null default 0,
  last_error      text
);
create index on <schema>.outbox (seq) where published_at is null;
```

**Writing:**
- **Write the outbox row inside the same transaction** as the state change. Never produce to Kafka from inside a request handler.
- **Validate it with `parseCloudEvent` first.** The event module's `writeOutbox` (`modules/event/events/outbox.ts`) is the example.
- **Export the table name from the module's `index.ts`** (e.g. `EVENT_OUTBOX_TABLE`), and add it to the relay's list in `src/index.ts`.

**Why `seq`, not `created_at`:**
- `created_at` is `now()`, the start of the writing transaction, so two rows from one transaction tie.
- A transaction that started first but waited for the aggregate's row lock stamps an earlier time than the one that committed before it, so `created_at` can put an aggregate's messages out of order.
- `seq` is assigned at insert, after that lock, so it follows the order of writes.

**Publishing: the relay** (`src/shared/outbox-relay.ts`, EN-04.2) runs inside planning-core whenever `KAFKA_*` is set. Each pass, for each outbox table, in one transaction, it:
1. **Takes the table's relay lock** (`pg_try_advisory_xact_lock`), or skips the table this pass if another relay holds it. One relay at a time per table keeps each aggregate's messages in order. `FOR UPDATE SKIP LOCKED` alone would stop two relays taking the same row, but a second relay could then publish an aggregate's later message while the first still held an earlier one.
2. **Claims up to 100 unpublished rows,** in `seq` order, `FOR UPDATE SKIP LOCKED`.
3. **Sets aside rows that can never publish:**
   - examples: an envelope that fails its schema, or an unknown topic;
   - it sets `last_error` to `unpublishable: <reason>` and counts the attempt;
   - it logs an error, and never selects that row again, so the row doesn't block the ones behind it;
   - to retry once the cause is fixed, clear `last_error`.
4. **Publishes the rest, one send per topic,** keyed by the aggregate id, in CloudEvents structured mode (§3.3). On success it sets `published_at`.
5. **A failed send** increments `attempts`, records `last_error`, and leaves the rows pending. The next pass retries them first, so nothing is lost while the broker is down. After a failure the relay backs off: 1 s, doubling, up to 30 s.

**More relay rules:**
- **It publishes inside the transaction, deliberately.** That's an exception to §11 rule 6: the row locks are what stop a second relay taking the same rows. kafkajs's request timeout bounds how long they're held.
- **It shuts down gracefully.** On SIGTERM it finishes the batch in flight before closing Kafka and the database.
- **Without `KAFKA_*`, planning-core runs without the relay,** and messages wait in the outbox.
- **It converts rows written before CloudEvents** using §3.3's mapping. The backlog that existed when the relay arrived was skipped by migration `event/0006` (team decision, 3 Oct 2026).
- **It's the fallback:** if EN-05's spike shows Supabase allows a logical replication slot, Debezium change data capture replaces it.

### 3.5 Consumers

At-least-once delivery means duplicates. Every consumer has an **inbox**:

```sql
create table <schema>.consumed_messages (
  message_id   uuid primary key,     -- the CloudEvent's id
  consumer     text        not null,
  consumed_at  timestamptz not null default now()
);
```

- **Insert the message's `id` in the same transaction as the side effect,** first, with `on conflict (message_id) do nothing`. No row back means the message was already handled, by this consumer or one racing it, so skip it. Consumers must be idempotent regardless.
- **Commit the Kafka offset only after that transaction commits.** With kafkajs's `eachMessage`, the offset is committed once the handler returns, so return only after the commit.
- **A message that fails validation** (not JSON, not a CloudEvent, data that fails its type's schema, or a type `contracts` doesn't know) goes straight to the consumer's dead-letter topic (`deadLetterTopic(<consumer>)`), unchanged, because a retry can't fix it. The next message is handled as normal.
- **A failure that may pass,** such as a database timeout, goes to the consumer's retry topic (`retryTopic(<consumer>)`), so it doesn't block the partition behind it.
  - **Retries:** a retry worker holds each message until it is due, heartbeating meanwhile, then handles it again.
  - **The policy (EN-04.3):** three retries, after 5 s, 30 s and 2 min, then the dead-letter topic.
- **Headers the consumer adds,** so a dead-lettered message can be replayed once the cause is fixed:
  - `connectsphere-attempt`: the retry count;
  - `connectsphere-not-before`: when the retry is due, in epoch milliseconds;
  - `connectsphere-original-topic`: where the message came from;
  - `connectsphere-error`: why it failed.
- **A failure to reach Kafka** while retrying or dead-lettering is thrown, not swallowed. The offset stays uncommitted and kafkajs delivers the message again.
- **A type no rule handles is acknowledged and skipped.** No inbox row is written, because there was no side effect.
- **Join the consumer groups named in §3.1.** A group seen for the first time starts at the newest message.
- **The example is the notification service** (`backend/services/notification`, EN-04.3). Its groups are `connectsphere.notification.event-notifier` and `connectsphere.notification.retry-worker`, plus `.<KAFKA_GROUP_SUFFIX>` on a laptop.

**Recipients come from the message.** A notification's recipients are the users the message names in their role on the event:
- the owner;
- the coordinator;
- the nominee;
- the coordinator who asked for clarification.

So a message must carry the ids of everyone its story says to notify (T2 AC2). The rules live in `notification/src/domain/recipients.ts`.

## 4. Database standards (mandatory)

### 4.1 Naming

- `snake_case` everywhere; tables plural (`booking_requests`), columns singular.
- Primary key is always `id uuid primary key default gen_random_uuid()`.
- Foreign keys **within** a schema: `<singular>_id`, with a real FK constraint.
- References **across** schemas: `<singular>_id uuid not null`, **no FK constraint**, and a comment naming the owning service.
- Booleans read as assertions: `is_active`, `has_registration`. Never `flag`, never `status_bool`.
- Enumerated values: `text` + `check (col in (...))`, not Postgres `enum` types (migrating an enum is painful). The permitted values live in `/backend/packages/contracts`.

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

What the criteria actually require is **linearizability per aggregate**: each individual slot, equipment unit or type, or event behaves as if operations on *it* happened one at a time. Each object below gets that from a constraint or a row lock, not from an isolation level (ADR-0006):

| Object | Story | What provides it |
|---|---|---|
| A venue slot (venue + period) | N1, L3, M1 | The `EXCLUDE USING gist` constraint. A single row insert, so linearizable by construction. |
| A venue, while a booking is approved or a block is created | M1, I2 | `SELECT … FOR UPDATE` on the venue row, taken first by both paths |
| A serialized equipment unit | Q1 | Per-unit `EXCLUDE USING gist` constraint on `unit_reservations` |
| An equipment type's bulk stock over a period | Q1, P2 | `SELECT … FOR UPDATE` on the equipment-type row, then a peak-concurrent-use check |
| An event's registration count | R2, R7 | Conditional `UPDATE` on one counter row today. Becomes seat rows under ADR-0005 (EN-13). |

This is why "never read-then-write on a contended resource" matters more than any isolation setting: the guarantee comes from a constraint or a lock taken before the read.

### 4.6 The concurrency invariants

These follow ADR-0006, and EN-02 implements them.

**Venue slot exclusivity** (N1, L3, M1): one hold *or* confirmed booking per venue and period.

```sql
create extension if not exists btree_gist;
alter table venue.venue_slots add constraint venue_slot_no_overlap
  exclude using gist (venue_id with =, blocked_period with &&)
  where (status in ('HELD','CONFIRMED'));
```

Model holds and confirmed bookings as rows in one table (`venue_slots`) so a single constraint covers both. Two concurrent inserts: exactly one succeeds, and the other raises `23P01`, which you translate into the refusal message naming the conflicting reference.

`blocked_period` is the **occupied period**, `[start − setup, end + turnaround)`, using the venue's setup and turnaround minutes. They were zero until the Week 7 change CR-01 (H3) made them per-venue settings; the column was designed for that, so it's a data change rather than a redesign. When a venue's buffers change, don't rewrite stored periods, because the constraint would reject new overlaps. Compute the would-be periods and flag the bookings that now conflict as Requires Reconfirmation (H3). Holds that pass their expiry become `EXPIRED` (L6, CR-04), which the constraint's `HELD`/`CONFIRMED` filter already ignores.

**As built (EN-02.1, `migrations/venue/0003_venue_slots_and_unavailability.sql`).** Stories that take or check a slot call these, in the venue module:
- `insertVenueSlot(tx, slot)` in `repo/slots.ts` inserts a HELD or CONFIRMED slot. Pass the venue's current setup and turnaround minutes; the slot keeps its own copy. An overlap comes back as `VenueSlotConflictError` (`VENUE_SLOT_CONFLICT`), naming every overlapped reference.
- `lockVenue(tx, venueId)` takes the venue row lock (rule 1 below). `insertVenueSlot` takes it too, before inserting (rule 4).
- `venue.unavailability_blocks` holds I2's blocks. A block is removed by setting its status to `REMOVED`.
- The status and reason values are in contracts (`VENUE_SLOT_STATUSES`, `UNAVAILABILITY_REASON_TYPES`).

**Four rules the constraint alone doesn't give you:**

1. **Approval and blocking take the venue row lock first (M1, I2).** M1 approving a booking and I2 recording a period of unavailability both start with `select … from venue.venues where id = $venue for update`. Without it, a block created during an approval can leave an unflagged confirmed booking overlapping the block. With it, the two serialise per venue: whichever runs second sees the other's result, and I2 flags the overlapping booking.
2. **Requires Reconfirmation is a flag, never a status.** Store it as `requires_reconfirmation boolean not null default false` on the slot. Keep the status CONFIRMED, so the flagged booking **keeps blocking its slot**. A status value outside `('HELD','CONFIRMED')` would silently free the slot for someone else.
3. **A converted hold stays HELD until decided (L3 → L1).** When L1 turns a hold into a booking request, the slot row keeps status HELD until M1 approves (→ CONFIRMED) or M2 rejects (→ RELEASED). Never release and then re-insert it, because that opens a window in which another hold can take the slot.
4. **Conflicting inserts queue on a row lock (EN-02.3).** Every slot insert takes the venue row lock first, and every equipment reservation takes its type's row lock. The exclusion constraints still decide. The lock is there because two conflicting inserts in flight at once can each wait for the other on the constraint, and Postgres then aborts one as a **deadlock (`40P01`)** instead of an overlap (`23P01`). The user would get a server error instead of the refusal. EN-02.3's race (ten rounds of fifty attempts) found this; with the locks, every loser meets an already committed winner and is refused cleanly.

**Equipment availability** (P1, P2, Q1): never over-reserve, **over a period**. The old design kept one `total`/`reserved` counter per equipment type with no time dimension, so it couldn't tell Friday 2–5 pm from Saturday. It's replaced by two mechanisms.

*Serialized units* (a projector, a microphone) are rows in `equipment.equipment_units`. A reservation claims specific units:

```sql
alter table equipment.unit_reservations add constraint unit_not_double_reserved
  exclude using gist (unit_id with =, period with &&)
  where (status = 'RESERVED');
```

Reserving five projectors picks five units that are free for the whole window. Choose a best fit that leaves the fewest gaps. If two reservations race for the same unit, the constraint rejects one, which retries with the next free unit or refuses with the shortfall.

*Bulk stock* (chairs, cables), which has no unit identity, takes the type row lock and then checks peak concurrent use inside the window:

```sql
-- 1. serialise reservations of this type
select total_quantity from equipment.equipment_types where id = $type for update;
-- 2. peak quantity already reserved at any instant inside [$start, $end)
--    (max over the reservation boundaries that fall in the window)
-- 3. insert only if total_quantity - peak - unavailable >= $qty
```

Steps 1 to 3 run in one transaction at `READ COMMITTED`. The row lock is what makes the check safe. Never check availability without taking that lock first.

**As built (EN-02.2, `migrations/equipment/0001_equipment_inventory.sql`).** P1, P2, Q1 and Q2 call these, in the equipment module's `repo/inventory.ts`:
- `reserveUnit(tx, …)` takes the type's row lock (rule 4 above), then claims one serialized unit. An overlap comes back as `UnitAlreadyReservedError`; Q1 then tries the next unit from `availableUnits(tx, typeId, period)`, or refuses with the shortfall.
- `reserveBulk(tx, …)` runs steps 1 to 3 above. A refusal is `InsufficientEquipmentError` (`INSUFFICIENT_EQUIPMENT`), carrying the requested, available and shortfall quantities.
- `peakUse(tx, typeId, period)` counts quantities recorded unavailable as in use. `lockEquipmentType(tx, typeId)` is the lock P2 takes before reducing a total.
- The formula itself is `peakConcurrentUse` in `domain/availability.ts`, the only place to change if CQ-02 is answered "summed overlaps".

**P1 is waiting on a customer answer (CQ-02, SPM-157).** P1's literal text subtracts every overlapping reservation added up, which counts back-to-back bookings as simultaneous. The design computes **peak concurrent use**, and it can switch to summed overlaps if the customer says so. Don't change P1's acceptance criteria until the answer is recorded in `documentation/clarifications.md`.

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

- Default `READ COMMITTED`. The patterns above are safe at that level because a constraint or a row lock taken first does the work.
- **P2** (refusing a total-quantity reduction below what is already reserved across overlapping periods) takes the same equipment-type row lock as a bulk reservation, then checks peak concurrent use. It no longer needs `SERIALIZABLE`.
- Use `SERIALIZABLE` only when an invariant spans rows you must read before writing **and** no constraint or row lock fits. Today one operation might qualify:
  - **R7:** a manual add weighed against registered plus manually added versus the ceiling, if those are kept as two counters. Preferred: seat rows with public and VIP pools (ADR-0005), which remove the need entirely.
- Handle `40001` by retrying once, then surfacing the error. Put a comment above any `SERIALIZABLE` transaction naming the invariant that forced it, so a reviewer can see it was deliberate.
- **F5's Confirmed transition is one core transaction** (ADR-0004). Venue, Equipment and Event are modules of `planning-core`, so F5:
  1. locks the event row;
  2. reads the booking and the reservations through their modules' public interfaces, in the same Postgres transaction;
  3. writes the transition.

  There is no HTTP call and no residual window. If an arrangement changes after confirmation, S3 flags the event. The earlier instruction to "re-verify both arrangements inside the writing transaction" contradicted the rule below, and it no longer applies.
- **Never** hold a transaction open across an HTTP call to another service. Under ADR-0004 there is no exception: cross-module reads inside the core are function calls, and the only remote calls are to the registration and notification services, which never happen inside a core transaction.
- Statement timeout: 5 s. Connection pool max 10 per service.

### 4.8 Migrations

Forward-only, numbered, one concern per file: `0007_add_venue_slots_exclusion.sql`. Never edit a merged migration. `migrate.ts` applies each file in its own transaction with a 5-second lock timeout and a 60-second statement timeout, so a migration that can't get its lock fails instead of stalling every query behind it. squawk checks new files in CI (§8.1). Seed data (internal staff accounts, venues, equipment types) lives in `/backend/services/<svc>/migrations/seed/` and is idempotent.

## 5. HTTP API conventions

- Base path `/api/v1/<resource>`; plural nouns; no verbs in paths.
- Status codes: `200` read, `201` create, `204` no content, `400` validation, `401` unauthenticated, `403` role/scope refusal, `404` not found *or* out of scope (never reveal existence), `409` invariant conflict (double-booking, capacity, duplicate), `422` valid shape but rejected by a business rule, `503` dependency unavailable (our CP refusal).
- **Every error uses this envelope:**

```jsonc
{
  "error": {
    "code": "BOOKING_SLOT_CONFLICT",      // SCREAMING_SNAKE, defined in /backend/packages/contracts
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
- **Status** is always a lozenge with a fixed colour per status. Define the map once in `frontend/src/shared/status.ts`; never inline a colour.
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
- **Status lozenge map** — `frontend/src/shared/status.ts`, one colour per event, booking, reservation and registration status. No inline colours anywhere.
- **App layout and empty/loading states** — page shell, list and detail skeletons, and the "no results, here are the filters you applied" empty state J1 requires.

The attendee shell (§7.2) is separate. It is built in Sprint 3 as part of EN-13 (the registration service and the attendee PWA shell), and R1 moved to Sprint 4 on 1 Oct 2026 to build on it. See `plan.md` §9.1.

## 8. Testing and the sprint test kit

### 8.1 Levels

| Level | Tool | What it covers |
|---|---|---|
| Unit | Vitest | `/domain` — pure rules: overlap, validation, status transitions, capacity maths. Fast, no DB. |
| Integration | Vitest + real Postgres | `/repo` and the concurrency invariants. **The exclusion constraint and both conditional updates must each have a test that fires two operations concurrently and asserts exactly one wins.** |
| Contract | Vitest | Every produced event validates against its `/backend/packages/contracts` schema; every consumer handles a duplicate message `id` without a second side effect. |
| E2E | Playwright | Full user flows through the SPA against the running stack (`npm run dev`, which Playwright's `webServer` setting can start). |

**Target: 100% coverage of `/domain`,** and where it isn't reachable, a comment in the test file saying why. The rubric asks for exactly this.

**What CI runs (SPM-114).** `.github/workflows/ci.yml` runs `npm run lint` (ESLint and the module boundary checks), `typecheck`, `build` and `test:unit` on every pull request and every push to `main`. A test counts as a unit test when it sits under a `domain/` or `boundaries/` folder, or is named `*.unit.test.ts`. It must not touch a database, because that job gives it only placeholder credentials.

**Integration tests in CI (EN-06.1).** A second job, `Integration tests (throwaway Postgres)`, runs every test that needs a database:
- It starts a `postgres:17` service container that lives only as long as the job, and refuses to run if `DATABASE_URL` points anywhere but the runner itself. CI never uses the shared database.
- `npm run migrate:all` builds every schema from nothing, in the order set in `backend/scripts/migrate.ts`, with the identity seeds. **A new module or service must be added to that list**, or CI won't create its tables.
- It then runs `npm test` for planning-core and notification. Supabase and Kafka are placeholders that reach nothing: the tests stub token checks, and the relay tests use a fake publisher.

A test that only passes against data already sitting in the shared database fails here, which is the point. Create what a test needs inside the test, or in a seed file.

**Security and migration checks (EN-06.3).**
- **squawk** lints the migration files a pull request adds or changes, and fails the build on a risky schema change such as dropping a column or table, changing a column's type, or adding a constraint that scans a full table. `.squawk.toml` lists the rules turned off and why. Run it yourself with `npx squawk-cli@2.67.0 <file>`. A change squawk flags that you really mean can be allowed with a `-- squawk-ignore <rule>` comment above the statement, plus a reason, so a reviewer sees it.
- **gitleaks** scans the whole git history on every push and pull request, so a secret committed and later deleted still fails the build. **If it fires, deleting the file is not enough: rotate the secret.**
- **CodeQL** (`.github/workflows/codeql.yml`) scans the JavaScript and TypeScript on every pull request, on `main`, and weekly. Findings appear in the repository's Security tab.

**Coverage (SPM-116).** `test:unit` measures coverage with Vitest's v8 provider, and each workspace's Vitest config sets thresholds that fail the build:
- **`src/**/domain/**` must stay at 100%** of lines, branches, functions and statements, in line with the target above. If a line genuinely can't be covered, say why in a comment in the test file; never lower the threshold.
- **Everything else has a floor** just under today's unit-only figures. Raise a floor when coverage rises; never lower one to get a build through.

CI shows a coverage table in the job summary and uploads the HTML reports as the `coverage-reports` artifact.

### 8.2 The sprint test kit — build it *before* the sprint

At sprint planning, before any story is started, the sprint owner creates `/tests/flows/sprint-<n>/` with the first three files, and `/documentation/traceability/sprint-<n>.csv`:

1. **`flow.md`** — the end-to-end journey the sprint must demonstrate, written as numbered steps with the expected observable outcome at each. Derived from the sprint's stories, not invented.
2. **`seed.sql`** — idempotent fixture data for that flow (staff accounts, venues, equipment, an attendee).
3. **`flow.spec.ts`** — a Playwright test that walks `flow.md` start to finish and fails loudly at the first divergence.
4. **`sprint-<n>.csv`** (the traceability file) — `story_id, acceptance_criterion, test_file, test_name`, one row per AC. This *is* deliverable 3.

The flow test goes red on day one and must be green before the sprint review. It is the sprint's definition of done at the system level, and it catches integration breakage between six people's services on the day it happens rather than in Week 12.

### 8.3 Definition of Done (applies to every story)

- Code merged to `main` via pull request with at least one peer review.
- Unit tests for the story's logic, and at least one integration or e2e test per acceptance criterion that spans layers.
- CI pipeline green: build, lint, typecheck, test.
- All acceptance criteria demonstrated to the Product Owner in the sprint review.
- No new failing tests; existing tests still pass.
- Story traced to its tests in `documentation/traceability/sprint-<n>.csv`.
- Functional test cases written for the story in `/tests/<story-id>/` (§8.4), each with a latest execution record, and every acceptance criterion covered by at least one of them.
- Any new event type registered in `/backend/packages/contracts` with a schema and a validator.

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

All config from environment variables, documented in `.env.example`. No secrets in the repo, no `localhost` in code. Required per service: `PORT`, `DATABASE_URL`, `DATABASE_SCHEMA`, `KAFKA_BROKERS`, `KAFKA_SASL_MECHANISM`, `KAFKA_SASL_USERNAME`, `KAFKA_SASL_PASSWORD`, `KAFKA_SSL_CA_PATH` (Aiven only), `KAFKA_GROUP_SUFFIX` (laptops only), `NOTIFICATION_PORT` and, if planning-core runs elsewhere, `PLANNING_CORE_URL` (notification only), `SUPABASE_URL`, `SUPABASE_JWKS_URL`, `SERVICE_NAME`, `LOG_LEVEL`, `INTERNAL_TOKEN_SECRET`.

Cloud-readiness rules to follow now so the move is boring later: services are stateless (no in-process cache, no local disk writes, sessions in the token); health endpoints `/healthz` (liveness) and `/readyz` (readiness: it requires the database and reports whether the Kafka broker is reachable, without requiring it, because the outbox holds messages while Kafka is down; §3.4); graceful shutdown drains in-flight requests, lets the outbox relay finish its batch, and commits Kafka offsets; every service can run from its build (`npm run build`, then `npm run start -w <service>`), and `npm run dev` is for local work only. There is no Docker (ADR-0003): a deployment platform builds each service from its `package.json`.

## 11. Rules for coding agents

Each of us is running Claude Code against a shared repo. These exist to stop six agents producing six incompatible interpretations.

1. **Read `plan.md` §4–§6 and this document's §3 and §4 before writing code.** They contain the contracts the rest of the team depends on.
2. **Stay inside your own module, its migrations and its tests.** Do not "helpfully" fix another module; `npm run lint:boundaries` fails if you reach into one (§2).
3. **Do not invent fields, event types, error codes, status values, or endpoints.** If the story needs one that isn't in `/backend/packages/contracts`, stop, propose it to the team, add it in a reviewed PR.
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
- Whether waitlist invitations expire (customer left it open).
- Whether a rejected event can be revived (customer left it to us; currently terminal).
