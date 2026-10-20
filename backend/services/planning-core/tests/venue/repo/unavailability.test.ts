import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDb } from "../../support/testDb.js";
import {
  clearDisruptions,
  disruptedBy,
  findBlock,
  flagDisruptions,
  insertBlock,
  listActiveBlocks,
  removeBlock,
} from "../../../src/modules/venue/repo/unavailability.js";
import { findBookingRequest } from "../../../src/modules/venue/repo/bookingRequests.js";

/**
 * I2 against real Postgres: a block records what it was and who recorded it;
 * what it disrupts is found by occupied period (CR-01) with `&&`; flagging
 * records which block flagged what; and removing a block clears a flag only
 * when no other active block still disrupts it. Migration venue/0009's checks.
 *
 * Every test makes its own venue, so none depends on or disturbs another's rows.
 */

const sql = testDb();
const STAFF = "a3333333-0000-0000-0000-000000000081";
const COORDINATOR = "a3333333-0000-0000-0000-000000000082";
/** Postgres check_violation. */
const CHECK_VIOLATION = "23514";

afterAll(async () => {
  try {
    const ours = sql`select id from venue.venues where created_by = ${STAFF}`;
    await sql`delete from venue.block_disruptions where block_id in (select id from venue.unavailability_blocks where venue_id in (${ours}))`;
    await sql`delete from venue.booking_requests where venue_id in (${ours})`;
    await sql`delete from venue.venue_slots where venue_id in (${ours})`;
    await sql`delete from venue.unavailability_blocks where venue_id in (${ours})`;
    await sql`delete from venue.venues where created_by = ${STAFF}`;
  } finally {
    await sql.end();
  }
});

async function newVenue(): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${`I2 Test Room ${randomUUID().slice(0, 8)}`}, 'I2 Test Building', 50,
            ${sql.json([{ name: "Theatre", capacity: 50 }])}, ${sql.json({})}, ${STAFF}, ${STAFF})
    returning id
  `;
  return row!.id;
}

/** A time on Wednesday 2 Dec 2026, Singapore time. */
const at = (hhmm: string) => new Date(`2026-12-02T${hhmm}:00+08:00`);
const iso = (hhmm: string) => at(hhmm).toISOString();

async function newSlot(
  venueId: string,
  options: { from?: string; until?: string; setup?: number; turnaround?: number; status?: string; reference?: string } = {},
) {
  const eventId = randomUUID();
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venue_slots
      (venue_id, event_id, reference, starts_at, ends_at, setup_minutes, turnaround_minutes, status, created_by, updated_by)
    values (${venueId}, ${eventId}, ${options.reference ?? `I2-${randomUUID().slice(0, 8)}`}, ${at(options.from ?? "14:00")},
            ${at(options.until ?? "18:00")}, ${options.setup ?? 0}, ${options.turnaround ?? 0}, ${options.status ?? "CONFIRMED"},
            ${STAFF}, ${STAFF})
    returning id
  `;
  return { id: row!.id, eventId };
}

async function newRequest(venueId: string, from: string, until: string, status = "PENDING") {
  const eventId = randomUUID();
  const [row] = await sql<{ id: string; reference: string }[]>`
    insert into venue.booking_requests (
      event_id, venue_id, starts_at, ends_at, layout, expected_attendance, event_starts_at, event_ends_at,
      event_attendance, differs_from_event, requested_by, status, withdrawn_by, withdrawn_at
    ) values (
      ${eventId}, ${venueId}, ${at(from)}, ${at(until)}, 'Theatre', 40, ${at(from)}, ${at(until)}, 40, false, ${COORDINATOR},
      ${status}, ${status === "WITHDRAWN" ? COORDINATOR : null}, ${status === "WITHDRAWN" ? new Date() : null}
    )
    returning id, reference
  `;
  return { ...row!, eventId };
}

const block = (venueId: string, from: string, until: string, description = "Stage rigging inspection") =>
  sql.begin((tx) =>
    insertBlock(tx, { venueId, startsAt: at(from), endsAt: at(until), reasonType: "MAINTENANCE", description, actorUserId: STAFF }),
  );

const slotFlag = async (id: string) =>
  (await sql<{ requires_reconfirmation: boolean }[]>`select requires_reconfirmation from venue.venue_slots where id = ${id}`)[0]!
    .requires_reconfirmation;

const codeOf = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: { code?: string }) => error.code,
  );

