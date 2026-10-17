# Q2 — Release an Equipment Reservation: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Technical Support release a request line's reservation with a reason; a coordinator's removal of a Reserved line releases it too; F4 gets a function to release an event's reservations (SPM-51).

**Architecture:** Release adds three columns to Q1's `equipment.reservations` and flips the reservation and its unit/bulk rows to RELEASED in the caller's transaction, so availability (which counts only RESERVED rows) gets the stock back. `releaseLine` puts the line back to Confirmed or Substituted; O1's removal now accepts Reserved lines and releases first. Every release sends O2's line-status-changed message with a new `released` flag that the notification service words as a release.

**Tech Stack:** TypeScript, Express, porsager `postgres`, zod, Vitest + supertest, React + Atlaskit.

**Spec:** `documentation/superpowers/specs/2026-10-16-q2-release-reservation-design.md`. **Branch:** `feature-raphael/q2-release-reservation`, stacked on `feature-raphael/q1-reserve-equipment` (PR #42).

---

## Ground rules for every task

- Read `CLAUDE.md` and `documentation/planning/implementation.md` first. `PC` = `backend/services/planning-core`.
- **Never** run migrations or writes against the shared Supabase database, never point race tests at it, never read `.env`. Integration tests needing migrations 0005–0008 run only in CI's throwaway Postgres.
- Unit tests locally need CI's placeholder env:
  `DATABASE_URL=postgres://ci:ci@127.0.0.1:1/ci_unused SUPABASE_URL=https://ci.invalid SUPABASE_ANON_KEY=ci-placeholder SUPABASE_JWKS_URL=https://ci.invalid/auth/v1/.well-known/jwks.json`.
- Before each commit: `npm run lint && npm run lint:boundaries && npm run typecheck` (root). Root typecheck covers `src` only; type-check new test files ad hoc with a temporary tsconfig and delete it.
- Conventional Commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Q1's code is the pattern to follow: `repo/reservations.ts` (`reserveLine`), `api/reservations.ts` (route), `tests/equipment/api/q1Cards.test.ts`, `tests/support/lineFixtures.ts`.

## File map

| File | Responsibility |
|---|---|
| `tests/Q2/README.md`, `tests/Q2/Q2-T*.md` | The 13 cards and FX-Q2 |
| `backend/packages/contracts/src/errorCodes.ts` + OpenAPI `ErrorCode` | `LINE_NOT_RELEASABLE`, `RESERVATION_ALREADY_RELEASED` |
| `backend/packages/contracts/src/equipmentRequestEvents.ts` | optional `released` on the line-status-changed payload |
| `PC/migrations/equipment/0007_reservation_release.sql`, `0008_validate_reservation_release.sql` | release columns + check |
| `PC/src/modules/equipment/domain/reservations.ts` | `validateReleaseBody`, `statusAfterRelease` |
| `PC/src/modules/equipment/repo/releases.ts` | `releaseReservation`, `releaseLine`, `releaseEventReservations` |
| `PC/src/modules/equipment/repo/requestLines.ts` | `markReleased` |
| `PC/src/modules/equipment/repo/reservations.ts` | `ReservationRecord` gains release fields |
| `PC/src/modules/equipment/events/lineStatusMessage.ts` | `release` option |
| `PC/src/modules/equipment/api/releases.ts` | the release route |
| `PC/src/modules/equipment/api/requestLines.ts` | removal accepts Reserved lines |
| `PC/src/modules/equipment/index.ts` | mount router; export `releaseEventReservations` |
| `backend/services/notification/src/domain/recipients.ts` | release wording |
| `PC/tests/equipment/api/q2Cards.test.ts`, `PC/tests/equipment/repo/releases.test.ts`, `PC/tests/equipment/domain/reservations.test.ts`, `PC/tests/race/invariants.test.ts` | tests |
| `frontend/src/api/equipmentRequests.ts`, `frontend/src/screens/EquipmentRequests.tsx`, `frontend/src/screens/EquipmentRequest.tsx`, `frontend/tests/equipmentRequests.test.tsx`, `frontend/tests/equipmentRequest.test.tsx` | Release and Remove |
| OpenAPI, `documentation/traceability/sprint-3.csv`, `CHANGELOG.md` | docs |

---

### Task 1: Cards (before any code)

**Files:** `tests/Q2/README.md` and 13 cards, in exactly the layout of `tests/Q1/README.md` and `tests/Q1/Q1-T1-reserve-bulk-line.md` (Specification table, the PR-reviewer note, Execution record with Status `Not Executed`).

- [ ] **Step 1: README** — as `tests/Q1/README.md`, with fixture **FX-Q2** = FX-Q1 (actors TS, C1, ORG, VS, ATT; E1 Approved, coordinator C1, `D 14:00`–`D 18:00` UTC; CHAIRS bulk 10; PROJECTORS serialized P-01..P-03) plus **L1**: a CHAIRS line ×4 for E1, Confirmed, then reserved by TS through `POST …/request-lines/<L1>/reservation` (6 CHAIRS left). Run command: `npm test -w @connectsphere/planning-core -- tests/equipment/api/q2Cards.test.ts -t 'Q2-Tn '`; Q2-T6 in `tests/race/invariants.test.ts` on CI only; Q2-T12 Not Executed until F4; Q2-T13 manual.

- [ ] **Step 2: Cards.** API calls are `POST /api/v1/equipment/request-lines/<id>/release` as TS unless stated.

| File | Pre-conditions (after FX-Q2) | Body / action | Expected result |
|---|---|---|---|
| `Q2-T1-release-with-reason.md` | — | `{"reason":"Event moved to a smaller room"}` on L1 | 200. `reservation` has status RELEASED, releasedBy TS, releasedAt between the instants around the request, releaseReason `Event moved to a smaller room`, and the same id, requestedQuantity 4, reservedQuantity 4, reservedBy TS as before. The `equipment.reservations` row still exists. `line.status` is CONFIRMED, statusChangedBy TS. CHAIRS availability for E1's window is 10. |
| `Q2-T2-release-serialized.md` | A PROJECTORS line ×2, Confirmed, reserved (P-01, P-02) | `{"reason":"Not needed"}` | 200; both `unit_reservations` rows of the reservation are RELEASED; PROJECTORS availability for E1's window is 3. |
| `Q2-T3-substituted-line-returns-to-substituted.md` | A PROJECTORS line ×2 Substituted with CHAIRS ×5, reserved (5 CHAIRS) | `{"reason":"Not needed"}` | 200; line status SUBSTITUTED with its substitute (CHAIRS ×5) unchanged; CHAIRS availability 10 minus L1's 4 = 6. |
| `Q2-T4-reason-required.md` | — | `{}`, `{"reason":""}`, `{"reason":"   "}` on L1 | Each 400 `VALIDATION_FAILED` with field `reason`. L1 still RESERVED, reservation still RESERVED with null release fields, availability 6, no new history entry. |
| `Q2-T5-second-release-changes-nothing.md` | L1 released once (as T1) | `{"reason":"Again"}` on L1 | 409 `LINE_NOT_RELEASABLE` naming Confirmed. `released_at` and `release_reason` equal the first release's; availability 10; one release history entry. |
| `Q2-T6-concurrent-release-race.md` | A Reserved line (bulk) on CI's throwaway Postgres | 50 simultaneous `releaseLine` calls, 10 rounds | Exactly one succeeds per round; the rest return `LINE_NOT_RELEASABLE` (status CONFIRMED); the reservation has one `released_at`; the line has exactly one history entry with `details.released` true. |
| `Q2-T7-only-reserved-lines-releasable.md` | Six CHAIRS lines: Submitted, Under Review, Confirmed, Unavailable, Substituted (CHAIRS ×1), Removed | `{"reason":"x"}` each | Each 409 `LINE_NOT_RELEASABLE`; message names the status label; `details.status` the code; nothing changes. |
| `Q2-T8-coordinator-removal-releases.md` | — | As C1: `POST /api/v1/equipment/request-lines/<L1>/removal` | 200; L1 status REMOVED; its reservation RELEASED with releasedBy C1, releaseReason `Request line removed`; CHAIRS availability 10. |
| `Q2-T9-coordinator-notified.md` | — | T1's release on L1; separately (fresh FX-Q2) C1's removal of L1 | Each writes one `equipment-request.line-status-changed` outbox message for the line with coordinatorId C1 and `released: true`; passed through the notification service's recipient rule, each gives one notification for C1 whose text contains E1's reference, the equipment name, "released" and the reason. |
| `Q2-T10-roles-and-unknown-line.md` | — | As C1, ORG, VS, ATT on L1; then as TS on an unknown id | 403 each, L1 unchanged; 404 `EQUIPMENT_LINE_NOT_FOUND`. |
| `Q2-T11-release-then-reserve-again.md` | L1 released (T1) | `POST …/<L1>/reservation` `{}` as TS | 201; a new reservation (different id) of 4; the released one still exists, RELEASED. |
| `Q2-T12-event-cancellation-releases.md` | — | F4 cancels E1 | Every RESERVED reservation of E1 is RELEASED by the cancelling user with F4's reason; availability restored; C1 notified. **Not Executed until F4 (owning story F4).** |
| `Q2-T13-release-in-the-browser.md` | Standard environment, `KAFKA_*`, migrations applied; a Reserved chairs line from Q1-T14 | Browser: as techsupport → "Equipment requests" → "Release" → leave Reason empty → "Release reservation" → enter `Event moved` → "Release reservation"; reserve it again; as the coordinator → the event's equipment request → "Remove" on the Reserved line → confirm | Empty reason refused inline; release succeeds, banner "Equipment released", row Confirmed with Reserve available; coordinator's Remove dialog warns the equipment will be released; line Removed; coordinator has notifications naming the event and "released". |

Created By `Raphael, via Claude`, Date of Creation `2026-10-16`, plus the PR-reviewer note.

- [ ] **Step 3: Commit** — `test(q2): write the Q2 cards and fixture FX-Q2 before the code`.
- [ ] **Step 4: STOP — show Raphael the cards and wait for approval.**

---

### Task 2: Codes, message flag, migrations

**Files:** contracts `errorCodes.ts`, `equipmentRequestEvents.ts`; OpenAPI `ErrorCode`; `PC/migrations/equipment/0007_reservation_release.sql`, `0008_validate_reservation_release.sql`.

- [ ] **Step 1:** In `ERROR_CODES`, after `"PARTIAL_NOT_CONFIRMED",` add `"LINE_NOT_RELEASABLE", "RESERVATION_ALREADY_RELEASED",`. Add the same two to the OpenAPI `ErrorCode` enum in the same position (the unit test in `PC/tests/api/openapiRoutes.unit.test.ts` holds them equal).
- [ ] **Step 2:** In the line-status-changed payload schema in `equipmentRequestEvents.ts`, beside `reservedQuantity`, add:

```ts
  /** Q2: the change released the line's reservation; `reason` is the release reason. */
  released: z.boolean().optional(),
```

- [ ] **Step 3: 0007**

```sql
-- Q2 (SPM-51): a reservation is released, never deleted. It keeps who released
-- it, when and why. The check is added NOT VALID and validated in 0008, in its
-- own transaction; every existing row is RESERVED with these columns null.
alter table equipment.reservations
  add column released_by    uuid,
  add column released_at    timestamptz,
  add column release_reason text;

alter table equipment.reservations
  add constraint reservations_release_recorded check (
    (status = 'RESERVED' and released_by is null and released_at is null and release_reason is null)
    or (status = 'RELEASED' and released_by is not null and released_at is not null
        and release_reason is not null and length(btrim(release_reason)) > 0)
  ) not valid;
```

- [ ] **Step 4: 0008**

```sql
-- Q2: validates 0007's check in a transaction of its own.
alter table equipment.reservations validate constraint reservations_release_recorded;
```

- [ ] **Step 5:** `npm run build -w @connectsphere/contracts && npm run lint:api`, the planning-core unit suite (placeholder env), and `npx --yes squawk-cli@2.67.0` on 0007 and 0008. Expected: all clean. Commit `feat(q2): release codes, the released flag and the release columns`.

---

### Task 3: Domain rules

**Files:** `PC/src/modules/equipment/domain/reservations.ts`; tests appended to `PC/tests/equipment/domain/reservations.test.ts`.

- [ ] **Step 1: Failing tests**

```ts
import { statusAfterRelease, validateReleaseBody } from "../../../src/modules/equipment/domain/reservations.js";

describe("validateReleaseBody (Q2)", () => {
  it("accepts a reason and trims it", () => {
    expect(validateReleaseBody({ reason: "  Event moved  " })).toEqual({ ok: true, reason: "Event moved" });
  });
  it.each([{}, { reason: "" }, { reason: "   " }, { reason: 5 }, undefined, null])("refuses %p on reason", (body) => {
    const result = validateReleaseBody(body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fields.map((f) => f.field)).toEqual(["reason"]);
  });
  it("refuses a reason longer than O2's limit", () => {
    const result = validateReleaseBody({ reason: "x".repeat(1001) });
    expect(result.ok).toBe(false);
  });
  it("accepts a reason exactly at the limit", () => {
    expect(validateReleaseBody({ reason: "x".repeat(1000) }).ok).toBe(true);
  });
});

describe("statusAfterRelease (Q2)", () => {
  it("a line with a substitute goes back to Substituted", () => {
    expect(statusAfterRelease({ substituteEquipmentTypeId: "t", substituteQuantity: 5 })).toBe("SUBSTITUTED");
  });
  it("a line without one goes back to Confirmed", () => {
    expect(statusAfterRelease({ substituteEquipmentTypeId: null, substituteQuantity: null })).toBe("CONFIRMED");
  });
});
```

- [ ] **Step 2:** run (placeholder env) `npx vitest run -c vitest.unit.config.ts tests/equipment/domain/reservations.test.ts` in `PC` — FAIL (not exported).
- [ ] **Step 3: Implement** (append to `domain/reservations.ts`; import `MAX_REASON_LENGTH` from `./requestLines.js`):

```ts
/**
 * Q2 — Technical Support give a reason for every release, as O2 does for
 * Unavailable. Missing, blank or non-text reasons are refused on `reason`.
 */
export function validateReleaseBody(raw: unknown): { ok: true; reason: string } | { ok: false; fields: ErrorField[] } {
  const given = typeof raw === "object" && raw !== null && typeof (raw as { reason?: unknown }).reason === "string"
    ? (raw as { reason: string }).reason.trim()
    : "";
  if (given === "") return { ok: false, fields: [{ field: "reason", message: "Give a reason for releasing the reservation." }] };
  if (given.length > MAX_REASON_LENGTH) {
    return { ok: false, fields: [{ field: "reason", message: `The reason can be at most ${MAX_REASON_LENGTH} characters.` }] };
  }
  return { ok: true, reason: given };
}

/**
 * Q2 — a released line goes back to the status it was reserved from. O2 keeps
 * the substitute columns only while a line is Substituted, so their presence
 * says which.
 */
export function statusAfterRelease(line: {
  substituteEquipmentTypeId: string | null;
  substituteQuantity: number | null;
}): "CONFIRMED" | "SUBSTITUTED" {
  return line.substituteEquipmentTypeId && line.substituteQuantity ? "SUBSTITUTED" : "CONFIRMED";
}
```

If `domain/requestLines.ts` already imports from `domain/reservations.ts`, avoid a cycle by moving nothing — import only the constant; `npm run lint:boundaries` (dependency-cruiser) flags cycles.

- [ ] **Step 4:** full unit suite with coverage (placeholder env) — all pass, domain 100%. Add a test for `statusAfterRelease` with a type but null quantity if branch coverage asks for it.
- [ ] **Step 5:** commit `feat(q2): decide release reasons and where a released line goes`.

---

### Task 4: Repo — `releaseReservation`, `releaseLine`, `releaseEventReservations`

**Files:** create `PC/src/modules/equipment/repo/releases.ts`; modify `repo/reservations.ts` (record type), `repo/requestLines.ts` (`markReleased`); test `PC/tests/equipment/repo/releases.test.ts`.

- [ ] **Step 1: Extend `ReservationRecord`** in `repo/reservations.ts`: add `releasedBy: string | null; releasedAt: string | null; releaseReason: string | null;`, the matching `released_by`, `released_at: Date | null`, `release_reason` in `ReservationRow`, and in `toReservation`:

```ts
  releasedBy: row.released_by,
  releasedAt: row.released_at?.toISOString() ?? null,
  releaseReason: row.release_reason,
```

Export `toReservation` and `ReservationRow` for `releases.ts`.

- [ ] **Step 2: `markReleased`** in `repo/requestLines.ts`, after `markReserved`:

```ts
/** Q2: a Reserved line whose reservation was released goes back to Confirmed or Substituted. */
export async function markReleased(
  tx: TransactionSql,
  current: RequestLine,
  release: { reservationId: string; reason: string; status: "CONFIRMED" | "SUBSTITUTED" },
  actor: Actor,
): Promise<RequestLine> {
  await tx`
    update equipment.equipment_request_lines
    set status = ${release.status},
        status_changed_by = ${actor.userId}, status_changed_at = clock_timestamp(),
        updated_at = now(), updated_by = ${actor.userId}
    where id = ${current.id}
  `;
  await writeHistory(tx, {
    lineId: current.id,
    action: "STATUS_CHANGED",
    previousStatus: current.status,
    newStatus: release.status,
    equipmentTypeId: current.equipmentTypeId,
    quantity: current.quantity,
    details: { reservationId: release.reservationId, released: true, reason: release.reason },
    actor,
  });
  return (await findLine(tx, current.id))!;
}
```

Also give `markRemoved` an optional `details` parameter (default `{}`) so a removal that released a reservation records `{ reservationId, released: true, reason }`.

- [ ] **Step 3: Failing repo tests** (`releases.test.ts`, actor prefix `0b700000`, type names "Q2R …", fixtures from `lineFixtures.ts`; reserve through `reserveLine`):

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb } from "../../support/testDb.js";
import { actorsWithPrefix, cleanLineFixtures, createBulkType, createEvent, createSerializedType, insertLineDirect } from "../../support/lineFixtures.js";
import { reserveLine } from "../../../src/modules/equipment/repo/reservations.js";
import { releaseEventReservations, releaseLine, releaseReservation } from "../../../src/modules/equipment/repo/releases.js";

