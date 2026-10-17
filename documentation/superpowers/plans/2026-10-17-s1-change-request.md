# S1 — Request a Change After Submission: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owning organiser requests a change to an event's significant fields with a reason; the request is stored Pending with a snapshot of the current values, one pending request per event, and the assigned coordinator is notified (SPM-57).

**Architecture:** The change module gets its first schema (`change.change_requests`, `change.change_request_fields`, `change.outbox`), routes, and auth. It reads the event and checks proposed values only through `event/index.ts`, which reuses B2's `validateSubmission`. The notice goes on the event topic as `change-request.submitted`; the notification service gains one rule.

**Tech Stack:** TypeScript, Express, porsager `postgres`, zod, Vitest + supertest, React + Atlaskit.

**Spec:** `documentation/superpowers/specs/2026-10-17-s1-change-request-design.md`. **Branch:** `feature-raphael/s1-change-request` (from `main`).

---

## Ground rules for every task

- Read `CLAUDE.md` and `documentation/planning/implementation.md` first. `PC` = `backend/services/planning-core`.
- **Never** run migrations or writes against the shared Supabase database, never point race tests at it, never read `.env`. Integration tests needing `change/0001` run only in CI's throwaway Postgres.
- Unit tests locally: in zsh, `export DATABASE_URL=postgres://ci:ci@127.0.0.1:1/ci_unused SUPABASE_URL=https://ci.invalid SUPABASE_ANON_KEY=ci-placeholder SUPABASE_JWKS_URL=https://ci.invalid/auth/v1/.well-known/jwks.json` then `npm run test:unit` in `PC` (do not use `env $VAR` — zsh won't split it).
- Before each commit: `npm run lint && npm run lint:boundaries && npm run typecheck` (root). Type-check new test files ad hoc with a temporary tsconfig and delete it.
- Conventional Commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Patterns to copy: the equipment module (Q1/Q2) — `auth/actor.ts`, `auth/identity.ts`, `api/errors.ts`, `events/outbox.ts`, `api/reservations.ts`, `tests/equipment/api/q1Cards.test.ts`; the event module's `domain/validation.ts`.

## File map

| File | Responsibility |
|---|---|
| `tests/S1/README.md`, `tests/S1/S1-T*.md` | 13 cards, FX-S1 |
| `backend/packages/contracts/src/errorCodes.ts`, OpenAPI `ErrorCode` | `EVENT_NOT_CHANGEABLE`, `CHANGE_REQUEST_ALREADY_PENDING` |
| `backend/packages/contracts/src/changeRequestEvents.ts` (new), `cloudEvent.ts`, `index.ts` | `change-request.submitted` payload, registered in `MESSAGE_DATA_SCHEMAS` |
| `backend/services/notification/src/domain/recipients.ts` (+ tests) | the coordinator's notice |
| `PC/migrations/change/0001_change_requests.sql` | schema, tables, outbox |
| `PC/src/index.ts` | relay includes `change.outbox` |
| `PC/src/modules/event/domain/proposedChange.ts` (new), `event/repo/events.ts`, `event/index.ts` | `findEventForChange`, `checkProposedChange` |
| `PC/src/modules/change/domain/changeRequests.ts` | statuses, field labels, body rules |
| `PC/src/modules/change/auth/{actor,identity}.ts`, `api/errors.ts`, `api/limiter.ts` | as the equipment module's |
| `PC/src/modules/change/repo/changeRequests.ts` | insert, read pending, list |
| `PC/src/modules/change/events/outbox.ts` | writer for `change.outbox` |
| `PC/src/modules/change/api/changeRequests.ts`, `index.ts`, `PC/src/app.ts` | routes; `changeRouter(sql)` |
| tests | unit, repo, cards, race |
| frontend `api/changeRequests.ts`, `screens/RequestDetail.tsx`, `screens/ReviewDetail.tsx` + tests | the form and the pending notice |

---

### Task 1: Cards (before any code)

**Files:** `tests/S1/README.md` and 13 cards in exactly the layout of `tests/Q1/README.md` and `tests/Q1/Q1-T1-reserve-bulk-line.md`.

- [ ] **Step 1: README** — isolated throwaway-Postgres setup as Q1's; fixture **FX-S1**: actors ORG (organiser, owner), ORG2 (organiser), C1 (coordinator assigned to E1), TS, VS; event E1 owned by ORG, status Approved, assigned C1, proposed `D 14:00`–`D 18:00` UTC (D sixty days ahead), expected attendance 150, equipment required false, venue and equipment requirements null. Run command `npm test -w @connectsphere/planning-core -- tests/change/api/s1Cards.test.ts -t 'S1-Tn '`; race in `tests/race/invariants.test.ts` (CI only); S1-T13 manual.

- [ ] **Step 2: Cards.** API calls are `POST /api/v1/events/<E1>/change-requests` as ORG unless stated; `D+1m` means one minute after the moment of the request.

| File | Pre-conditions (after FX-S1) | Body / action | Expected result |
|---|---|---|---|
| `S1-T1-request-records-snapshot.md` | — | `{"reason":"Keynote speaker arrives late","changes":{"proposedStartAt":"D 15:00","expectedAttendance":180}}` | 201: status PENDING, reason, requestedBy ORG, requestedAt between the instants around the request, fields `proposedStartAt` (current `D 14:00`, proposed `D 15:00`) and `expectedAttendance` (current 150, proposed 180). `GET /api/v1/events/<E1>` still shows `D 14:00` and 150. |
| `S1-T2-allowed-statuses.md` | Seven events like E1 in Submitted, Under Review, Awaiting Clarification, Approved, Planning, Safety Review, Confirmed | `{"reason":"x","changes":{"expectedAttendance":160}}` each | 201 each. |
| `S1-T3-refused-statuses.md` | Four events like E1 in Draft, Completed, Cancelled, Rejected | as T2 | 409 `EVENT_NOT_CHANGEABLE` each, message naming the status label, `details.status` the code; no `change.change_requests` row for them. |
| `S1-T4-second-pending-refused.md` | T1's request pending | `{"reason":"Also more people","changes":{"expectedAttendance":200}}` | 409 `CHANGE_REQUEST_ALREADY_PENDING`; message names the existing request's time; `details` has its id, requestedAt and fields `["proposedStartAt","expectedAttendance"]`. Still exactly one request for E1. |
| `S1-T5-reason-required.md` | — | changes as T1 with no reason; `"reason":""`; `"reason":"   "` | 400 `VALIDATION_FAILED` with field `reason` each; nothing stored. |
| `S1-T6-proposed-values-checked.md` | — | (a) start yesterday; (b) end `D 13:00` with start `D 14:00` kept; (c) start `D 19:00` alone (after the current end); (d) attendance 0; (e) attendance 2.5; (f) start yesterday **and** attendance 0 | Each 400 `VALIDATION_FAILED`: (a) `proposedStartAt`; (b) `proposedEndAt`; (c) `proposedEndAt`; (d), (e) `expectedAttendance`; (f) both fields named. Nothing stored. |
| `S1-T7-only-significant-fields.md` | — | `{"reason":"x","changes":{"purpose":"New"}}`; `{"reason":"x","changes":{}}`; no `changes` | 400 `VALIDATION_FAILED`: `changes.purpose` ("Change this through Edit details."), `changes` ("Propose at least one change.") twice; nothing stored. |
| `S1-T8-boundaries-accepted.md` | — | (a) attendance 1; (b) start `D+1m`-style: now + 1 minute with end now + 2 hours, in a fresh FX-S1 | 201 each. |
| `S1-T9-coordinator-notified.md` | — | T1's request | One `change-request.submitted` message in `change.outbox` keyed by E1 on the event topic, data naming E1's reference, C1, the request id and fields `["proposedStartAt","expectedAttendance"]`; through the notification service's recipient rule, one notification for C1 whose text contains E1's reference, "start" and "expected attendance". |
| `S1-T10-roles-and-scope.md` | — | as ORG2, C1, TS, VS; then as ORG on an unknown event id | 403 `ROLE_NOT_AUTHORISED` (ORG2 gets 403 because organisers only see their own events: if the scope rule hides E1 from ORG2, 404 `EVENT_NOT_FOUND` — the card states whichever the A3 scope rule gives and the test pins it); unknown id 404 `EVENT_NOT_FOUND`; nothing stored. |
| `S1-T11-pending-request-listed.md` | T1's request | `GET /api/v1/events/<E1>/change-requests` as ORG, then as C1 | 200 each, `items` has the one request with its fields, snapshots and PENDING; `GET /api/v1/events/<E1>` still shows the old values. |
| `S1-T12-requirements-shapes.md` | — | (a) a valid `venueRequirements` object and `equipmentRequired: true` with one valid `equipmentRequirements` line; (b) `venueRequirements: "big room"` | (a) 201 with both snapshots null and the proposed values echoed; (b) 400 on `changes.venueRequirements`. |
| `S1-T13-request-in-the-browser.md` | Standard environment, `KAFKA_*`, migrations applied; an Approved request of `organiser@connectsphere.test` | Browser: as organiser → the request → "Request a change" → "Send request" without changes → change attendance to 180, leave Reason empty → "Send request" → enter `More people registered` → "Send request"; as the assigned coordinator → Notifications → the request | Unchanged form says no change was made; empty reason refused inline; then the page shows "Change requested on … : expected attendance (Pending)" and no "Request a change" button; the coordinator has a notification naming the request and the same pending notice. |

Write S1-T10's expected result after checking A3's organiser scope in `backend/packages/contracts/src/accessScope.ts` (`resolveAccessScope`) and how `findEventInScope` applies it: state the one outcome it gives for ORG2.

Created By `Raphael, via Claude`, Date `2026-10-17`, the PR-reviewer note.

- [ ] **Step 3:** commit `test(s1): write the S1 cards and fixture FX-S1 before the code`.
- [ ] **Step 4: STOP — show Raphael the cards and wait for approval.**

---

### Task 2: Contracts and the notification rule

- [ ] **Step 1: Error codes.** In `ERROR_CODES` append `"EVENT_NOT_CHANGEABLE", "CHANGE_REQUEST_ALREADY_PENDING",` at the end; same at the end of the OpenAPI `ErrorCode` enum (`PC/tests/api/openapiRoutes.unit.test.ts` holds them equal and in order).
- [ ] **Step 2: Message type.** Create `backend/packages/contracts/src/changeRequestEvents.ts`:

```ts
import { z } from "zod";
import { SIGNIFICANT_EVENT_FIELDS } from "./eventFields.js";

/**
 * S1 — the change module's messages. They go on the event topic, keyed by the
 * event id, so every message about one event stays in order (S1 spec,
 * decision 3).
 */
export const changeRequestSubmittedPayloadSchema = z.object({
  eventId: z.string().uuid(),
  eventReference: z.string(),
  eventName: z.string(),
  coordinatorId: z.string().uuid(),
  changeRequestId: z.string().uuid(),
  fields: z.array(z.enum(SIGNIFICANT_EVENT_FIELDS)).min(1),
  requestedBy: z.string().uuid(),
  requestedAt: z.string().datetime(),
});

export const CHANGE_REQUEST_PAYLOAD_SCHEMAS = {
  "change-request.submitted": changeRequestSubmittedPayloadSchema,
} as const;

export type ChangeRequestMessageType = keyof typeof CHANGE_REQUEST_PAYLOAD_SCHEMAS;

/** How each significant field is named to people (form labels, notifications). */
export const SIGNIFICANT_FIELD_LABELS: Record<(typeof SIGNIFICANT_EVENT_FIELDS)[number], string> = {
  proposedStartAt: "start",
  proposedEndAt: "end",
  expectedAttendance: "expected attendance",
  venueRequirements: "venue requirements",
  equipmentRequired: "whether equipment is required",
  equipmentRequirements: "equipment requirements",
};
```

Register it in `cloudEvent.ts`: `MESSAGE_DATA_SCHEMAS = { ...EVENT_PAYLOAD_SCHEMAS, ...EQUIPMENT_REQUEST_PAYLOAD_SCHEMAS, ...CHANGE_REQUEST_PAYLOAD_SCHEMAS }`, and export the new module from `index.ts`. Add a contracts test (beside the existing ones in `backend/packages/contracts/tests/`) that `parseCloudEvent` accepts a valid `change-request.submitted` envelope and refuses one with `fields: []`.

- [ ] **Step 3: Notification rule.** In `backend/services/notification/src/domain/recipients.ts` `RULES`, add:

```ts
  // S1: the assigned coordinator hears that the organiser asked to change the event.
  "change-request.submitted": (d, event) => [
    [
      d.coordinatorId!,
      `A change has been requested for ${event}: ${joinLabels((d as unknown as { fields: string[] }).fields)}.`,
    ],
  ],
```

with a helper `joinLabels(fields)` mapping through `SIGNIFICANT_FIELD_LABELS` and joining with ", ". Match how the other rules build `event` (reference and name). Add a `recipients.test.ts` case: fields `["proposedStartAt","expectedAttendance"]` → one notification for the coordinator containing the reference, "start, expected attendance". If the consumer only routes known types, check `consumer/` accepts the new type on the event topic (it reads `MESSAGE_DATA_SCHEMAS`).

- [ ] **Step 4:** build contracts, `npm run lint:api`, planning-core unit suite, notification unit suite (`npx vitest run --config vitest.unit.config.ts` in `backend/services/notification`, env exported), contracts tests. Commit `feat(s1): change-request codes, message and notification`.

---

### Task 3: Migration and relay

- [ ] **Step 1:** `PC/migrations/change/0001_change_requests.sql`:

```sql
-- S1 (SPM-57): the change module's first schema. An organiser's request to
-- change an event's significant fields, with the reason and a snapshot of each
-- field's value when the request was made. The event itself is not changed
-- here; S2 applies an approved request. One pending request per event.
create schema if not exists change;

create table change.change_requests (
  id               uuid primary key default gen_random_uuid(),
  -- event.events.id and its reference, owned by the event module: no FK across schemas (§4.1).
  event_id         uuid        not null,
  event_reference  text        not null check (length(btrim(event_reference)) > 0),
  requested_by     uuid        not null,
  requested_at     timestamptz not null default clock_timestamp(),
  reason           text        not null check (length(btrim(reason)) > 0),
  status           text        not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);

create unique index change_requests_one_pending_per_event
  on change.change_requests (event_id) where (status = 'PENDING');
create index change_requests_event_idx on change.change_requests (event_id, requested_at desc);

create table change.change_request_fields (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid  not null references change.change_requests (id),
  field_name      text  not null check (field_name in (
                    'proposedStartAt', 'proposedEndAt', 'expectedAttendance',
                    'venueRequirements', 'equipmentRequired', 'equipmentRequirements')),
  -- The event's value when the request was made (AC3), and the value proposed. JSON null is a real value.
  current_value   jsonb not null,
  proposed_value  jsonb not null,
  constraint change_request_fields_once unique (request_id, field_name)
);

-- Transactional outbox (implementation.md §3.4), the same shape as event.outbox.
create table change.outbox (
  id           uuid primary key default gen_random_uuid(),
  seq          bigint generated always as identity,
  topic        text        not null,
  message_key  text        not null,
  envelope     jsonb       not null,
  created_at   timestamptz not null default now(),
  published_at timestamptz,
  attempts     int         not null default 0,
  last_error   text
);

create index change_outbox_pending_seq_idx on change.outbox (seq) where published_at is null;
```

Add a boundary test `PC/tests/boundaries/changeFields.test.ts` (unit config includes `tests/boundaries/**`) that reads this file and asserts the check's field list equals `SIGNIFICANT_EVENT_FIELDS` (copy the approach of `tests/boundaries/eventValues.test.ts`).

- [ ] **Step 2: Relay.** In `PC/src/index.ts` add `CHANGE_OUTBOX_TABLE` (exported from `change/index.ts`, defined in `change/events/outbox.ts` in Task 5 — define the constant now in `change/events/outbox.ts` as `export const CHANGE_OUTBOX_TABLE = "change.outbox";`) to the relay's `tables` and its log line.
- [ ] **Step 3:** squawk the migration (`npx --yes squawk-cli@2.67.0 …`), typecheck, lint, unit suite. Do not run it. Commit `feat(s1): change schema, request tables and outbox`.

---

### Task 4: Event module — read and check

**Files:** create `PC/src/modules/event/domain/proposedChange.ts`, test `PC/tests/event/domain/proposedChange.test.ts`; modify `event/repo/events.ts` (if the needed columns aren't already read), `event/index.ts`.

- [ ] **Step 1: Failing unit tests** (pure; `now` fixed at `2026-11-01T00:00:00Z`; current event `{ name:"N", purpose:"P", description:"D", proposedStartAt:"2026-12-02T14:00:00.000Z", proposedEndAt:"2026-12-02T18:00:00.000Z", expectedAttendance:150, registrationRequired:false, registrationOpensAt:null, registrationClosesAt:null, equipmentRequired:false, venueRequirements:null, equipmentRequirements:null }`):
  - start moved to 15:00 → `[]`;
  - start yesterday → one error on `proposedStartAt`;
  - end 13:00 → error on `proposedEndAt`;
  - start 19:00 alone → error on `proposedEndAt` (the current end is now before the start);
  - attendance 0 and 2.5 → error on `expectedAttendance`;
  - start yesterday and attendance 0 → both;
  - attendance 1 → `[]`;
  - `venueRequirements: "big room"` → error on `venueRequirements`; a valid object → `[]`;
  - `equipmentRequirements` invalid line → error on `equipmentRequirements`;
  - an error B2 would raise on an untouched field (e.g. current purpose empty) is **not** reported.
- [ ] **Step 2: Implement** `proposedChange.ts`:

```ts
import { equipmentRequirementsSchema, venueRequirementsSchema, type SignificantEventField } from "@connectsphere/contracts";
import { validateSubmission, type FieldError, type SubmissionCandidate } from "./validation.js";

/**
 * S1 — checks proposed values for an event's significant fields against B2's
 * rules, on the event as it would be after the change. Only errors the change
 * is responsible for are reported: those on a proposed field, and on the start
 * or end when either of them moves (an end left before a moved start).
 */
export interface ChangeableEvent extends SubmissionCandidate {
  venueRequirements: unknown;
  equipmentRequirements: unknown;
}

export type ProposedChanges = Partial<Record<SignificantEventField, unknown>>;

export function checkProposedChange(current: ChangeableEvent, changes: ProposedChanges, now: Date = new Date()): FieldError[] {
  const errors: FieldError[] = [];
  const merged = { ...current, ...changes } as SubmissionCandidate;

  const touched = new Set<string>(Object.keys(changes));
  if (touched.has("proposedStartAt") || touched.has("proposedEndAt")) {
    touched.add("proposedStartAt");
    touched.add("proposedEndAt");
  }
  for (const error of validateSubmission(merged, now)) {
    if (touched.has(error.field)) errors.push(error);
  }

  if ("venueRequirements" in changes && changes.venueRequirements !== null) {
    const parsed = venueRequirementsSchema.safeParse(changes.venueRequirements);
    if (!parsed.success) errors.push({ field: "venueRequirements", message: "Venue requirements are not in the expected form." });
  }
  if ("equipmentRequirements" in changes && changes.equipmentRequirements !== null) {
    const parsed = equipmentRequirementsSchema.safeParse(changes.equipmentRequirements);
    if (!parsed.success) errors.push({ field: "equipmentRequirements", message: "Equipment requirements are not in the expected form." });
  }
  return errors;
}
```

A moved start that is valid but whose untouched end is now before it reports on `proposedEndAt` — that falls out of `touched` including both. Type-mismatched values (e.g. attendance `"many"`) must not throw: `validateSubmission` treats non-numbers as failing `Number.isInteger`; dates that aren't strings — guard by converting non-string start/end to `"invalid"` before merging, and add a unit test for `proposedStartAt: 5`.

- [ ] **Step 3: Read path.** Export from `event/index.ts`:

```ts
/** S1 — what the change module needs to check and snapshot a change request. */
export interface EventForChange {
  id: string;
  reference: string | null;
  name: string;
  status: EventStatus;
  ownerId: string;
  assignedCoordinatorId: string | null;
  current: ChangeableEvent;
}

export async function findEventForChange(sql: Sql, eventId: string, scope: AccessScope, callerId: string): Promise<EventForChange | null>;
export { checkProposedChange, type ChangeableEvent, type ProposedChanges } from "./domain/proposedChange.js";
```

Build it from `findEventInScope` (repo/events.ts). If that record lacks purpose, description, the registration fields or requirements, add them to the select there (read-only change). `current` holds every `SubmissionCandidate` field plus the two requirements.

- [ ] **Step 4:** unit suite with coverage (domain 100%), typecheck, lint, boundaries. Commit `feat(s1): the event module checks a proposed change`.

---

### Task 5: Change module

**Files:** `change/domain/changeRequests.ts`, `change/auth/actor.ts`, `change/auth/identity.ts`, `change/api/errors.ts`, `change/api/limiter.ts`, `change/repo/changeRequests.ts`, `change/events/outbox.ts`, `change/api/changeRequests.ts`, `change/index.ts`, `PC/src/app.ts`; tests `PC/tests/change/domain/changeRequests.test.ts`, `PC/tests/change/repo/changeRequests.test.ts`.

- [ ] **Step 1: Domain (TDD, 100%).** `CHANGEABLE_STATUSES = ["SUBMITTED","UNDER_REVIEW","AWAITING_CLARIFICATION","APPROVED","PLANNING","SAFETY_REVIEW","CONFIRMED"]` (as `EventStatus[]`), `isChangeable(status)`, `notChangeableMessage(status)` ("A change can be requested only once the event is submitted and while it is still going ahead. It is <label>."), and:

```ts
export function validateChangeBody(raw: unknown):
  | { ok: true; reason: string; changes: ProposedChanges }
  | { ok: false; fields: ErrorField[] }
```

Rules: reason a string, trimmed non-empty, ≤ 1000 (`reason`: "Give a reason for the change."); `changes` a plain object (`changes`: "Propose at least one change." when missing, not an object, or empty); each key not in `SIGNIFICANT_EVENT_FIELDS` → `changes.<key>`: "Change this through Edit details." for the four G1 detail fields (`purpose`, `description`, `accessibilityNeeds`, `contactDetails`) and "This field can't be changed." otherwise. Report every problem. Unit-test each rule including all-at-once.

- [ ] **Step 2: Auth, errors, limiter.** Copy the equipment module's `auth/actor.ts`, `auth/identity.ts`, `api/errors.ts`, `api/limiter.ts` into `change/`, changing only names/comments (the boundary lint forbids importing another module's internals). If an identical shared version exists under `src/shared/`, use that instead.

- [ ] **Step 3: Outbox writer** `change/events/outbox.ts`: copy `event/events/outbox.ts`'s `writeOutbox`, with `CHANGE_OUTBOX_TABLE = "change.outbox"`, `CHANGE_SOURCE = "/connectsphere/planning-core/change"`, `messageType: ChangeRequestMessageType`, inserting into `change.outbox`.

- [ ] **Step 4: Repo** `change/repo/changeRequests.ts`:

```ts
export interface ChangeRequestRecord {
  id: string;
  eventId: string;
  eventReference: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  requestedBy: string;
  requestedAt: string;
  fields: { fieldName: SignificantEventField; currentValue: unknown; proposedValue: unknown }[];
}

export class ChangeRequestAlreadyPendingError extends Error {
  constructor(readonly existing: ChangeRequestRecord) { super("A change request is already pending for this event."); }
}

/** Inserts the request and its fields; the partial unique index refuses a second pending one (AC5). */
export async function insertChangeRequest(tx, input: { event: { id; reference }, reason, changes: ProposedChanges, current: Record<string, unknown>, actorId }): Promise<ChangeRequestRecord>;
export async function findPendingForEvent(db, eventId): Promise<ChangeRequestRecord | null>;
export async function listForEvent(db, eventId): Promise<ChangeRequestRecord[]>; // newest first
```

`insertChangeRequest` runs the request insert in `tx.savepoint`; on Postgres `23505` with constraint `change_requests_one_pending_per_event` it reads `findPendingForEvent(tx, …)` and throws `ChangeRequestAlreadyPendingError`. Field rows store `current_value = tx.json(current[field] ?? null)`, `proposed_value = tx.json(changes[field] ?? null)`; when reading, map JSON back (`null` stays `null`). Repo tests (CI only): insert + read back with snapshots; a second insert for the same event throws `ChangeRequestAlreadyPendingError` with the first request; `listForEvent` order.

- [ ] **Step 5: Route** `change/api/changeRequests.ts`:
  - `POST /api/v1/events/:id/change-requests`: limiter, `authenticate`, `requireRole("EVENT_ORGANISER")`; non-UUID id → 404 `EVENT_NOT_FOUND`; `findEventForChange` with `resolveAccessScope(role, userId, "events")` (from identity's index, as `api/requestLines.ts` does) → null → 404; `ownerId !== actor` → 403 `ROLE_NOT_AUTHORISED` ("Only the event's organiser can request a change."); `validateChangeBody` → 400; `!isChangeable` → 409 `EVENT_NOT_CHANGEABLE` with `{ status }`; `checkProposedChange(event.current, changes)` → 400 with fields renamed to `changes.<field>`; then `sql.begin`: `insertChangeRequest`, and when `assignedCoordinatorId` and `reference` exist, `writeOutbox` `change-request.submitted` on `KAFKA_TOPICS.event` keyed by the event id. Catch `ChangeRequestAlreadyPendingError` outside `begin` → 409 `CHANGE_REQUEST_ALREADY_PENDING`, message "A change request for this event is already pending, made on <requestedAt>.", `details: { id, requestedAt, fields: [names] }`. 201 with the record.
  - `GET /api/v1/events/:id/change-requests`: limiter, `authenticate` (any role); scope via `findEventForChange` → 404; 200 `{ items: listForEvent }`.
  - Every refusal before the insert stores nothing (AC7); the event row is never written (AC4).
- [ ] **Step 6: Mount.** `change/index.ts`: `changeRouter(sql: Sql)` uses the router; export `CHANGE_OUTBOX_TABLE`. `PC/src/app.ts`: `app.use(changeRouter(sql))`. Check route order: event's `eventsRouter` has `/api/v1/events/:id`, which matches only that exact path, so `/api/v1/events/:id/change-requests` reaches the change router — confirm with the card tests in Task 6.
- [ ] **Step 7:** typecheck, lint, boundaries, unit suite. Commit `feat(s1): request a change to an event`.

---

### Task 6: Card tests and the race

- [ ] **Step 1:** `PC/tests/change/api/s1Cards.test.ts`: setup copied from `tests/equipment/api/q1Cards.test.ts` but mocking `../../../src/modules/change/auth/identity.js`; actor prefix `0c100000`; FX-S1 via `seedEvent` (tests/support/seedEvent.ts) with status Approved and an assignment row for C1 (see `createEvent` in `tests/support/lineFixtures.ts`), setting attendance 150 and the window; extra events for T2/T3 via `seedEvent` with each status. Cleanup: delete `change.outbox` rows keyed by the fixture events, `change_request_fields`, `change_requests` for those events, then `deleteSeededEvents`. One `it("S1-Tn …")` per card T1–T12, asserting each card's Expected Result exactly; T9 runs the stored envelope through `parseCloudEvent` and `notificationsFor` as Q1-T10 does.
- [ ] **Step 2:** Race in `tests/race/invariants.test.ts` (inside the throwaway-only describe, cleaned up in `finally`): per round one Approved event, then `race(ATTEMPTS, (tx) => insertChangeRequest(tx, …))`; exactly one fulfilled; every rejection is `ChangeRequestAlreadyPendingError` naming the winner's id; one PENDING row. Name it `"S1 exactly one of 50 simultaneous change requests for one event is recorded"`.
- [ ] **Step 3:** typecheck, lint; ad hoc type-check of both files. Commit `test(s1): a test per card and the pending-request race`.

---

### Task 7: OpenAPI

- [ ] Both routes in the event paths' layout (tag `Change requests`), schemas `ChangeRequestInput` (`reason` string ≤ 1000, `changes` object with the six optional properties typed as the event schema types them), `ChangeRequest` (as `ChangeRequestRecord`), `ChangeRequestField`; responses as spec §5 incl. 503 and 429. `npm run lint:api`, planning-core unit suite (route-documentation test). Commit `docs(s1): describe the change-request routes` (or fold into Task 5's commit so the unit suite stays green there).

---

### Task 8: Screens

- [ ] **Step 1:** `frontend/src/api/changeRequests.ts`: types mirroring `ChangeRequest`; `requestChange(token, eventId, { reason, changes })` → POST `/event/api/v1/events/<id>/change-requests`; `listChangeRequests(token, eventId)` → GET.
- [ ] **Step 2: Failing tests** (`frontend/tests/changeRequest.test.tsx`, fetch stubbed as in `equipmentRequests.test.tsx`):
  - the organiser's request page shows "Request a change" for an Approved request with no pending one, and not for Draft/Completed/Cancelled/Rejected or when one is pending;
  - the form is prefilled; "Send request" with nothing changed shows "You haven't changed anything." and sends nothing;
  - changing attendance to 180 with reason "More people" posts `{ reason: "More people", changes: { expectedAttendance: 180 } }` only;
  - a 400 with `changes.expectedAttendance` shows that message beside attendance; a 409 `CHANGE_REQUEST_ALREADY_PENDING` shows its message;
  - after success the page shows "Change requested on <date>: expected attendance (Pending)" and hides the button;
  - the coordinator's review page shows the same pending notice.
- [ ] **Step 3: Implement** in `RequestDetail.tsx` (organiser) and `ReviewDetail.tsx` (coordinator): load `listChangeRequests` with the request; a `PendingChangeNotice` component (in `frontend/src/components/`) used by both; the form inline under the request details: start and end (datetime-local, as the existing request form uses), expected attendance, "Equipment is required" checkbox, and the two requirements edited with the same controls the request form uses (reuse its components; if the requirements editors aren't reusable components, leave those two fields out of the form and note it in the report — the API still accepts them). Labels from `SIGNIFICANT_FIELD_LABELS` (mirror the six labels in the frontend; the frontend doesn't import contracts — check how `status.ts` mirrors contracts and do the same).
- [ ] **Step 4:** `npm test -w @connectsphere/web`, typecheck, `npx eslint frontend`. Commit `feat(s1): request a change from the request page`.

---

### Task 9: Traceability, changelog, PR, results

- [ ] **Step 1:** `documentation/traceability/sprint-3.csv`: S1 rows per AC with exact test names (AC1 → T2, T3, T10; AC2 → T1, T5, T7; AC3 → T1, T11; AC4 → T1, T11; AC5 → T4 and the race; AC6 → T9; AC7 → T3, T4, T5, T6, T7).
- [ ] **Step 2:** CHANGELOG entry at the top (house format), including "Before using it on the shared database: `npm run migrate -- change` creates the change schema; deploy the notification service with this change so the coordinator's notice is worded (an older one ignores the unknown type)." — verify that last claim against the consumer code and correct it if an unknown type is dead-lettered instead.
- [ ] **Step 3:** all local gates. Commit `docs(s1): trace S1's criteria and record it in the changelog`.
- [ ] **Step 4:** push `feature-raphael/s1-change-request`, open the PR against `main` ("S1: request a change after submission"), body: what changes, card table, migration and deploy notes, the Claude Code line last.
- [ ] **Step 5:** when CI is green, fill each automated card's Execution record from that run; S1-T13 Not Executed until the shared DB is migrated; commit and push.