describe("insertBlock, findBlock and listActiveBlocks", () => {
  it("records the venue, period, reason type, description, who and when, Active (I2-T1)", async () => {
    const venueId = await newVenue();
    const before = Date.now();

    const made = await block(venueId, "09:00", "13:00", "Annual rigging inspection");

    expect(made).toMatchObject({
      venueId,
      startsAt: iso("09:00"),
      endsAt: iso("13:00"),
      reasonType: "MAINTENANCE",
      description: "Annual rigging inspection",
      status: "ACTIVE",
      createdBy: STAFF,
      removedBy: null,
      removedAt: null,
    });
    expect(Date.parse(made.createdAt)).toBeGreaterThanOrEqual(before - 5000);
    expect(await findBlock(sql, made.id)).toEqual(made);
    expect(await findBlock(sql, randomUUID())).toBeNull();
  });

  it("lists a venue's active blocks soonest first, never a removed one or another venue's", async () => {
    const venueId = await newVenue();
    const later = await block(venueId, "16:00", "19:00");
    const earlier = await block(venueId, "08:00", "09:00");
    const removed = await block(venueId, "12:00", "13:00");
    await sql.begin((tx) => removeBlock(tx, removed.id, STAFF));
    await block(await newVenue(), "10:00", "11:00");

    expect((await listActiveBlocks(sql, venueId)).map((b) => b.id)).toEqual([earlier.id, later.id]);
  });
});

describe("disruptedBy (I2-T4, I2-T5, I2-T9)", () => {
  it("finds the confirmed bookings, holds and pending requests a period overlaps, with each overlapping period", async () => {
    const venueId = await newVenue();
    const booking = await newSlot(venueId, { from: "14:00", until: "18:00", reference: "BKR-900001" });
    const hold = await newSlot(venueId, { from: "19:00", until: "20:00", status: "HELD", reference: "HLD-1" });
    const request = await newRequest(venueId, "17:00", "21:00");

    const found = await disruptedBy(sql, venueId, at("16:00"), at("19:30"));

    expect(found).toEqual([
      {
        kind: "BOOKING",
        id: booking.id,
        reference: "BKR-900001",
        eventId: booking.eventId,
        requestedBy: null,
        overlapFrom: iso("16:00"),
        overlapUntil: iso("18:00"),
      },
      {
        kind: "REQUEST",
        id: request.id,
        reference: request.reference,
        eventId: request.eventId,
        requestedBy: COORDINATOR,
        overlapFrom: iso("17:00"),
        overlapUntil: iso("19:30"),
      },
      {
        kind: "HOLD",
        id: hold.id,
        reference: "HLD-1",
        eventId: hold.eventId,
        requestedBy: null,
        overlapFrom: iso("19:00"),
        overlapUntil: iso("19:30"),
      },
    ]);
  });

  it("ignores what only touches the period, released and expired slots, decided or withdrawn requests, and other venues", async () => {
    const venueId = await newVenue();
    await newSlot(venueId, { from: "10:00", until: "14:00" });
    await newSlot(venueId, { from: "18:00", until: "20:00" });
    await newSlot(venueId, { from: "15:00", until: "16:00", status: "RELEASED" });
    await newSlot(venueId, { from: "16:00", until: "17:00", status: "EXPIRED" });
    await newRequest(venueId, "14:00", "18:00", "WITHDRAWN");
    await newSlot(await newVenue(), { from: "14:00", until: "18:00" });

    expect(await disruptedBy(sql, venueId, at("14:00"), at("18:00"))).toEqual([]);
  });

  it("compares bookings by occupied period: a block over only the turnaround disrupts it, one touching its end doesn't (CR-01)", async () => {
    const venueId = await newVenue();
    const booking = await newSlot(venueId, { from: "10:00", until: "12:00", setup: 30, turnaround: 45 });

    const overTurnaround = await disruptedBy(sql, venueId, at("12:30"), at("13:30"));
    expect(overTurnaround).toEqual([expect.objectContaining({ id: booking.id, overlapFrom: iso("12:30"), overlapUntil: iso("12:45") })]);
    expect(await disruptedBy(sql, venueId, at("12:45"), at("13:30"))).toEqual([]);
    expect(await disruptedBy(sql, venueId, at("09:00"), at("09:31"))).toHaveLength(1);
  });
});