const sql = testDb();
const A = actorsWithPrefix("0b700000");
const TS = { userId: A.ts, role: "TECH_SUPPORT_STAFF" as const };
let event: { id: string; reference: string; name: string };
let chairs: { id: string };
let projectors: { id: string };

const clean = () => cleanLineFixtures(sql, [A.org], [A.ts]);
beforeEach(async () => {
  await clean();
  event = await createEvent(sql, { ownerId: A.org, coordinatorId: A.c1, name: "Q2 repo event" });
  chairs = await createBulkType(sql, A.ts, "Q2R Chairs", 10);
  projectors = await createSerializedType(sql, A.ts, "Q2R Projectors", ["P-01", "P-02", "P-03"]);
});
afterAll(async () => {
  await clean();
  await sql.end();
});

async function reserved(typeId: string, quantity: number, changes: Record<string, unknown> = {}) {
  const id = await insertLineDirect(sql, { event, equipmentTypeId: typeId, requestedBy: A.c1, status: "CONFIRMED", quantity, ...changes });
  const outcome = await sql.begin((tx) => reserveLine(tx, id, { quantity: null, partial: false }, TS));
  if (!outcome.ok) throw new Error(`fixture reserve failed: ${outcome.code}`);
  return { lineId: id, reservationId: outcome.reservation.id };
}
const release = (lineId: string, reason = "Not needed") => sql.begin((tx) => releaseLine(tx, lineId, reason, TS));

