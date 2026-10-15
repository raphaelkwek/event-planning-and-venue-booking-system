# Q1 — Reserve Equipment for a Request Line: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Technical Support reserves the equipment on a Confirmed or Substituted request line, in one transaction that the availability check cannot race (SPM-50).

**Architecture:** A new `equipment.reservations` row groups the existing unit and bulk reservation rows, which keep the availability guarantees EN-02.2 built. `reserveLine` (repo) locks the line, then the type, applies the pure quantity rules from `domain/reservations.ts`, reserves through the existing `reserveBulk` / `reserveUnit`, and marks the line Reserved with history. A new router serves `POST /api/v1/equipment/request-lines/{id}/reservation`; the "Equipment requests" screen gets a Reserve action.

**Tech Stack:** TypeScript, Express, porsager `postgres` (raw SQL), zod, Vitest + supertest, React + Atlaskit, Postgres 17.

**Spec:** `documentation/superpowers/specs/2026-10-15-q1-reserve-equipment-design.md`. **Branch:** `feature-raphael/q1-reserve-equipment` (already created from `origin/main`).

---

## Ground rules for every task

- Read `documentation/planning/implementation.md` and `CLAUDE.md` first (mandatory).
- All paths below are relative to the repo root. `PC` = `backend/services/planning-core`.
- **Never run migrations or ad-hoc writes against the shared Supabase database.** Integration tests
  that need the new migration run in CI's throwaway Postgres. Locally, integration tests touching
  `equipment.reservations` will fail until the team migrates the shared DB after merge — that is
  expected; say so in your report rather than migrating.
- Race tests (`PC/tests/race/`) skip themselves on anything but a throwaway database. Never point
  them at the shared DB.
- Unit tests: `npm run test:unit -w @connectsphere/planning-core` (100% on `src/**/domain/**`).
  Locally they need CI's placeholder env:
  `DATABASE_URL=postgres://ci:ci@127.0.0.1:1/ci_unused SUPABASE_URL=https://ci.invalid SUPABASE_ANON_KEY=ci-placeholder SUPABASE_JWKS_URL=https://ci.invalid/auth/v1/.well-known/jwks.json`.
- Before each commit: `npm run lint && npm run lint:boundaries && npm run typecheck`.
- Conventional Commits; every commit ends with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File map

| File | Responsibility |
|---|---|
| `tests/Q1/README.md`, `tests/Q1/Q1-T*.md` | The 14 functional cards and fixture FX-Q1 |
| `backend/packages/contracts/src/errorCodes.ts` | + `PARTIAL_NOT_CONFIRMED`, `LINE_NOT_RESERVABLE` |
| `PC/migrations/equipment/0005_reservations.sql` | New table, unique-active index, `reservation_id` columns, FKs `NOT VALID` |
| `PC/migrations/equipment/0006_validate_reservation_links.sql` | Validates the two FKs |
| `PC/src/modules/equipment/domain/reservations.ts` | Pure: which lines are reservable, what they reserve, the quantity rules |
| `PC/src/modules/equipment/repo/reservations.ts` | `reserveLine` — the one transaction |
| `PC/src/modules/equipment/repo/requestLines.ts` | + `markReserved`; lines carry their active reservation |
| `PC/src/modules/equipment/events/lineStatusMessage.ts` | The `line-status-changed` outbox message, shared by O2 and Q1 |
| `PC/src/modules/equipment/api/reservations.ts` | The route |
| `PC/src/modules/equipment/index.ts` | Mounts the router |
| `PC/tests/support/lineFixtures.ts` | Serialized fixture type; cleanup covers reservations |
| `PC/tests/equipment/domain/reservations.test.ts` | Unit tests |
| `PC/tests/equipment/repo/reservations.test.ts` | `reserveLine` integration tests |
| `PC/tests/equipment/api/q1Cards.test.ts` | One named test per automated card |
| `PC/tests/race/invariants.test.ts` | + Q1-T13 races through `reserveLine` |
| `documentation/api/planning-core.openapi.yaml` | Route, `Reservation`, codes |
| `frontend/src/api/equipmentRequests.ts`, `frontend/src/screens/EquipmentRequests.tsx`, `frontend/src/screens/EquipmentRequest.tsx`, `frontend/tests/equipmentRequests.test.tsx` | Reserve action and "Reserved n of m" |
| `documentation/traceability/sprint-3.csv`, `CHANGELOG.md` | Traceability and changelog |

---

### Task 1: Functional cards (before any code)

**Files:** Create `tests/Q1/README.md` and the 14 cards below. Copy the layout of `tests/O2/O2-T1-set-under-review.md` and `tests/O2/README.md` exactly (Specification table, Execution record table with Status `Not Executed`).

- [ ] **Step 1: Write `tests/Q1/README.md`**

Contents: why the cards are API-level and automated (same reasoning as `tests/O2/README.md`), the isolated setup (clean throwaway Postgres with every migration; authentication stubbed; the signed-in user is whichever actor a step names), and fixture **FX-Q1**:

- Actors TS (Technical Support), C1 (assigned coordinator), ORG (owner), VS (Venue Staff), ATT (Attendee).
- Event E1: Approved, owned by ORG, assigned to C1, proposed `D 14:00`–`D 18:00` UTC (D is sixty days ahead, as `tests/support/eventDates.ts`).
- CHAIRS: bulk, total 10. PROJECTORS: serialized, units `P-01`, `P-02`, `P-03`.
- Every line's window is E1's window.
- How to run: `npm test -w @connectsphere/planning-core -- tests/equipment/api/q1Cards.test.ts -t 'Q1-Tn '`; Q1-T13 in `tests/race/invariants.test.ts` on CI only; Q1-T14 by hand in the app.

- [ ] **Step 2: Write the 14 cards**

File names and content (Test Scenario / Pre-conditions beyond FX-Q1 / Steps / Data / Expected Result). Every API step is `POST /api/v1/equipment/request-lines/<id>/reservation` as TS unless stated.

| File | Pre-conditions (after FX-Q1) | Body | Expected result |
|---|---|---|---|
| `Q1-T1-reserve-bulk-line.md` | CHAIRS line ×4, Confirmed | `{}` | 201. Reservation has eventId E1, its reference, CHAIRS, kind BULK, requestedQuantity 4, reservedQuantity 4, startsAt/endsAt = the line's window, reservedBy TS, reservedAt between the instants around the request. Line status RESERVED, statusChangedBy TS. `GET /api/v1/equipment/types/<CHAIRS>/availability` for E1's window with requestedQuantity 1 shows availableQuantity 6, and for a window overlapping only the last hour also 6. |
| `Q1-T2-reserve-serialized-line.md` | PROJECTORS line ×2, Confirmed | `{}` | 201; reservedQuantity 2, kind SERIALIZED. The database holds two `unit_reservations` rows (P-01, P-02) carrying the reservation's id. Availability for E1's window shows 1. |
| `Q1-T3-substituted-line-reserves-substitute.md` | PROJECTORS line ×2, Substituted with CHAIRS ×5 | `{}` | 201; the reservation is CHAIRS, requestedQuantity 5, reservedQuantity 5. No projector is reserved. |
| `Q1-T4-exactly-available-succeeds.md` | Existing reservation of CHAIRS ×7 for E1's window (another event); CHAIRS line ×3, Confirmed | `{}` | 201; reservedQuantity 3; availability now 0. |
| `Q1-T5-one-over-available-refused.md` | Existing reservation of CHAIRS ×7; CHAIRS line ×4, Confirmed | `{}` | 409 `INSUFFICIENT_EQUIPMENT`, message names 4 requested, 3 available, 1 short; `details` `{available: 3, shortfall: 1}`. No reservation row for the line; CHAIRS availability still 3; line still CONFIRMED with no new history entry; no outbox row. |
| `Q1-T6-partial-reservation-recorded.md` | Existing reservation CHAIRS ×7; CHAIRS line ×5, Confirmed | `{"quantity":3,"partial":true}` | 201; requestedQuantity 5, reservedQuantity 3; line RESERVED; history `details` holds both quantities. |
| `Q1-T7-lower-quantity-without-partial-refused.md` | CHAIRS line ×5, Confirmed | `{"quantity":3}` | 409 `PARTIAL_NOT_CONFIRMED`; message says 5 were requested and to confirm a partial reservation of 3. Nothing stored; line CONFIRMED. |
| `Q1-T8-quantity-above-requested-refused.md` | CHAIRS line ×5, Confirmed | `{"quantity":6}`, then `{"quantity":0}`, then `{"quantity":2.5}` | Each 400 `VALIDATION_FAILED` with a field `quantity`. Nothing stored. |
| `Q1-T9-unreservable-statuses-refused.md` | Five CHAIRS lines: Submitted, Under Review, Unavailable, Reserved, Removed | `{}` each | Each 409 `LINE_NOT_RESERVABLE`, message names the status label, `details.status` the code. Nothing stored. |
| `Q1-T10-history-and-coordinator-message.md` | CHAIRS line ×4, Confirmed | `{}` | The line's history ends with `STATUS_CHANGED` CONFIRMED → RESERVED by TS, `details` `{reservationId, requestedQuantity: 4, reservedQuantity: 4}`. The equipment outbox has one `equipment-request.line-status-changed` message for the line with coordinatorId C1, newStatus RESERVED; passing it through the notification service's recipient rule gives one notification for C1 naming E1's reference. |
| `Q1-T11-roles-and-unknown-line.md` | CHAIRS line ×4, Confirmed | `{}` as C1, ORG, VS, ATT; then as TS to an unknown id | 403 for each role, line unchanged; 404 `EQUIPMENT_LINE_NOT_FOUND` for the unknown id. |
| `Q1-T12-touching-reservation-does-not-overlap.md` | Existing reservation CHAIRS ×10 for `D 18:00`–`D 20:00` (starts as E1 ends); CHAIRS line ×10, Confirmed | `{}` | 201; reservedQuantity 10 — the `[)` periods only touch. |
| `Q1-T13-last-unit-race.md` | Bulk type with total 1; serialized type with one unit; fifty Confirmed lines of quantity 1 for each, on different events, all for the same window | fifty simultaneous `reserveLine` calls per type, ten rounds | In every round exactly one succeeds; the others fail with `InsufficientEquipmentError` (1 requested, 0 available, 1 short); exactly one RESERVED reservation exists for the type; every losing line is still CONFIRMED. Runs in `tests/race/invariants.test.ts` on CI's throwaway Postgres only. |
| `Q1-T14-reserve-in-the-browser.md` | Standard environment (`tests/README.md`), migrations applied; a Confirmed chairs line from O2-T17's walkthrough | Browser: sign in as `techsupport@connectsphere.test` → "Equipment requests" → "Reserve" on the line → lower the quantity → without ticking "Reserve fewer than requested" click "Reserve" → tick it → "Reserve" | First attempt shows the PARTIAL_NOT_CONFIRMED message inline and the line stays Confirmed; second succeeds; the row shows "Reserved n of m" with Tech Support One and the time; signed in as the assigned coordinator, the event's equipment request shows the same and a notification names the event. |