describe("flagDisruptions and clearDisruptions (I2-T6, I2-T11)", () => {
  it("flags each booking, hold and request, recording which block, who and when", async () => {
    const venueId = await newVenue();
    const booking = await newSlot(venueId);
    const request = await newRequest(venueId, "17:00", "21:00");
    const made = await block(venueId, "16:00", "19:00");
    const before = Date.now();

    await sql.begin(async (tx) => flagDisruptions(tx, made.id, await disruptedBy(tx, venueId, at("16:00"), at("19:00")), STAFF));

    expect(await slotFlag(booking.id)).toBe(true);
    expect((await findBookingRequest(sql, request.id))!.requiresReconfirmation).toBe(true);
    const rows = await sql<{ slot_id: string | null; booking_request_id: string | null; created_by: string; created_at: Date }[]>`
      select slot_id, booking_request_id, created_by, created_at from venue.block_disruptions where block_id = ${made.id}
      order by slot_id nulls last
    `;
    expect(rows.map((r) => [r.slot_id, r.booking_request_id, r.created_by])).toEqual([
      [booking.id, null, STAFF],
      [null, request.id, STAFF],
    ]);
    expect(rows[0]!.created_at.getTime()).toBeGreaterThanOrEqual(before - 5000);
  });

  it("clears a flag only when no other active block still disrupts it, and says which still are", async () => {
    const venueId = await newVenue();
    const both = await newSlot(venueId, { from: "14:00", until: "18:00" });
    const onlyA = await newSlot(venueId, { from: "10:00", until: "12:00" });
    const a = await block(venueId, "11:00", "15:00");
    const b = await block(venueId, "17:00", "19:00");
    for (const [made, from, until] of [[a, "11:00", "15:00"], [b, "17:00", "19:00"]] as const) {
      await sql.begin(async (tx) => flagDisruptions(tx, made.id, await disruptedBy(tx, venueId, at(from), at(until)), STAFF));
    }

    const clearedA = await sql.begin(async (tx) => {
      await removeBlock(tx, a.id, STAFF);
      return clearDisruptions(tx, a.id);
    });

    expect(clearedA.map((c) => [c.id, c.stillDisrupted])).toEqual([
      [onlyA.id, false],
      [both.id, true],
    ]);
    expect(await slotFlag(onlyA.id)).toBe(false);
    expect(await slotFlag(both.id)).toBe(true);

    const clearedB = await sql.begin(async (tx) => {
      await removeBlock(tx, b.id, STAFF);
      return clearDisruptions(tx, b.id);
    });
    expect(clearedB.map((c) => [c.id, c.stillDisrupted])).toEqual([[both.id, false]]);
    expect(await slotFlag(both.id)).toBe(false);
  });

  it("clears a request's flag, and passes over a booking released since it was flagged", async () => {
    const venueId = await newVenue();
    const released = await newSlot(venueId);
    const request = await newRequest(venueId, "17:00", "21:00");
    const made = await block(venueId, "16:00", "19:00");
    await sql.begin(async (tx) => flagDisruptions(tx, made.id, await disruptedBy(tx, venueId, at("16:00"), at("19:00")), STAFF));
    await sql`update venue.venue_slots set status = 'RELEASED', release_reason = 'replaced' where id = ${released.id}`;

    const cleared = await sql.begin(async (tx) => {
      await removeBlock(tx, made.id, STAFF);
      return clearDisruptions(tx, made.id);
    });

    expect(cleared.map((c) => [c.kind, c.id, c.stillDisrupted])).toEqual([["REQUEST", request.id, false]]);
    expect((await findBookingRequest(sql, request.id))!.requiresReconfirmation).toBe(false);
  });
});

describe("removeBlock and migration venue/0009's checks", () => {
  it("records who removed the block and when, and keeps it (I2-T11)", async () => {
    const venueId = await newVenue();
    const made = await block(venueId, "09:00", "13:00");
    const before = Date.now();

    await sql.begin((tx) => removeBlock(tx, made.id, STAFF));

    const removed = (await findBlock(sql, made.id))!;
    expect(removed).toMatchObject({ status: "REMOVED", removedBy: STAFF });
    expect(Date.parse(removed.removedAt!)).toBeGreaterThanOrEqual(before - 5000);
  });

  it("refuses a removal without who and when, and a disruption naming both or neither target", async () => {
    const venueId = await newVenue();
    const made = await block(venueId, "09:00", "13:00");
    const slot = await newSlot(venueId);
    const request = await newRequest(venueId, "14:00", "15:00");

    expect(await codeOf(sql`update venue.unavailability_blocks set status = 'REMOVED' where id = ${made.id}`)).toBe(CHECK_VIOLATION);
    expect(await codeOf(sql`update venue.unavailability_blocks set removed_by = ${STAFF}, removed_at = now() where id = ${made.id}`)).toBe(
      CHECK_VIOLATION,
    );
    expect(
      await codeOf(sql`
        insert into venue.block_disruptions (block_id, slot_id, booking_request_id, created_by)
        values (${made.id}, ${slot.id}, ${request.id}, ${STAFF})`),
    ).toBe(CHECK_VIOLATION);
    expect(
      await codeOf(sql`insert into venue.block_disruptions (block_id, created_by) values (${made.id}, ${STAFF})`),
    ).toBe(CHECK_VIOLATION);
  });
});