describe("releaseLine (Q2)", () => {
  it("releases bulk stock, keeps the record, and puts the line back to Confirmed", async () => {
    const { lineId, reservationId } = await reserved(chairs.id, 4);
    const outcome = await release(lineId, "Event moved");

    expect(outcome).toMatchObject({
      ok: true,
      reservation: { id: reservationId, status: "RELEASED", releasedBy: A.ts, releaseReason: "Event moved" },
      line: { status: "CONFIRMED", reservation: null },
    });
    const [bulk] = await sql`select status from equipment.bulk_reservations where reservation_id = ${reservationId}`;
    expect(bulk!.status).toBe("RELEASED");
    const [history] = await sql`
      select previous_status, new_status, details from equipment.request_line_history
      where line_id = ${lineId} order by occurred_at desc, created_at desc limit 1`;
    expect(history).toMatchObject({ previous_status: "RESERVED", new_status: "CONFIRMED", details: { reservationId, released: true, reason: "Event moved" } });
  });

  it("releases every unit of a serialized reservation", async () => {
    const { lineId, reservationId } = await reserved(projectors.id, 2);
    await release(lineId);
    const units = await sql`select status from equipment.unit_reservations where reservation_id = ${reservationId}`;
    expect(units.map((u) => u.status)).toEqual(["RELEASED", "RELEASED"]);
  });

  it("puts a Substituted line back to Substituted", async () => {
    const { lineId } = await reserved(projectors.id, 2, { status: "SUBSTITUTED", substitute: { typeId: chairs.id, quantity: 5 } });
    expect(await release(lineId)).toMatchObject({ ok: true, line: { status: "SUBSTITUTED", substituteQuantity: 5 } });
  });

  it("refuses a line that is not Reserved and changes nothing", async () => {
    const id = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "CONFIRMED" });
    expect(await release(id)).toEqual({ ok: false, code: "LINE_NOT_RELEASABLE", status: "CONFIRMED" });
  });

  it("reports a line that does not exist", async () => {
    expect(await release("00000000-0000-4000-8000-0000000000ff")).toEqual({ ok: false, code: "GONE" });
  });

  it("a second release is refused and keeps the first release's timestamp", async () => {
    const { lineId, reservationId } = await reserved(chairs.id, 4);
    await release(lineId, "First");
    const [before] = await sql`select released_at, release_reason from equipment.reservations where id = ${reservationId}`;
    expect(await release(lineId, "Second")).toMatchObject({ ok: false, code: "LINE_NOT_RELEASABLE" });
    const [after] = await sql`select released_at, release_reason from equipment.reservations where id = ${reservationId}`;
    expect(after).toEqual(before);
  });
});