Created By: `Raphael, via Claude`; Date of Creation: `2026-10-15`. Add the note used on F1's cards:
`> **Expected results are checked by the PR reviewer** against Q1's acceptance criteria.`

- [ ] **Step 3: Commit**

```bash
git add tests/Q1
git commit -m "test(q1): write the Q1 cards and fixture FX-Q1 before the code"
```

- [ ] **Step 4: STOP — show Raphael the cards and wait for approval before Task 2.**

---

### Task 2: Error codes

**Files:** Modify `backend/packages/contracts/src/errorCodes.ts`; modify `documentation/api/planning-core.openapi.yaml` (the `ErrorCode` enum near line 1537).

- [ ] **Step 1: Add the codes** after `"EQUIPMENT_LINE_NOT_EDITABLE",` in `ERROR_CODES`:

```ts
  "EQUIPMENT_LINE_NOT_EDITABLE",
  "LINE_NOT_RESERVABLE",
  "PARTIAL_NOT_CONFIRMED",
```

and the same two entries in the OpenAPI `ErrorCode` enum after `EQUIPMENT_LINE_NOT_EDITABLE`.

- [ ] **Step 2: Build and lint**

Run: `npm run build -w @connectsphere/contracts && npm run lint:api`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add backend/packages/contracts/src/errorCodes.ts documentation/api/planning-core.openapi.yaml
git commit -m "feat(q1): add the reservation refusal codes"
```

---

### Task 3: Migrations 0005–0006

**Files:** Create `PC/migrations/equipment/0005_reservations.sql`, `PC/migrations/equipment/0006_validate_reservation_links.sql`.

- [ ] **Step 1: Write 0005**

```sql
-- Q1 (SPM-50): one row per reservation of a request line. The unit and bulk
-- rows EN-02.2 reserves still carry the period and decide availability; this
-- row groups them, so reserving three projectors is one reservation, and
-- records what Q1 asks for: the line, both quantities and who reserved it.
--
-- reservation_id on the unit and bulk rows is nullable: rows written before
-- Q1 (EN-02 tests, P2) have no parent. Its foreign keys are added NOT VALID
-- and validated in 0006, in its own transaction.
create table equipment.reservations (
  id                 uuid primary key default gen_random_uuid(),
  request_line_id    uuid        not null references equipment.equipment_request_lines (id),
  -- event.events.id, owned by the event module: no FK across schemas (§4.1).
  event_id           uuid        not null,
  event_reference    text        not null check (length(btrim(event_reference)) > 0),
  equipment_type_id  uuid        not null references equipment.equipment_types (id),
  kind               text        not null check (kind in ('SERIALIZED', 'BULK')),
  requested_quantity int         not null check (requested_quantity > 0),
  reserved_quantity  int         not null check (reserved_quantity > 0),
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  status             text        not null default 'RESERVED' check (status in ('RESERVED', 'RELEASED')),
  reserved_by        uuid        not null,
  reserved_at        timestamptz not null default clock_timestamp(),
  created_at         timestamptz not null default now(),
  created_by         uuid,
  updated_at         timestamptz not null default now(),
  updated_by         uuid,
  constraint reservations_reserved_within_requested check (reserved_quantity <= requested_quantity),
  constraint reservations_ends_after_start check (ends_at > starts_at)
);

-- One active reservation per line: a second Reserve on the same line loses here
-- even if both passed the status check.
create unique index reservations_one_active_per_line
  on equipment.reservations (request_line_id) where (status = 'RESERVED');
create index reservations_event_idx on equipment.reservations (event_id);

alter table equipment.unit_reservations add column reservation_id uuid;
alter table equipment.bulk_reservations add column reservation_id uuid;

alter table equipment.unit_reservations
  add constraint unit_reservations_reservation_fkey
  foreign key (reservation_id) references equipment.reservations (id) not valid;
alter table equipment.bulk_reservations
  add constraint bulk_reservations_reservation_fkey
  foreign key (reservation_id) references equipment.reservations (id) not valid;

create index unit_reservations_reservation_idx on equipment.unit_reservations (reservation_id);
create index bulk_reservations_reservation_idx on equipment.bulk_reservations (reservation_id);
```

- [ ] **Step 2: Write 0006**

```sql
-- Q1: validates 0005's foreign keys in a transaction of its own, so the scan
-- does not run while 0005's locks are held. Every existing row has a null
-- reservation_id, so validation finds nothing to refuse.
alter table equipment.unit_reservations validate constraint unit_reservations_reservation_fkey;
alter table equipment.bulk_reservations validate constraint bulk_reservations_reservation_fkey;
```

- [ ] **Step 3: Lint with squawk**

Run: `npx --yes squawk-cli@2.67.0 backend/services/planning-core/migrations/equipment/0005_reservations.sql backend/services/planning-core/migrations/equipment/0006_validate_reservation_links.sql`
Expected: no issues. (Do **not** run `migrate` against the shared database.)

- [ ] **Step 4: Commit**

```bash
git add backend/services/planning-core/migrations/equipment/0005_reservations.sql backend/services/planning-core/migrations/equipment/0006_validate_reservation_links.sql
git commit -m "feat(q1): add equipment.reservations and link unit and bulk rows to it"
```

---

### Task 4: Domain rules (pure, 100% covered)

**Files:** Create `PC/src/modules/equipment/domain/reservations.ts`; test `PC/tests/equipment/domain/reservations.test.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { decideQuantity, reservationTarget, validateReservationBody } from "../../../src/modules/equipment/domain/reservations.js";

const line = (changes: Record<string, unknown> = {}) => ({
  status: "CONFIRMED" as const,
  equipmentTypeId: "type-chairs",
  quantity: 5,
  substituteEquipmentTypeId: null,
  substituteQuantity: null,
  ...changes,
});

describe("reservationTarget (Q1)", () => {
  it("a Confirmed line reserves its own type and quantity", () => {
    expect(reservationTarget(line())).toEqual({ equipmentTypeId: "type-chairs", requestedQuantity: 5 });
  });

  it("a Substituted line reserves the substitute type and quantity", () => {
    expect(
      reservationTarget(line({ status: "SUBSTITUTED", substituteEquipmentTypeId: "type-stools", substituteQuantity: 3 })),
    ).toEqual({ equipmentTypeId: "type-stools", requestedQuantity: 3 });
  });

  it.each(["SUBMITTED", "UNDER_REVIEW", "UNAVAILABLE", "RESERVED", "REMOVED"] as const)("a %s line is not reservable", (status) => {
    expect(reservationTarget(line({ status }))).toBeNull();
  });
});

describe("validateReservationBody (Q1)", () => {
  it("accepts an empty body", () => {
    expect(validateReservationBody({})).toEqual({ ok: true, body: { quantity: null, partial: false } });
  });

  it("accepts a quantity and partial", () => {
    expect(validateReservationBody({ quantity: 3, partial: true })).toEqual({ ok: true, body: { quantity: 3, partial: true } });
  });

  it.each([0, -1, 2.5, "3", null])("refuses quantity %p", (quantity) => {
    const result = validateReservationBody({ quantity });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fields.map((f) => f.field)).toEqual(["quantity"]);
  });

  it("refuses a partial that is not a boolean", () => {
    const result = validateReservationBody({ partial: "yes" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fields.map((f) => f.field)).toEqual(["partial"]);
  });

  it("refuses a body that is not an object", () => {
    expect(validateReservationBody(undefined).ok).toBe(false);
  });
});