describe("releaseReservation (Q2)", () => {
  it("returns ALREADY_RELEASED for a released reservation and writes nothing", async () => {
    const { lineId, reservationId } = await reserved(chairs.id, 4);
    await release(lineId, "First");
    const [before] = await sql`select * from equipment.reservations where id = ${reservationId}`;
    const outcome = await sql.begin((tx) => releaseReservation(tx, reservationId, TS, "Again"));
    expect(outcome).toEqual({ ok: false, code: "ALREADY_RELEASED" });
    const [after] = await sql`select * from equipment.reservations where id = ${reservationId}`;
    expect(after).toEqual(before);
  });
});

describe("releaseEventReservations (Q2, for F4)", () => {
  it("releases every active reservation of the event and leaves other lines alone", async () => {
    const a = await reserved(chairs.id, 4);
    const b = await reserved(projectors.id, 1);
    const confirmed = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "CONFIRMED" });

    const released = await sql.begin((tx) => releaseEventReservations(tx, event.id, TS, "Event cancelled"));

    expect(released.map((r) => r.reservation.id).sort()).toEqual([a.reservationId, b.reservationId].sort());
    const rows = await sql`select status, release_reason from equipment.reservations where id in ${sql([a.reservationId, b.reservationId])}`;
    expect(rows.every((r) => r.status === "RELEASED" && r.release_reason === "Event cancelled")).toBe(true);
    expect((await sql`select status from equipment.equipment_request_lines where id = ${confirmed}`)[0]!.status).toBe("CONFIRMED");
  });
});
```

- [ ] **Step 4: Implement `repo/releases.ts`**

```ts
import type { TransactionSql } from "postgres";
import type { EquipmentRequestLineStatus } from "@connectsphere/contracts";
import { statusAfterRelease } from "../domain/reservations.js";
import { toReservation, type ReservationRecord, type ReservationRow } from "./reservations.js";
import { lockLine, markReleased, type Actor, type RequestLine } from "./requestLines.js";

/**
 * Q2 — releasing a reservation, in the caller's transaction. Nothing is
 * deleted (AC3): the reservation and the unit or bulk rows it groups become
 * RELEASED, and availability, which counts only RESERVED rows, has the stock
 * back at once (AC2).
 *
 * Locks: the line, then the reservation. A release never takes the type lock —
 * it only frees stock — so it cannot deadlock with Q1's line-then-type order.
 * The caller writes the coordinator's outbox message (AC5).
 */

export type ReleaseReservationOutcome = { ok: true; reservation: ReservationRecord } | { ok: false; code: "ALREADY_RELEASED" };

export type ReleaseLineOutcome =
  | { ok: true; reservation: ReservationRecord; line: RequestLine; previous: RequestLine }
  | { ok: false; code: "GONE" }
  | { ok: false; code: "LINE_NOT_RELEASABLE"; status: EquipmentRequestLineStatus }
  | { ok: false; code: "ALREADY_RELEASED" };

/** Releases one reservation. A released one is left exactly as it is (AC4). */
export async function releaseReservation(
  tx: TransactionSql,
  reservationId: string,
  actor: Actor,
  reason: string,
): Promise<ReleaseReservationOutcome> {
  const [locked] = await tx<{ status: string }[]>`
    select status from equipment.reservations where id = ${reservationId} for update
  `;
  if (!locked) throw new Error(`No such reservation: ${reservationId}`);
  if (locked.status === "RELEASED") return { ok: false, code: "ALREADY_RELEASED" };

  const [row] = await tx<ReservationRow[]>`
    update equipment.reservations
    set status = 'RELEASED', released_by = ${actor.userId}, released_at = clock_timestamp(),
        release_reason = ${reason}, updated_at = now(), updated_by = ${actor.userId}
    where id = ${reservationId}
    returning *
  `;
  await tx`
    update equipment.unit_reservations set status = 'RELEASED', updated_at = now(), updated_by = ${actor.userId}
    where reservation_id = ${reservationId}
  `;
  await tx`
    update equipment.bulk_reservations set status = 'RELEASED', updated_at = now(), updated_by = ${actor.userId}
    where reservation_id = ${reservationId}
  `;
  return { ok: true, reservation: toReservation(row!) };
}