describe("decideQuantity (Q1)", () => {
  it("no quantity reserves the requested quantity", () => {
    expect(decideQuantity(5, { quantity: null, partial: false })).toEqual({ ok: true, quantity: 5 });
  });

  it("the requested quantity itself needs no partial", () => {
    expect(decideQuantity(5, { quantity: 5, partial: false })).toEqual({ ok: true, quantity: 5 });
  });

  it("a lower quantity with partial is accepted", () => {
    expect(decideQuantity(5, { quantity: 3, partial: true })).toEqual({ ok: true, quantity: 3 });
  });

  it("a lower quantity without partial is refused, naming both numbers", () => {
    expect(decideQuantity(5, { quantity: 3, partial: false })).toEqual({
      ok: false,
      code: "PARTIAL_NOT_CONFIRMED",
      message: "5 were requested. Confirm a partial reservation to reserve 3.",
    });
  });

  it("a quantity above the requested one is refused on the field", () => {
    expect(decideQuantity(5, { quantity: 6, partial: true })).toEqual({
      ok: false,
      code: "VALIDATION_FAILED",
      fields: [{ field: "quantity", message: "You can reserve at most 5, the quantity requested." }],
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (with the placeholder env from Ground rules): `npx vitest run -c vitest.unit.config.ts tests/equipment/domain/reservations.test.ts` in `PC`.
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import { z } from "zod";
import type { EquipmentRequestLineStatus, ErrorField } from "@connectsphere/contracts";

/**
 * Q1 — the pure rules for reserving a request line (spec decisions 1 and 3).
 * Only Confirmed and Substituted lines are reservable; a Substituted line
 * reserves O2's substitute. One reservation per line: the quantity defaults to
 * the requested one, a lower one must be confirmed as partial, a higher one is
 * refused.
 */

export interface LineForReservation {
  status: EquipmentRequestLineStatus;
  equipmentTypeId: string;
  quantity: number;
  substituteEquipmentTypeId: string | null;
  substituteQuantity: number | null;
}

export interface ReservationTarget {
  equipmentTypeId: string;
  requestedQuantity: number;
}

/** What the line reserves, or null when its status is not reservable. */
export function reservationTarget(line: LineForReservation): ReservationTarget | null {
  if (line.status === "CONFIRMED") return { equipmentTypeId: line.equipmentTypeId, requestedQuantity: line.quantity };
  if (line.status === "SUBSTITUTED" && line.substituteEquipmentTypeId && line.substituteQuantity) {
    return { equipmentTypeId: line.substituteEquipmentTypeId, requestedQuantity: line.substituteQuantity };
  }
  return null;
}

export interface ReservationBody {
  /** Null means "the requested quantity". */
  quantity: number | null;
  partial: boolean;
}

const bodySchema = z.object({
  quantity: z
    .number({ invalid_type_error: "Quantity must be a whole number of 1 or more." })
    .int("Quantity must be a whole number of 1 or more.")
    .min(1, "Quantity must be a whole number of 1 or more.")
    .optional(),
  partial: z.boolean({ invalid_type_error: "Partial must be true or false." }).optional(),
});

export function validateReservationBody(raw: unknown): { ok: true; body: ReservationBody } | { ok: false; fields: ErrorField[] } {
  const result = bodySchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, fields: result.error.issues.map((issue) => ({ field: issue.path.join(".") || "body", message: issue.message })) };
  }
  return { ok: true, body: { quantity: result.data.quantity ?? null, partial: result.data.partial ?? false } };
}

export type QuantityDecision =
  | { ok: true; quantity: number }
  | { ok: false; code: "PARTIAL_NOT_CONFIRMED"; message: string }
  | { ok: false; code: "VALIDATION_FAILED"; fields: ErrorField[] };

export function decideQuantity(requested: number, body: ReservationBody): QuantityDecision {
  const quantity = body.quantity ?? requested;
  if (quantity > requested) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      fields: [{ field: "quantity", message: `You can reserve at most ${requested}, the quantity requested.` }],
    };
  }
  if (quantity < requested && !body.partial) {
    return {
      ok: false,
      code: "PARTIAL_NOT_CONFIRMED",
      message: `${requested} were requested. Confirm a partial reservation to reserve ${quantity}.`,
    };
  }
  return { ok: true, quantity };
}
```

Note: `reservationTarget`'s Substituted branch requires both substitute fields; the database's `request_lines_substituted_needs_substitute` check guarantees them, so a Substituted line without them cannot exist. If coverage reports the false branch of that `&&` as uncovered, add the test `it("a Substituted line missing its substitute is not reservable", …)` with `substituteQuantity: null` rather than removing the guard.

- [ ] **Step 4: Run to verify pass, with coverage**

Run: `npm run test:unit -w @connectsphere/planning-core` (placeholder env).
Expected: all pass; no coverage threshold error.

- [ ] **Step 5: Commit**

```bash
git add backend/services/planning-core/src/modules/equipment/domain/reservations.ts backend/services/planning-core/tests/equipment/domain/reservations.test.ts
git commit -m "feat(q1): decide what a line reserves and how much"
```

---

### Task 5: Fixtures for reservations

**Files:** Modify `PC/tests/support/lineFixtures.ts`.

- [ ] **Step 1: Add a serialized type helper and a direct bulk reservation helper**, below `createTypes`:

```ts
/** A serialized type with the given unit labels, created by `createdBy` (FX-Q1's PROJECTORS). */
export async function createSerializedType(sql: Sql, createdBy: string, name: string, labels: string[]) {
  const [type] = await sql<{ id: string }[]>`
    insert into equipment.equipment_types (name, description, kind, created_by, updated_by)
    values (${name}, 'Line fixture', 'SERIALIZED', ${createdBy}, ${createdBy})
    returning id
  `;
  for (const label of labels) {
    await sql`
      insert into equipment.equipment_units (equipment_type_id, label, created_by, updated_by)
      values (${type!.id}, ${label}, ${createdBy}, ${createdBy})
    `;
  }
  return { id: type!.id, name };
}

/** A bulk type with the given total (FX-Q1's CHAIRS has 10). */
export async function createBulkType(sql: Sql, createdBy: string, name: string, total: number) {
  const [row] = await sql<{ id: string }[]>`
    insert into equipment.equipment_types (name, description, kind, total_quantity, created_by, updated_by)
    values (${name}, 'Line fixture', 'BULK', ${total}, ${createdBy}, ${createdBy})
    returning id
  `;
  return { id: row!.id, name };
}

/** Another event's reservation of bulk stock, written directly, to use up availability. */
export async function reserveBulkDirect(
  sql: Sql,
  options: { equipmentTypeId: string; quantity: number; startsAt: string; endsAt: string; actorUserId: string },
): Promise<void> {
  await sql`
    insert into equipment.bulk_reservations
      (equipment_type_id, event_id, event_reference, quantity, starts_at, ends_at, created_by, updated_by)
    values
      (${options.equipmentTypeId}, ${randomUUID()}, 'EVT-OTHER', ${options.quantity}, ${options.startsAt}, ${options.endsAt},
       ${options.actorUserId}, ${options.actorUserId})
  `;
}
```

- [ ] **Step 2: Make cleanup cover reservations and units.** In `cleanLineFixtures`, replace

```ts
  await sql`delete from equipment.bulk_reservations where equipment_type_id in (${types})`;
```

with

```ts
  await sql`delete from equipment.unit_reservations where unit_id in (select id from equipment.equipment_units where equipment_type_id in (${types}))`;
  await sql`delete from equipment.bulk_reservations where equipment_type_id in (${types})`;
  await sql`delete from equipment.reservations where equipment_type_id in (${types}) or request_line_id in (${lines})`;
  await sql`delete from equipment.equipment_units where equipment_type_id in (${types})`;
```

and move the `equipment_request_lines` delete **after** these four lines (reservations reference lines). The final order is: outbox, request_line_history, unit_reservations, bulk_reservations, reservations, equipment_units, equipment_request_lines, inventory_history, equipment_types, events.

- [ ] **Step 3: Run the O1/O2 card tests to check nothing broke**

Run (CI-equivalent, throwaway DB only): these run in CI. Locally: `npm run typecheck`.
Expected: exit 0. (The `equipment.reservations` delete needs migration 0005; it runs in CI.)

- [ ] **Step 4: Commit**

```bash
git add backend/services/planning-core/tests/support/lineFixtures.ts
git commit -m "test(q1): fixtures for serialized stock and reservations"
```

---

### Task 6: Lines carry their active reservation; `markReserved`

**Files:** Modify `PC/src/modules/equipment/repo/requestLines.ts`.

- [ ] **Step 1: Extend the line.** Add to `RequestLine`:

```ts
  /** Q1: the line's active reservation, or null. */
  reservation: LineReservation | null;
```

and above it:

```ts
export interface LineReservation {
  id: string;
  equipmentTypeId: string;
  requestedQuantity: number;
  reservedQuantity: number;
  reservedBy: string;
  reservedAt: string;
}
```

Add to `LineRow`:

```ts
  reservation_id: string | null;
  reservation_type_id: string | null;
  requested_quantity: number | null;
  reserved_quantity: number | null;
  reserved_by: string | null;
  reserved_at: Date | null;
```

In `toLine`, add:

```ts
    reservation: row.reservation_id
      ? {
          id: row.reservation_id,
          equipmentTypeId: row.reservation_type_id!,
          requestedQuantity: row.requested_quantity!,
          reservedQuantity: row.reserved_quantity!,
          reservedBy: row.reserved_by!,
          reservedAt: row.reserved_at!.toISOString(),
        }
      : null,
```

In `selectLines`, add the columns and the join:

```ts
    select l.id, l.seq, l.event_id, l.event_reference, l.equipment_type_id, t.name as equipment_type_name,
           l.quantity, l.notes, l.required_from, l.required_to, l.status, l.requested_by, l.requested_at,
           l.status_changed_by, l.status_changed_at, l.unavailable_reason, l.substitute_equipment_type_id,
           s.name as substitute_equipment_type_name, l.substitute_quantity, l.updated_at,
           r.id as reservation_id, r.equipment_type_id as reservation_type_id, r.requested_quantity,
           r.reserved_quantity, r.reserved_by, r.reserved_at
    from equipment.equipment_request_lines l
    join equipment.equipment_types t on t.id = l.equipment_type_id
    left join equipment.equipment_types s on s.id = l.substitute_equipment_type_id
    left join equipment.reservations r on r.request_line_id = l.id and r.status = 'RESERVED'
```

- [ ] **Step 2: Add `markReserved`** after `applyStatusChange`:

```ts
/** Q1: a locked Confirmed or Substituted line becomes Reserved, with its history entry. */
export async function markReserved(
  tx: TransactionSql,
  current: RequestLine,
  reservation: { id: string; requestedQuantity: number; reservedQuantity: number },
  actor: Actor,
): Promise<RequestLine> {
  await tx`
    update equipment.equipment_request_lines
    set status = 'RESERVED',
        status_changed_by = ${actor.userId}, status_changed_at = clock_timestamp(),
        updated_at = now(), updated_by = ${actor.userId}
    where id = ${current.id}
  `;
  await writeHistory(tx, {
    lineId: current.id,
    action: "STATUS_CHANGED",
    previousStatus: current.status,
    newStatus: "RESERVED",
    equipmentTypeId: current.equipmentTypeId,
    quantity: current.quantity,
    details: {
      reservationId: reservation.id,
      requestedQuantity: reservation.requestedQuantity,
      reservedQuantity: reservation.reservedQuantity,
    },
    actor,
  });
  return (await findLine(tx, current.id))!;
}
```

- [ ] **Step 3: Typecheck and fix any test that compares a whole line with `toEqual`**

Run: `npm run typecheck && grep -rn "toEqual(present\|toStrictEqual" backend/services/planning-core/tests/equipment | head`
Expected: typecheck exit 0. For any O1/O2 test asserting a whole line object with `toEqual`, add `reservation: null` to the expected object.

- [ ] **Step 4: Commit**

```bash
git add backend/services/planning-core/src/modules/equipment/repo/requestLines.ts backend/services/planning-core/tests
git commit -m "feat(q1): show a line's active reservation and mark lines Reserved"
```

---

### Task 7: `reserveLine`

**Files:** Create `PC/src/modules/equipment/repo/reservations.ts`; test `PC/tests/equipment/repo/reservations.test.ts`.

- [ ] **Step 1: Write the failing integration tests**

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../support/testDb.js";
import {
  actorsWithPrefix,
  cleanLineFixtures,
  createBulkType,
  createEvent,
  createSerializedType,
  insertLineDirect,
  reserveBulkDirect,
} from "../../support/lineFixtures.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";
import { reserveLine } from "../../../src/modules/equipment/repo/reservations.js";
import { InsufficientEquipmentError } from "../../../src/modules/equipment/domain/availability.js";

const sql = testDb();
const A = actorsWithPrefix("0b500000");
const TS = { userId: A.ts, role: "TECH_SUPPORT_STAFF" as const };
let event: { id: string; reference: string; name: string };
let chairs: { id: string };
let projectors: { id: string };

const clean = () => cleanLineFixtures(sql, [A.org], [A.ts]);
beforeEach(async () => {
  await clean();
  event = await createEvent(sql, { ownerId: A.org, coordinatorId: A.c1, name: "Q1 repo event" });
  chairs = await createBulkType(sql, A.ts, "Q1R Chairs", 10);
  projectors = await createSerializedType(sql, A.ts, "Q1R Projectors", ["P-01", "P-02", "P-03"]);
});
afterAll(async () => {
  await clean();
  await sql.end();
});

const confirmed = (typeId: string, quantity: number) =>
  insertLineDirect(sql, { event, equipmentTypeId: typeId, requestedBy: A.c1, status: "CONFIRMED", quantity });
const reserve = (lineId: string, body = { quantity: null as number | null, partial: false }) =>
  sql.begin((tx) => reserveLine(tx, lineId, body, TS));

describe("reserveLine (Q1)", () => {
  it("reserves bulk stock under one reservation and marks the line Reserved", async () => {
    const id = await confirmed(chairs.id, 4);
    const outcome = await reserve(id);

    expect(outcome).toMatchObject({ ok: true, reservation: { kind: "BULK", requestedQuantity: 4, reservedQuantity: 4 } });
    const [bulk] = await sql`select quantity, reservation_id from equipment.bulk_reservations where equipment_type_id = ${chairs.id}`;
    expect(bulk).toMatchObject({ quantity: 4, reservation_id: outcome.ok ? outcome.reservation.id : "" });
    expect((await sql`select status from equipment.equipment_request_lines where id = ${id}`)[0]!.status).toBe("RESERVED");
  });

  it("reserves serialized units in label order under one reservation", async () => {
    const outcome = await reserve(await confirmed(projectors.id, 2));
    const units = await sql`
      select u.label from equipment.unit_reservations r join equipment.equipment_units u on u.id = r.unit_id
      where r.reservation_id = ${outcome.ok ? outcome.reservation.id : null} order by u.label
    `;
    expect(units.map((u) => u.label)).toEqual(["P-01", "P-02"]);
  });

  it("throws the shortfall and writes nothing when serialized stock runs out", async () => {
    const id = await confirmed(projectors.id, 4);
    await expect(reserve(id)).rejects.toMatchObject({ requested: 4, available: 3, shortfall: 1 });
    expect((await sql`select count(*)::int as n from equipment.reservations where request_line_id = ${id}`)[0]!.n).toBe(0);
    expect((await sql`select count(*)::int as n from equipment.unit_reservations where unit_id in (select id from equipment.equipment_units where equipment_type_id = ${projectors.id})`)[0]!.n).toBe(0);
  });

  it("throws the shortfall and writes nothing when bulk stock runs out", async () => {
    await reserveBulkDirect(sql, { equipmentTypeId: chairs.id, quantity: 7, startsAt: EVENT_START, endsAt: EVENT_END, actorUserId: A.ts });
    const id = await confirmed(chairs.id, 4);
    await expect(reserve(id)).rejects.toBeInstanceOf(InsufficientEquipmentError);
    expect((await sql`select status from equipment.equipment_request_lines where id = ${id}`)[0]!.status).toBe("CONFIRMED");
  });

  it("refuses a line that is not reservable, naming its status", async () => {
    const id = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "UNDER_REVIEW" });
    expect(await reserve(id)).toEqual({ ok: false, code: "LINE_NOT_RESERVABLE", status: "UNDER_REVIEW" });
  });

  it("reports a line that does not exist", async () => {
    expect(await reserve("00000000-0000-4000-8000-0000000000ff")).toEqual({ ok: false, code: "GONE" });
  });

  it("refuses a lower quantity without partial, and accepts it with partial", async () => {
    const id = await confirmed(chairs.id, 5);
    expect(await reserve(id, { quantity: 3, partial: false })).toMatchObject({ ok: false, code: "PARTIAL_NOT_CONFIRMED" });
    expect(await reserve(id, { quantity: 3, partial: true })).toMatchObject({
      ok: true,
      reservation: { requestedQuantity: 5, reservedQuantity: 3 },
    });
  });

  it("refuses a quantity above the requested one on the field", async () => {
    expect(await reserve(await confirmed(chairs.id, 5), { quantity: 6, partial: true })).toMatchObject({
      ok: false,
      code: "VALIDATION_FAILED",
    });
  });
});
```

- [ ] **Step 2: Run to verify failure** — these need migration 0005, so they run in CI's integration job; locally confirm only that the module is missing:

Run: `npm run typecheck`
Expected: FAIL — cannot find module `repo/reservations.js`.

- [ ] **Step 3: Implement `repo/reservations.ts`**

```ts
import type { TransactionSql } from "postgres";
import type { EquipmentKind, EquipmentRequestLineStatus, ErrorField } from "@connectsphere/contracts";
import { InsufficientEquipmentError } from "../domain/availability.js";
import { decideQuantity, reservationTarget, type ReservationBody } from "../domain/reservations.js";
import { availableUnits, lockEquipmentType, reserveBulk, reserveUnit } from "./inventory.js";
import { lockLine, markReserved, type Actor, type RequestLine } from "./requestLines.js";

/**
 * Q1 — reserves a request line's equipment in the caller's transaction.
 *
 * Lock order: the line, then its equipment type. O2 locks only lines and P2
 * only types, so nothing takes them the other way round. The type lock queues
 * reservations of one type, so when two race for the last unit the second sees
 * the first's rows and is refused with the shortfall (AC2).
 *
 * Throws InsufficientEquipmentError when the stock is short, before anything is
 * written; the caller's transaction rolls back. Other refusals are returned.
 */

export interface ReservationRecord {
  id: string;
  requestLineId: string;
  eventId: string;
  eventReference: string;
  equipmentTypeId: string;
  kind: EquipmentKind;
  requestedQuantity: number;
  reservedQuantity: number;
  startsAt: string;
  endsAt: string;
  status: "RESERVED" | "RELEASED";
  reservedBy: string;
  reservedAt: string;
}

export type ReserveOutcome =
  | { ok: true; reservation: ReservationRecord; line: RequestLine; previous: RequestLine }
  | { ok: false; code: "GONE" }
  | { ok: false; code: "LINE_NOT_RESERVABLE"; status: EquipmentRequestLineStatus }
  | { ok: false; code: "PARTIAL_NOT_CONFIRMED"; message: string }
  | { ok: false; code: "VALIDATION_FAILED"; fields: ErrorField[] };

interface ReservationRow {
  id: string;
  request_line_id: string;
  event_id: string;
  event_reference: string;
  equipment_type_id: string;
  kind: EquipmentKind;
  requested_quantity: number;
  reserved_quantity: number;
  starts_at: Date;
  ends_at: Date;
  status: "RESERVED" | "RELEASED";
  reserved_by: string;
  reserved_at: Date;
}

const toReservation = (row: ReservationRow): ReservationRecord => ({
  id: row.id,
  requestLineId: row.request_line_id,
  eventId: row.event_id,
  eventReference: row.event_reference,
  equipmentTypeId: row.equipment_type_id,
  kind: row.kind,
  requestedQuantity: row.requested_quantity,
  reservedQuantity: row.reserved_quantity,
  startsAt: row.starts_at.toISOString(),
  endsAt: row.ends_at.toISOString(),
  status: row.status,
  reservedBy: row.reserved_by,
  reservedAt: row.reserved_at.toISOString(),
});

export async function reserveLine(
  tx: TransactionSql,
  lineId: string,
  body: ReservationBody,
  actor: Actor,
): Promise<ReserveOutcome> {
  const current = await lockLine(tx, lineId);
  if (!current) return { ok: false, code: "GONE" };

  const target = reservationTarget(current);
  if (!target) return { ok: false, code: "LINE_NOT_RESERVABLE", status: current.status };

  const decision = decideQuantity(target.requestedQuantity, body);
  if (!decision.ok) return decision;

  const type = await lockEquipmentType(tx, target.equipmentTypeId);
  if (!type) throw new Error(`No such equipment type: ${target.equipmentTypeId}`);

  const period = { startsAt: new Date(current.requiredFrom), endsAt: new Date(current.requiredTo) };
  const forEvent = { eventId: current.eventId, eventReference: current.eventReference, actorUserId: actor.userId, ...period };

  let childIds: string[];
  if (type.kind === "BULK") {
    const bulk = await reserveBulk(tx, { equipmentTypeId: target.equipmentTypeId, quantity: decision.quantity, ...forEvent });
    childIds = [bulk.id];
  } else {
    const free = await availableUnits(tx, target.equipmentTypeId, period);
    if (free.length < decision.quantity) {
      throw new InsufficientEquipmentError({ requested: decision.quantity, available: free.length });
    }
    childIds = [];
    for (const unit of free.slice(0, decision.quantity)) {
      childIds.push((await reserveUnit(tx, { unitId: unit.id, ...forEvent })).id);
    }
  }

  const [row] = await tx<ReservationRow[]>`
    insert into equipment.reservations
      (request_line_id, event_id, event_reference, equipment_type_id, kind, requested_quantity, reserved_quantity,
       starts_at, ends_at, reserved_by, created_by, updated_by)
    values
      (${current.id}, ${current.eventId}, ${current.eventReference}, ${target.equipmentTypeId}, ${type.kind},
       ${target.requestedQuantity}, ${decision.quantity}, ${period.startsAt}, ${period.endsAt},
       ${actor.userId}, ${actor.userId}, ${actor.userId})
    returning *
  `;
  const reservation = toReservation(row!);
  const table = type.kind === "BULK" ? tx`equipment.bulk_reservations` : tx`equipment.unit_reservations`;
  await tx`update ${table} set reservation_id = ${reservation.id} where id in ${tx(childIds)}`;

  const line = await markReserved(tx, current, reservation, actor);
  return { ok: true, reservation, line, previous: current };
}
```

If the `postgres` driver refuses a fragment as a table name in `update ${table}`, use two explicit statements in an `if` instead:

```ts
  if (type.kind === "BULK") {
    await tx`update equipment.bulk_reservations set reservation_id = ${reservation.id} where id in ${tx(childIds)}`;
  } else {
    await tx`update equipment.unit_reservations set reservation_id = ${reservation.id} where id in ${tx(childIds)}`;
  }
```

- [ ] **Step 4: Typecheck, lint, boundaries**

Run: `npm run typecheck && npm run lint && npm run lint:boundaries`
Expected: exit 0. The tests from Step 1 run in CI's integration job (Task 13).

- [ ] **Step 5: Commit**

```bash
git add backend/services/planning-core/src/modules/equipment/repo/reservations.ts backend/services/planning-core/tests/equipment/repo/reservations.test.ts
git commit -m "feat(q1): reserve a line's equipment in one transaction"
```

---

### Task 8: Shared outbox message

**Files:** Create `PC/src/modules/equipment/events/lineStatusMessage.ts`; modify `PC/src/modules/equipment/api/requestLines.ts` (the O2 status route's `writeOutbox` call, around line 289).

- [ ] **Step 1: Extract the message builder**

```ts
import { KAFKA_TOPICS } from "@connectsphere/contracts";
import type { RequestLine } from "../repo/requestLines.js";
import type { OutboxMessage } from "./outbox.js";

/**
 * O2 and Q1: every change to a line's status tells the event's assigned
 * coordinator, through one message shape the notification service already reads.
 */
export function lineStatusChangedMessage(input: {
  event: { id: string; name: string; assignedCoordinatorId: string };
  previous: RequestLine;
  updated: RequestLine;
  actor: OutboxMessage["actor"];
  correlationId: string | null;
}): OutboxMessage {
  const { event, previous, updated, actor } = input;
  return {
    topic: KAFKA_TOPICS.equipmentRequest,
    messageType: "equipment-request.line-status-changed",
    aggregateId: updated.id,
    actor,
    correlationId: input.correlationId,
    payload: {
      eventId: event.id,
      eventReference: updated.eventReference,
      eventName: event.name,
      lineId: updated.id,
      coordinatorId: event.assignedCoordinatorId,
      equipmentTypeName: updated.equipmentTypeName,
      quantity: updated.quantity,
      previousStatus: previous.status,
      newStatus: updated.status,
      reason: updated.unavailableReason,
      substituteEquipmentTypeName: updated.substituteEquipmentTypeName,
      substituteQuantity: updated.substituteQuantity,
      changedBy: actor.userId,
      changedAt: updated.statusChangedAt,
    },
  };
}
```

`OutboxMessage["actor"]` is `{ userId: string; role: string }` (`events/outbox.ts`), so `req.actor` fits.

- [ ] **Step 2: Use it in O2's route.** Replace the `writeOutbox(tx, { topic: …, payload: { … } })` block with:

```ts
        if (event.assignedCoordinatorId) {
          await writeOutbox(
            tx,
            lineStatusChangedMessage({
              event: { id: event.id, name: event.name, assignedCoordinatorId: event.assignedCoordinatorId },
              previous: current,
              updated,
              actor: req.actor!,
              correlationId: req.header("x-correlation-id") ?? null,
            }),
          );
        }
```

and import `lineStatusChangedMessage` from `../events/lineStatusMessage.js`; drop `KAFKA_TOPICS` from the imports if now unused.

- [ ] **Step 3: Verify O2 is unchanged** — typecheck and lint locally; O2's cards (`o2Cards.test.ts`, O2-T9 checks the message) run in CI.

Run: `npm run typecheck && npm run lint`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add backend/services/planning-core/src/modules/equipment/events/lineStatusMessage.ts backend/services/planning-core/src/modules/equipment/api/requestLines.ts
git commit -m "refactor(q1): share the line-status-changed message between O2 and Q1"
```

---

### Task 9: The route and the automated cards

**Files:** Create `PC/src/modules/equipment/api/reservations.ts`; modify `PC/src/modules/equipment/index.ts`; create `PC/tests/equipment/api/q1Cards.test.ts`.

- [ ] **Step 1: Write the card tests** — one `it` per card Q1-T1…Q1-T12, each named `"Q1-Tn <scenario>"` (the space after the id matters for `-t`). Start from `o2Cards.test.ts`'s setup verbatim (the two `vi.mock`s, `signedInAs`, `bearer`, `SLACK_MS`), with `actorsWithPrefix("0b600000")`, and FX-Q1 built in `beforeEach`:

```ts
  event = await createEvent(sql, { ownerId: A.org, coordinatorId: A.c1, name: "Q1 fixture event" });
  chairs = await createBulkType(sql, A.ts, "Q1 Chairs", 10);
  projectors = await createSerializedType(sql, A.ts, "Q1 Projectors", ["P-01", "P-02", "P-03"]);
  asTs();
```

Helpers:

```ts
const reserve = (id: string, body: unknown = {}) => request(app).post(`${BASE}/${id}/reservation`).set(bearer).send(body as object);
const line = (typeId: string, quantity: number, changes: Record<string, unknown> = {}) =>
  insertLineDirect(sql, { event, equipmentTypeId: typeId, requestedBy: A.c1, status: "CONFIRMED", quantity, ...changes });
const availability = async (typeId: string, startsAt = EVENT_START, endsAt = EVENT_END) =>
  (await request(app).get(`/api/v1/equipment/types/${typeId}/availability`).query({ startsAt, endsAt, requestedQuantity: 1 }).set(bearer)).body;
const reservationsFor = (lineId: string) => sql`select * from equipment.reservations where request_line_id = ${lineId}`;
const useUp = (typeId: string, quantity: number, startsAt = EVENT_START, endsAt = EVENT_END) =>
  reserveBulkDirect(sql, { equipmentTypeId: typeId, quantity, startsAt, endsAt, actorUserId: A.ts });
```

Each test asserts exactly the card's Expected Result from Task 1. Two written out in full as the pattern:

```ts
  it("Q1-T1 reserves a Confirmed bulk line and reduces availability by exactly that quantity", async () => {
    const id = await line(chairs.id, 4);
    const before = Date.now();
    const response = await reserve(id);
    const after = Date.now();

    expect(response.status).toBe(201);
    expect(response.body.reservation).toMatchObject({
      eventId: event.id,
      eventReference: event.reference,
      equipmentTypeId: chairs.id,
      kind: "BULK",
      requestedQuantity: 4,
      reservedQuantity: 4,
      startsAt: EVENT_START,
      endsAt: EVENT_END,
      reservedBy: A.ts,
      status: "RESERVED",
    });
    const reservedAt = new Date(response.body.reservation.reservedAt).getTime();
    expect(reservedAt).toBeGreaterThanOrEqual(before - SLACK_MS);
    expect(reservedAt).toBeLessThanOrEqual(after + SLACK_MS);
    expect(response.body.line).toMatchObject({ status: "RESERVED", statusChangedBy: A.ts });
    expect((await availability(chairs.id)).availableQuantity).toBe(6);
    const lastHour = new Date(new Date(EVENT_END).getTime() - 3_600_000).toISOString();
    expect((await availability(chairs.id, lastHour, EVENT_END)).availableQuantity).toBe(6);
  });

  it("Q1-T5 refuses one more than available, naming the shortfall, and stores nothing", async () => {
    await useUp(chairs.id, 7);
    const id = await line(chairs.id, 4);
    const historyBefore = (await sql`select count(*)::int as n from equipment.request_line_history where line_id = ${id}`)[0]!.n;

    const response = await reserve(id);

    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({ code: "INSUFFICIENT_EQUIPMENT", details: { available: 3, shortfall: 1 } });
    expect(response.body.error.message).toContain("4 requested, 3 available, 1 short");
    expect(await reservationsFor(id)).toHaveLength(0);
    expect((await availability(chairs.id)).availableQuantity).toBe(3);
    expect((await sql`select status from equipment.equipment_request_lines where id = ${id}`)[0]!.status).toBe("CONFIRMED");
    expect((await sql`select count(*)::int as n from equipment.request_line_history where line_id = ${id}`)[0]!.n).toBe(historyBefore);
    expect(await sql`select 1 from equipment.outbox where message_key = ${id}`).toHaveLength(0);
  });
```

Q1-T10's notification half follows O2-T9 in `o2Cards.test.ts`: read the outbox row, `parseCloudEvent` it, pass it to `notificationsFor`, and expect one notification for C1 whose message contains `event.reference`. Q1-T11 loops `signedInAs(A.c1, "EVENT_COORDINATOR")`, `(A.org, "EVENT_ORGANISER")`, `(A.vs, "VENUE_STAFF")`, `(A.att, "ATTENDEE")`, expecting 403 each, then `asTs()` and `reserve(unknownId())` expecting 404 `EQUIPMENT_LINE_NOT_FOUND`. Q1-T12 uses `useUp(chairs.id, 10, EVENT_END, <EVENT_END + 2h>)` then a line of 10 and expects 201.

- [ ] **Step 2: Implement the router**

```ts
import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import type { Sql } from "postgres";
import { EQUIPMENT_LINE_STATUS_LABELS } from "@connectsphere/contracts";
import { findEventForPlanning } from "../../event/index.js";
import { authenticate, requireRole, type ActorRequest } from "../auth/actor.js";
import { InsufficientEquipmentError } from "../domain/availability.js";
import { validateReservationBody } from "../domain/reservations.js";
import { lineStatusChangedMessage } from "../events/lineStatusMessage.js";
import { writeOutbox } from "../events/outbox.js";
import { reserveLine } from "../repo/reservations.js";
import { findLine, type RequestLine } from "../repo/requestLines.js";
import { refuse } from "./errors.js";
import { equipmentRateLimiter } from "./limiter.js";

/** Q1 — Technical Support reserve a Confirmed or Substituted line's equipment. */
const TECH_SUPPORT = "TECH_SUPPORT_STAFF";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALL_EVENTS = { scopeType: "ALL" } as const;

const present = (line: RequestLine) => Object.fromEntries(Object.entries(line).filter(([key]) => key !== "seq"));
const lineNotFound = (res: Response) => refuse(res, 404, "EQUIPMENT_LINE_NOT_FOUND", "No equipment request line with that id exists.");

export function reservationsRouter(sql: Sql, limiter: RequestHandler = equipmentRateLimiter()) {
  const router = Router();

  router.post(
    "/api/v1/equipment/request-lines/:id/reservation",
    limiter,
    authenticate,
    requireRole(TECH_SUPPORT),
    async (req: ActorRequest, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id!;
        if (!UUID.test(id)) return lineNotFound(res);
        const checked = validateReservationBody(req.body ?? {});
        if (!checked.ok) {
          return refuse(res, 400, "VALIDATION_FAILED", "The equipment could not be reserved. Check the highlighted fields.", checked.fields);
        }
        const existing = await findLine(sql, id);
        if (!existing) return lineNotFound(res);
        const event = await findEventForPlanning(sql, existing.eventId, ALL_EVENTS, req.actor!.userId);
        if (!event) return refuse(res, 404, "EVENT_NOT_FOUND", "No event with that id exists.");

        let outcome;
        try {
          outcome = await sql.begin(async (tx) => {
            const result = await reserveLine(tx, id, checked.body, req.actor!);
            if (result.ok && event.assignedCoordinatorId) {
              await writeOutbox(
                tx,
                lineStatusChangedMessage({
                  event: { id: event.id, name: event.name, assignedCoordinatorId: event.assignedCoordinatorId },
                  previous: result.previous,
                  updated: result.line,
                  actor: req.actor!,
                  correlationId: req.header("x-correlation-id") ?? null,
                }),
              );
            }
            return result;
          });
        } catch (error) {
          if (!(error instanceof InsufficientEquipmentError)) throw error;
          return refuse(res, 409, "INSUFFICIENT_EQUIPMENT", error.message, undefined, {
            requested: error.requested,
            available: error.available,
            shortfall: error.shortfall,
          });
        }

        if (outcome.ok) {
          res.status(201).json({ reservation: outcome.reservation, line: present(outcome.line) });
          return;
        }
        switch (outcome.code) {
          case "GONE":
            return lineNotFound(res);
          case "VALIDATION_FAILED":
            return refuse(res, 400, "VALIDATION_FAILED", "The equipment could not be reserved. Check the highlighted fields.", outcome.fields);
          case "PARTIAL_NOT_CONFIRMED":
            return refuse(res, 409, "PARTIAL_NOT_CONFIRMED", outcome.message);
          case "LINE_NOT_RESERVABLE":
            return refuse(
              res,
              409,
              "LINE_NOT_RESERVABLE",
              `This line is ${EQUIPMENT_LINE_STATUS_LABELS[outcome.status]}. Only Confirmed or Substituted lines can be reserved.`,
              undefined,
              { status: outcome.status },
            );
        }
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
```

A second Reserve racing on the same line is serialised by `lockLine`, so the loser sees `RESERVED` and gets `LINE_NOT_RESERVABLE`; the unique index is the backstop. If the unique index ever fires (`23505` on `reservations_one_active_per_line`), let it reach `next(error)` — it means the lock was bypassed, which is a bug, not a user error.

- [ ] **Step 3: Mount it** in `index.ts` after `requestLinesRouter`:

```ts
import { reservationsRouter } from "./api/reservations.js";
…
  router.use(requestLinesRouter(sql, limiter));
  router.use(reservationsRouter(sql, limiter));
```

- [ ] **Step 4: Typecheck, lint, boundaries**

Run: `npm run typecheck && npm run lint && npm run lint:boundaries`
Expected: exit 0. `q1Cards.test.ts` runs in CI's integration job.

- [ ] **Step 5: Commit**

```bash
git add backend/services/planning-core/src/modules/equipment/api/reservations.ts backend/services/planning-core/src/modules/equipment/index.ts backend/services/planning-core/tests/equipment/api/q1Cards.test.ts
git commit -m "feat(q1): POST a line's reservation, with a test per card"
```

---

### Task 10: The race (Q1-T13)

**Files:** Modify `PC/tests/race/invariants.test.ts`.

- [ ] **Step 1: Add the race through `reserveLine`** inside the existing `describe` that holds the EN-02.3 Q1 races (after "Q1: exactly one of 50 reservations of the last chair…"):

```ts
  it("Q1-T13 exactly one of 50 lines reserves the last unit, for bulk and serialized stock", async () => {
    for (const kind of ["BULK", "SERIALIZED"] as const) {
      for (let round = 0; round < ROUNDS; round++) {
        const [type] = await sql<{ id: string }[]>`
          insert into equipment.equipment_types (name, kind, total_quantity, created_by, updated_by)
          values (${`Q1-T13 ${kind} ${randomUUID().slice(0, 8)}`}, ${kind}, ${kind === "BULK" ? 1 : null}, ${ACTOR}, ${ACTOR})
          returning id
        `;
        if (kind === "SERIALIZED") {
          await sql`
            insert into equipment.equipment_units (equipment_type_id, label, created_by, updated_by)
            values (${type!.id}, 'LAST', ${ACTOR}, ${ACTOR})
          `;
        }
        const lineIds: string[] = [];
        for (let i = 0; i < ATTEMPTS; i++) {
          const [row] = await sql<{ id: string }[]>`
            insert into equipment.equipment_request_lines
              (event_id, event_reference, equipment_type_id, quantity, required_from, required_to, status,
               requested_by, created_by, updated_by)
            values
              (${randomUUID()}, ${`EVT-Q1-${String(i).padStart(2, "0")}`}, ${type!.id}, 1,
               ${at("09:00")}, ${at("12:00")}, 'CONFIRMED', ${ACTOR}, ${ACTOR}, ${ACTOR})
            returning id
          `;
          lineIds.push(row!.id);
        }

        const results = await race(ATTEMPTS, (tx, i) =>
          reserveLine(tx, lineIds[i]!, { quantity: null, partial: false }, { userId: ACTOR, role: "TECH_SUPPORT_STAFF" }),
        );

        expect(winners(results)).toHaveLength(1);
        for (const reason of losers(results)) {
          expect(reason).toBeInstanceOf(InsufficientEquipmentError);
          expect(reason).toMatchObject({ requested: 1, available: 0, shortfall: 1 });
        }
        const [stored] = await sql<{ n: number }[]>`
          select count(*)::int as n from equipment.reservations where equipment_type_id = ${type!.id} and status = 'RESERVED'
        `;
        expect(stored!.n).toBe(1);
        const [stillConfirmed] = await sql<{ n: number }[]>`
          select count(*)::int as n from equipment.equipment_request_lines where id in ${sql(lineIds)} and status = 'CONFIRMED'
        `;
        expect(stillConfirmed!.n).toBe(ATTEMPTS - 1);
      }
    }
  });
```

Import `reserveLine` from `../../src/modules/equipment/repo/reservations.js`. `winners` counts every fulfilled attempt, so a resolved `{ ok: false }` would count as a win; it cannot happen here (every line is Confirmed with quantity 1, so the only refusal is the thrown shortfall), and the test pins that by also asserting `expect(winners(results)[0]).toMatchObject({ ok: true })` after the `toHaveLength(1)`.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0. The race runs in CI only (it skips itself elsewhere).

- [ ] **Step 3: Commit**

```bash
git add backend/services/planning-core/tests/race/invariants.test.ts
git commit -m "test(q1): race fifty lines for the last unit through reserveLine"
```

---

### Task 11: OpenAPI

**Files:** Modify `documentation/api/planning-core.openapi.yaml`.

- [ ] **Step 1: Add the path** after `/api/v1/equipment/request-lines/{id}/status`, following that path's layout (tags, security, `id` parameter, error responses via `$ref` to the shared `Error` response):

- `post`, summary "Reserve a Confirmed or Substituted line's equipment (Q1)".
- Request body schema `ReservationRequest`: `quantity` integer minimum 1 (optional; defaults to the requested quantity), `partial` boolean (optional; required true to reserve fewer than requested).
- Responses: `201` with `{ reservation: Reservation, line: EquipmentRequestLine }`; `400` `VALIDATION_FAILED`; `401`; `403`; `404` `EQUIPMENT_LINE_NOT_FOUND`; `409` description "`LINE_NOT_RESERVABLE` (names the status), `PARTIAL_NOT_CONFIRMED`, or `INSUFFICIENT_EQUIPMENT` with `details.available` and `details.shortfall`"; `429`.

- [ ] **Step 2: Add schemas** `ReservationRequest` and `Reservation` (properties exactly as `ReservationRecord` in Task 7, with `kind` enum `[SERIALIZED, BULK]`, `status` enum `[RESERVED, RELEASED]`, date-times as `format: date-time`), and add `reservation` (nullable, `LineReservation` with the Task 6 fields) to the existing request-line schema.

- [ ] **Step 3: Lint**

Run: `npm run lint:api`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add documentation/api/planning-core.openapi.yaml
git commit -m "docs(q1): describe the reservation route"
```

---

### Task 12: The screen

**Files:** Modify `frontend/src/api/equipmentRequests.ts`, `frontend/src/screens/EquipmentRequests.tsx`, `frontend/src/screens/EquipmentRequest.tsx`; test `frontend/tests/equipmentRequests.test.tsx`.

- [ ] **Step 1: Client.** In `equipmentRequests.ts` add to `RequestLine`:

```ts
  /** Q1: the active reservation, or null. */
  reservation: {
    id: string;
    equipmentTypeId: string;
    requestedQuantity: number;
    reservedQuantity: number;
    reservedBy: string;
    reservedAt: string;
  } | null;
```

and:

```ts
export interface ReservationInput {
  quantity?: number | null;
  partial?: boolean;
}

export function reserveLine(token: string, id: string, input: ReservationInput) {
  return request<{ reservation: { id: string; reservedQuantity: number; requestedQuantity: number }; line: RequestLine }>(
    `${LINES}/${encodeURIComponent(id)}/reservation`,
    { method: "POST", token, body: input },
  );
}
```

- [ ] **Step 2: Write the failing screen tests** in `frontend/tests/equipmentRequests.test.tsx`. Add `reservation: null` to the `line()` factory. Extend `fetchMock` with a reservation route before the status route:

```ts
  const reserveRoute = url.pathname.match(/request-lines\/([^/]+)\/reservation$/);
  if (reserveRoute && method === "POST") return onReserve(reserveRoute[1]!, JSON.parse(init!.body as string));
```

with `let onReserve: (id: string, body: Record<string, unknown>) => Response;` defaulting in `beforeEach` to a 201 whose `line` is `line({ id, status: "RESERVED", reservation: { id: "r1", equipmentTypeId: CHAIRS, requestedQuantity: 40, reservedQuantity: body.quantity ?? 40, reservedBy: TECH, reservedAt: "2026-10-15T02:00:00.000Z" } })`. Tests:

```ts
describe("Q1: reserving from the equipment requests screen", () => {
  it("offers Reserve only on Confirmed and Substituted lines", async () => {
    lines = [line({ id: "c", status: "CONFIRMED" }), line({ id: "s", status: "SUBSTITUTED", substituteEquipmentTypeName: "Projectors", substituteQuantity: 2 }), line({ id: "u", status: "UNDER_REVIEW" })];
    render(<App />);
    await screen.findAllByText("EVT-000123");
    expect(screen.getAllByRole("button", { name: "Reserve" })).toHaveLength(2);
  });

  it("asks for confirmation before a partial reservation, then shows Reserved n of m", async () => {
    lines = [line({ id: "c", status: "CONFIRMED" })];
    onReserve = (id, body) =>
      body.partial
        ? reply({ reservation: { id: "r1", reservedQuantity: 30, requestedQuantity: 40 }, line: line({ id, status: "RESERVED", reservation: { id: "r1", equipmentTypeId: CHAIRS, requestedQuantity: 40, reservedQuantity: 30, reservedBy: TECH, reservedAt: "2026-10-15T02:00:00.000Z" } }) }, 201)
        : reply({ error: { code: "PARTIAL_NOT_CONFIRMED", message: "40 were requested. Confirm a partial reservation to reserve 30.", correlationId: null } }, 409);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Reserve" }));
    fireEvent.change(screen.getByLabelText("Quantity to reserve"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Reserve equipment" }));
    expect(await screen.findByText(/Confirm a partial reservation to reserve 30/)).toBeTruthy();

    lines = [line({ id: "c", status: "RESERVED", reservation: { id: "r1", equipmentTypeId: CHAIRS, requestedQuantity: 40, reservedQuantity: 30, reservedBy: TECH, reservedAt: "2026-10-15T02:00:00.000Z" } })];
    fireEvent.click(screen.getByLabelText("Reserve fewer than requested"));
    fireEvent.click(screen.getByRole("button", { name: "Reserve equipment" }));
    expect(await screen.findByText("Reserved 30 of 40")).toBeTruthy();
  });

  it("shows the shortfall when there is not enough stock, and the line stays Confirmed", async () => {
    lines = [line({ id: "c", status: "CONFIRMED" })];
    onReserve = () => reply({ error: { code: "INSUFFICIENT_EQUIPMENT", message: "Not enough available for this period: 40 requested, 35 available, 5 short.", details: { available: 35, shortfall: 5 }, correlationId: null } }, 409);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Reserve" }));
    fireEvent.click(screen.getByRole("button", { name: "Reserve equipment" }));
    expect(await screen.findByText(/5 short/)).toBeTruthy();
    expect(screen.getAllByText("Confirmed").length).toBeGreaterThan(0);
  });
});
```

Run: `npm test -w @connectsphere/web -- tests/equipmentRequests.test.tsx`
Expected: the three new tests FAIL (no Reserve button).

- [ ] **Step 3: Implement in `EquipmentRequests.tsx`**

State and actions, beside the O2 ones:

```tsx
  const [reserving, setReserving] = useState<RequestLine | null>(null);
  const [reserveQuantity, setReserveQuantity] = useState("");
  const [partial, setPartial] = useState(false);
  const [reserveError, setReserveError] = useState<unknown>(null);

  const requestedFor = (line: RequestLine) => (line.status === "SUBSTITUTED" ? line.substituteQuantity ?? line.quantity : line.quantity);

  function openReserve(line: RequestLine) {
    setUpdated(null);
    setUpdating(null);
    setReserveError(null);
    setPartial(false);
    setReserveQuantity(String(requestedFor(line)));
    setReserving(line);
  }

  async function reserve() {
    if (!reserving) return;
    setBusy(true);
    setReserveError(null);
    try {
      const done = await reserveLine(session.token, reserving.id, { quantity: finiteNumber(reserveQuantity), partial });
      setUpdated(
        `Reserved ${done.reservation.reservedQuantity} of ${done.reservation.requestedQuantity} for ${done.line.eventReference}.`,
      );
      setReserving(null);
      await load();
    } catch (caught) {
      // Nothing was reserved; the refusal says why.
      setReserveError(caught);
    } finally {
      setBusy(false);
    }
  }
```

Status cell: after the Substituted block, add

```tsx
                  {line.reservation && (
                    <div style={{ fontSize: 12 }}>
                      Reserved {line.reservation.reservedQuantity} of {line.reservation.requestedQuantity}
                    </div>
                  )}
```

Actions cell: replace the ternary with

```tsx
              content:
                line.status === "RESERVED" ? (
                  <span style={{ fontSize: 12, color: "#626F86" }}>Reserved</span>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button onClick={() => open(line)}>Update</Button>
                    {(line.status === "CONFIRMED" || line.status === "SUBSTITUTED") && (
                      <Button onClick={() => openReserve(line)}>Reserve</Button>
                    )}
                  </div>
                ),
```

Also set `setReserving(null)` inside `open()` so only one form shows. The form, after the `{updating && …}` block:

```tsx
      {reserving && (
        <div style={{ marginTop: 24, maxWidth: 640 }}>
          <h3>
            Reserve {reserving.status === "SUBSTITUTED" ? reserving.substituteEquipmentTypeName : reserving.equipmentTypeName} ×{" "}
            {requestedFor(reserving)} for {reserving.eventReference}
          </h3>
          <Refusal error={reserveError} />
          <div style={{ marginBottom: 12, maxWidth: 200 }}>
            <label htmlFor="reserve-quantity">Quantity to reserve</label>
            <Textfield
              id="reserve-quantity"
              type="number"
              min={1}
              step={1}
              value={reserveQuantity}
              isInvalid={Boolean(fieldMessage(reserveError, "quantity"))}
              onChange={(event) => setReserveQuantity(event.currentTarget.value)}
            />
            {fieldMessage(reserveError, "quantity") && (
              <p style={{ color: "#AE2A19", margin: "4px 0 0" }}>{fieldMessage(reserveError, "quantity")}</p>
            )}
          </div>
          {Number(reserveQuantity) < requestedFor(reserving) && (
            <div style={{ marginBottom: 12 }}>
              <label>
                <input type="checkbox" checked={partial} onChange={(event) => setPartial(event.currentTarget.checked)} /> Reserve
                fewer than requested
              </label>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <Button appearance="primary" isDisabled={busy} onClick={() => void reserve()}>
              Reserve equipment
            </Button>
            <Button appearance="subtle" onClick={() => setReserving(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
```

The checkbox's accessible name must be exactly "Reserve fewer than requested" (the test finds it by label); render the text on one line in the JSX if your formatter splits it.

Import `reserveLine` from `../api/equipmentRequests.js`. The success banner keeps its title "Status updated"; its message says what was reserved.

- [ ] **Step 4: Coordinator's view.** In `EquipmentRequest.tsx`, wherever a line's status lozenge renders, add the same `line.reservation && <div …>Reserved n of m</div>` block.

- [ ] **Step 5: Run the web tests**

Run: `npm test -w @connectsphere/web`
Expected: all pass, including the O2 tests already in the file.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/equipmentRequests.ts frontend/src/screens/EquipmentRequests.tsx frontend/src/screens/EquipmentRequest.tsx frontend/tests/equipmentRequests.test.tsx
git commit -m "feat(q1): reserve a line from the equipment requests screen"
```

---

### Task 13: Traceability, changelog, CI, PR

**Files:** Create `documentation/traceability/sprint-3.csv` (or append if a teammate created it); modify `CHANGELOG.md`.

- [ ] **Step 1: Traceability** — header `story_id,acceptance_criterion,test_file,test_name` (same as `sprint-2.csv`), one row per (AC, test):

```csv
story_id,acceptance_criterion,test_file,test_name
Q1,AC1,backend/services/planning-core/tests/equipment/api/q1Cards.test.ts,Q1-T1 reserves a Confirmed bulk line and reduces availability by exactly that quantity
Q1,AC1,backend/services/planning-core/tests/equipment/api/q1Cards.test.ts,Q1-T2 …
```

Use the exact `it` names from `q1Cards.test.ts`, the race test name for AC2, and the domain test names for AC5/AC6.

- [ ] **Step 2: CHANGELOG** — a new entry directly under the header (newest first), in the house format (`# Q1: …`, Timestamp SGT, Author `Raphael, via Claude`, Scope, Reason, `## Added`, `## Changed`, `## Tested`). Under Changed, note that `equipment.reservations` must be applied to the shared database after merge (`npm run migrate -- equipment`), and that until then the equipment request screens fail locally, because lines now join their reservation.

- [ ] **Step 3: Full local gates**

Run: `npm run lint && npm run lint:boundaries && npm run lint:api && npm run typecheck && npm run build`, then unit tests with the placeholder env, then `npm test -w @connectsphere/web`.
Expected: all exit 0.

- [ ] **Step 4: Commit, push, open the PR**

```bash
git add documentation/traceability/sprint-3.csv CHANGELOG.md
git commit -m "docs(q1): trace Q1's criteria and record it in the changelog"
git push -u origin feature-raphael/q1-reserve-equipment
```

Open the PR against `main` with `gh pr create`, body: what changes, the card table with statuses, the shared-DB migration note, and "🤖 Generated with [Claude Code](https://claude.com/claude-code)" as the last line. Wait for CI; the integration job is where Tasks 5, 7, 9 and 10's tests actually run — fix anything red before asking for review.

- [ ] **Step 5: Record card results** — once CI is green, fill each automated card's Execution record (Status `Pass (automated, API level)`, Remarks with the commit SHA and the CI run URL, Executed By `Raphael, via automated testing (CI)`), as O2's cards do. Q1-T14 stays `Not Executed` until it is run in the browser after the shared DB is migrated. Commit and push.