/** Technical Support's release: the line must be Reserved; it goes back to Confirmed or Substituted. */
export async function releaseLine(tx: TransactionSql, lineId: string, reason: string, actor: Actor): Promise<ReleaseLineOutcome> {
  const current = await lockLine(tx, lineId);
  if (!current) return { ok: false, code: "GONE" };
  if (current.status !== "RESERVED" || !current.reservation) {
    return { ok: false, code: "LINE_NOT_RELEASABLE", status: current.status };
  }

  const released = await releaseReservation(tx, current.reservation.id, actor, reason);
  if (!released.ok) return released;

  const line = await markReleased(
    tx,
    current,
    { reservationId: released.reservation.id, reason, status: statusAfterRelease(current) },
    actor,
  );
  return { ok: true, reservation: released.reservation, line, previous: current };
}

/**
 * F4's release run (AC1): every Reserved line of the event, in list order,
 * released with F4's reason. F4 calls this through equipment's index.ts inside
 * its cancellation transaction and writes the notifications.
 */
export async function releaseEventReservations(
  tx: TransactionSql,
  eventId: string,
  actor: Actor,
  reason: string,
): Promise<Extract<ReleaseLineOutcome, { ok: true }>[]> {
  const lines = await tx<{ id: string }[]>`
    select id from equipment.equipment_request_lines
    where event_id = ${eventId} and status = 'RESERVED'
    order by seq
  `;
  const released: Extract<ReleaseLineOutcome, { ok: true }>[] = [];
  for (const { id } of lines) {
    const outcome = await releaseLine(tx, id, reason, actor);
    if (outcome.ok) released.push(outcome);
  }
  return released;
}
```

Note: the line lock serialises two releases of one line, so the loser sees the line CONFIRMED and gets `LINE_NOT_RELEASABLE`; `ALREADY_RELEASED` is the backstop for a caller that releases by reservation id (the removal path).

- [ ] **Step 5:** typecheck, lint, boundaries, unit suite (placeholder env), ad hoc type-check of the test file. Commit `feat(q2): release a reservation, a line's or an event's`.

---

### Task 5: Message, removal, route, index

**Files:** `events/lineStatusMessage.ts`, `api/requestLines.ts` (removal), create `api/releases.ts`, `index.ts`, `backend/services/notification/src/domain/recipients.ts` and its tests.

- [ ] **Step 1: Message option.** Give `lineStatusChangedMessage` an optional `release?: { reason: string }`. When present, the payload gets `released: true` and `reason: release.reason` (instead of `updated.unavailableReason`). Without it the payload is byte-for-byte what it is now (O2-T9 and Q1-T10 keep passing).

- [ ] **Step 2: Notification wording.** In `recipients.ts` `equipmentLineMessage`, when `d.released === true`:

```ts
  if (d.released === true) {
    return `The reservation of ${line} for ${event} was released. The line is now ${status}. Reason: ${d.reason}`;
  }
```

before the existing text. Add to the notification service's `recipients.test.ts`: a released payload (newStatus CONFIRMED, reason "Event moved") gives exactly that sentence for the coordinator; a released payload with newStatus REMOVED reads "…The line is now Removed. Reason: Request line removed". Run the notification service's DB-free unit config (`npx vitest run --config vitest.unit.config.ts` in `backend/services/notification`).

- [ ] **Step 3: Removal of a Reserved line.** In the O1 removal transaction (`api/requestLines.ts` ~247), replace the editable check with:

```ts
        const current = await lockLine(tx, loaded.line.id);
        if (!current) return { code: "GONE" } as const;
        if (current.status === "RESERVED" && current.reservation) {
          const released = await releaseReservation(tx, current.reservation.id, req.actor!, REMOVAL_REASON);
          const line = await markRemoved(tx, current, req.actor!, {
            reservationId: current.reservation.id,
            released: released.ok,
            reason: REMOVAL_REASON,
          });
          if (released.ok && loaded.event.assignedCoordinatorId) {
            await writeOutbox(
              tx,
              lineStatusChangedMessage({
                event: { id: loaded.event.id, name: loaded.event.name, assignedCoordinatorId: loaded.event.assignedCoordinatorId },
                previous: current,
                updated: line,
                actor: req.actor!,
                correlationId: req.header("x-correlation-id") ?? null,
                release: { reason: REMOVAL_REASON },
              }),
            );
          }
          return { code: "OK", line } as const;
        }
        if (!isEditableByCoordinator(current.status)) return { code: "NOT_EDITABLE", status: current.status } as const;
        return { code: "OK", line: await markRemoved(tx, current, req.actor!) } as const;
```

with `const REMOVAL_REASON = "Request line removed";` at the top. Leave `notEditable` and its message unchanged: it is shared with O1's edit, and a Reserved line's edit is still refused. Update the removal route's comment to say a Reserved line can be removed and its reservation is released first (Q2).

- [ ] **Step 4: Release route** `api/releases.ts`, modelled exactly on `api/reservations.ts` (same imports, `TECH_SUPPORT`, `UUID`, `ALL_EVENTS`, `lineNotFound`, `present`):

```ts
/** Q2 — Technical Support release a Reserved line's reservation, with a reason. */
export function releasesRouter(sql: Sql, limiter: RequestHandler = equipmentRateLimiter()) {
  const router = Router();

  router.post(
    "/api/v1/equipment/request-lines/:id/release",
    limiter,
    authenticate,
    requireRole(TECH_SUPPORT),
    async (req: ActorRequest, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id!;
        if (!UUID.test(id)) return lineNotFound(res);
        const checked = validateReleaseBody(req.body);
        if (!checked.ok) {
          return refuse(res, 400, "VALIDATION_FAILED", "The reservation could not be released. Check the highlighted fields.", checked.fields);
        }
        const existing = await findLine(sql, id);
        if (!existing) return lineNotFound(res);
        const event = await findEventForPlanning(sql, existing.eventId, ALL_EVENTS, req.actor!.userId);
        if (!event) return refuse(res, 404, "EVENT_NOT_FOUND", "No event with that id exists.");

        const outcome = await sql.begin(async (tx) => {
          const result = await releaseLine(tx, id, checked.reason, req.actor!);
          if (result.ok && event.assignedCoordinatorId) {
            await writeOutbox(
              tx,
              lineStatusChangedMessage({
                event: { id: event.id, name: event.name, assignedCoordinatorId: event.assignedCoordinatorId },
                previous: result.previous,
                updated: result.line,
                actor: req.actor!,
                correlationId: req.header("x-correlation-id") ?? null,
                release: { reason: checked.reason },
              }),
            );
          }
          return result;
        });

        if (outcome.ok) {
          res.json({ reservation: outcome.reservation, line: present(outcome.line) });
          return;
        }
        switch (outcome.code) {
          case "GONE":
            return lineNotFound(res);
          case "LINE_NOT_RELEASABLE":
            return refuse(
              res,
              409,
              "LINE_NOT_RELEASABLE",
              `This line is ${EQUIPMENT_LINE_STATUS_LABELS[outcome.status]}. Only a Reserved line's reservation can be released.`,
              undefined,
              { status: outcome.status },
            );
          case "ALREADY_RELEASED":
            return refuse(res, 409, "RESERVATION_ALREADY_RELEASED", "This reservation has already been released.");
          default: {
            const unreachable: never = outcome;
            throw new Error(`Unhandled release outcome: ${JSON.stringify(unreachable)}`);
          }
        }
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
```

- [ ] **Step 5: index.ts** — mount `releasesRouter(sql, limiter)` after `reservationsRouter`, and export F4's entry point:

```ts
/** Q2 — F4's release run calls this inside its cancellation transaction (AC1). */
export { releaseEventReservations } from "./repo/releases.js";
```

- [ ] **Step 6:** typecheck, lint, boundaries, planning-core unit suite (the OpenAPI route test will fail until Task 7 adds the route — do Task 7's path entry in this commit if you want a green suite), notification unit suite. Commit `feat(q2): release route, removal of Reserved lines, and the released notice`.

---

### Task 6: Card tests and the race

**Files:** create `PC/tests/equipment/api/q2Cards.test.ts`; modify `PC/tests/race/invariants.test.ts`.

- [ ] **Step 1: `q2Cards.test.ts`** — copy `q1Cards.test.ts`'s setup verbatim (mocks, `signedInAs`, `bearer`, `SLACK_MS`, `availability`, cleanup), actor prefix `0b800000`, type names "Q2 Chairs"/"Q2 Projectors". FX-Q2 in `beforeEach`: FX-Q1's event and types, then L1 = a CHAIRS ×4 Confirmed line reserved through `POST …/reservation` as TS (assert 201 in the fixture). Helpers:

```ts
const releaseReq = (id: string, body: unknown = { reason: "Not needed" }) =>
  request(app).post(`${BASE}/${id}/release`).set(bearer).send(body as object);
const removeReq = (id: string) => request(app).post(`${BASE}/${id}/removal`).set(bearer).send({});
const reservationRow = async (id: string) => (await sql`select * from equipment.reservations where id = ${id}`)[0];
```

One `it("Q2-Tn …")` per card Q2-T1..T5 and T7..T11, each asserting its card's Expected Result exactly. Q2-T9 follows Q1-T10: read the outbox row(s) for L1 written after the release (filter `envelope->'data'->>'released' = 'true'`), `parseCloudEvent`, `notificationsFor`, and assert one notification for C1 whose text contains E1's reference, "Q2 Chairs", "released" and the reason — once for the TS release and once (fresh fixture via a second `it` or a reset) for C1's removal. Also a `describe("release route")` with a non-UUID id → 404 and an event with no coordinator → 200 and no outbox row.

- [ ] **Step 2: Q2-T6 race** in `invariants.test.ts`, inside the same throwaway-only `describe` as Q1-T13, cleaning up in `finally` like Q1-T13: per round, a bulk type (total 1), one Confirmed line, reserved with `reserveLine`, then `race(ATTEMPTS, (tx) => releaseLine(tx, lineId, "race", ACTOR_TS))`. Assert: exactly one fulfilled result with `ok: true`; every other fulfilled result is `{ ok: false, code: "LINE_NOT_RELEASABLE", status: "CONFIRMED" }` (no rejections); one `released_at`; exactly one history row with `details->>'released' = 'true'` for the line. Name it starting `"Q2-T6 "`.

- [ ] **Step 3:** typecheck/lint; ad hoc type-check of both files. Commit `test(q2): a test per card and the release race`.

---

### Task 7: OpenAPI

- [ ] Add `POST /api/v1/equipment/request-lines/{id}/release` after the reservation path, in its layout: body `ReleaseRequest` (`reason` string, required, maxLength 1000), 200 `{ reservation, line }`, 400, 401, 403, 404 (`EQUIPMENT_LINE_NOT_FOUND` or `EVENT_NOT_FOUND`), 409 (`LINE_NOT_RELEASABLE` with `details.status`, `RESERVATION_ALREADY_RELEASED`), 429, 503. Add `releasedBy`, `releasedAt` (date-time), `releaseReason` (all nullable, required) to `Reservation`. In the removal path's description say a Reserved line can be removed and its reservation is released. Run `npm run lint:api` and the planning-core unit suite. Commit `docs(q2): describe the release route` (or fold into Task 5's commit, as noted there).

---

### Task 8: Screens

**Files:** `frontend/src/api/equipmentRequests.ts`, `frontend/src/screens/EquipmentRequests.tsx`, `frontend/src/screens/EquipmentRequest.tsx`, and their two test files.

- [ ] **Step 1: Client**

```ts
export function releaseLine(token: string, id: string, reason: string) {
  return request<{ reservation: { id: string }; line: RequestLine }>(
    `${LINES}/${encodeURIComponent(id)}/release`,
    { method: "POST", token, body: { reason } },
  );
}
```

- [ ] **Step 2: Failing tests** in `frontend/tests/equipmentRequests.test.tsx` (add a `/release$` route to `fetchMock` with an `onRelease` handler, like `onReserve`):
  - a Reserved row shows a "Release" button (accessible name `Release <type> for <ref>`), and Confirmed rows do not;
  - submitting with an empty reason shows the server's `reason` field message inline and the row stays Reserved;
  - entering `Event moved` and clicking "Release reservation" posts `{ reason: "Event moved" }`, shows the banner title "Equipment released", and after reload the row shows Confirmed with a Reserve button.
  In `frontend/tests/equipmentRequest.test.tsx`: a Reserved line shows "Remove" for the assigned coordinator, the dialog contains "Its reserved equipment will be released", and confirming posts to `/removal`.

- [ ] **Step 3: Implement.** In `EquipmentRequests.tsx`: `releasing`, `releaseReason`, `releaseError` state; `openRelease(line)` closes the Update and Reserve forms (and `open`/`openReserve` close it); the Reserved actions cell renders `<Button aria-label={`Release ${typeName} for ${line.eventReference}`} onClick={() => openRelease(line)}>Release</Button>` (type name = the reservation's `equipmentTypeName`); the inline form: heading "Release <type> × <reserved> for <ref>", `<Refusal error={releaseError} />`, a required "Reason" `Textfield` (id `release-reason`, `aria-describedby` to its error), "Release reservation" (primary) and "Cancel"; on success set the banner title "Equipment released" and message `Released ${type} for ${ref}: ${reason}.`, then reload. In `EquipmentRequest.tsx`: show "Remove" for Reserved lines as well as editable ones, and when the line being removed is Reserved add the sentence "Its reserved equipment will be released." to the dialog.

- [ ] **Step 4:** `npm test -w @connectsphere/web`, typecheck, lint. Commit `feat(q2): release from the equipment requests screen, remove Reserved lines`.

---

### Task 9: Traceability, changelog, PR

- [ ] **Step 1:** Append Q2 rows to `documentation/traceability/sprint-3.csv` (same header and AC-text style as the Q1 rows): AC1 → Q2-T1, T3, T7, T8, T11 and `releaseEventReservations`' repo test; AC2 → Q2-T1, T2, T8; AC3 → Q2-T1, T8; AC4 → Q2-T5, T6 (race) and the `releaseReservation` repo test; AC5 → Q2-T9. Use exact `it` names.
- [ ] **Step 2:** CHANGELOG entry at the top (house format) — Added: the release route, release columns (0007–0008), `releaseEventReservations` for F4, Release/Remove on the screens, cards Q2-T1..T13; Changed: O1 removal accepts Reserved lines and releases first, the line-status-changed message's `released` flag and its wording; "Before using it on the shared database": `npm run migrate -- equipment` applies 0005–0008 (after #42's 0005–0006) before planning-core is deployed there.
- [ ] **Step 3:** all local gates (lint, boundaries, lint:api, typecheck, build, planning-core and notification unit suites, web suite). Commit `docs(q2): trace Q2's criteria and record it in the changelog`.
- [ ] **Step 4:** push `feature-raphael/q2-release-reservation`; open the PR with base `feature-raphael/q1-reserve-equipment` (stacked), title "Q2: release an equipment reservation", body: what changes, card table, "stacked on #42 — retarget to main after it merges", the migration note, and the Claude Code line last.
- [ ] **Step 5:** when CI is green, fill each automated card's Execution record from that run (as Q1's), Q2-T12 Not Executed (owning story F4), Q2-T13 Not Executed until the shared DB is migrated; commit and push.
