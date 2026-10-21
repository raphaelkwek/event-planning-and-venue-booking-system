import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { testDb } from "../../support/testDb.js";
import { listBookingsForEvent } from "../../../src/modules/venue/repo/eventBookings.js";
import { disruptedBy, flagDisruptions, insertBlock, removeBlock } from "../../../src/modules/venue/repo/unavailability.js";

/**
 * L5 against real Postgres: an event's bookings, each with the active blocks
 * that disrupt it (I2) and the replacement requests raised for it (CR-02).
 */

const sql = testDb();
const STAFF = "a3333333-0000-0000-0000-000000000091";
const COORDINATOR = "a3333333-0000-0000-0000-000000000092";

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

async function newVenue(name: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${`${name} ${randomUUID().slice(0, 8)}`}, 'L5 Test Building', 50,
            ${sql.json([{ name: "Theatre", capacity: 50 }])}, ${sql.json({})}, ${STAFF}, ${STAFF})
    returning id
  `;
  return row!.id;
}

const at = (hhmm: string, day = "02") => new Date(`2026-12-${day}T${hhmm}:00+08:00`);

async function newSlot(venueId: string, eventId: string, reference: string, from: string, until: string, status = "CONFIRMED") {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venue_slots (venue_id, event_id, reference, starts_at, ends_at, status, release_reason, created_by, updated_by)
    values (${venueId}, ${eventId}, ${reference}, ${at(from)}, ${at(until)}, ${status}, ${status === "RELEASED" ? "replaced" : null}, ${STAFF}, ${STAFF})
    returning id
  `;
  return row!.id;
}

async function replacement(venueId: string, eventId: string, replaces: string, status = "PENDING") {
  const [row] = await sql<{ id: string; reference: string }[]>`
    insert into venue.booking_requests (
      event_id, venue_id, starts_at, ends_at, layout, expected_attendance, event_starts_at, event_ends_at,
      event_attendance, differs_from_event, replaces_booking_id, requested_by, status, withdrawn_by, withdrawn_at
    ) values (
      ${eventId}, ${venueId}, ${at("14:00")}, ${at("18:00")}, 'Theatre', 40, ${at("14:00")}, ${at("18:00")}, 40, false, ${replaces},
      ${COORDINATOR}, ${status}, ${status === "WITHDRAWN" ? COORDINATOR : null}, ${status === "WITHDRAWN" ? new Date() : null}
    )
    returning id, reference
  `;
  return row!;
}

async function block(venueId: string, from: string, until: string, description: string) {
  return sql.begin(async (tx) => {
    const made = await insertBlock(tx, { venueId, startsAt: at(from), endsAt: at(until), reasonType: "MAINTENANCE", description, actorUserId: STAFF });
    await flagDisruptions(tx, made.id, await disruptedBy(tx, venueId, at(from), at(until)), STAFF);
    return made;
  });
}

describe("listBookingsForEvent (L5-T1, L5-T5)", () => {
  it("lists the event's bookings soonest first, each with its active disruptions and its replacement requests", async () => {
    const lkc = await newVenue("L5 Auditorium");
    const seminar = await newVenue("L5 Seminar Room");
    const eventId = randomUUID();
    const disrupted = await newSlot(lkc, eventId, "BKR-910001", "14:00", "18:00");
    const quiet = await newSlot(seminar, eventId, "BKR-910002", "10:00", "12:00");
    const made = await block(lkc, "16:00", "19:00", "Stage rigging inspection");
    const withdrawn = await replacement(seminar, eventId, disrupted, "WITHDRAWN");
    const pending = await replacement(seminar, eventId, disrupted);
    await newSlot(lkc, randomUUID(), "BKR-910003", "08:00", "09:00");

    const bookings = await listBookingsForEvent(sql, eventId);

    expect(bookings.map((b) => b.id)).toEqual([quiet, disrupted]);
    expect(bookings[0]).toMatchObject({ reference: "BKR-910002", status: "CONFIRMED", requiresReconfirmation: false, disruptions: [], replacements: [] });
    expect(bookings[1]).toEqual({
      id: disrupted,
      reference: "BKR-910001",
      venueId: lkc,
      venueName: expect.stringMatching(/^L5 Auditorium/),
      startsAt: at("14:00").toISOString(),
      endsAt: at("18:00").toISOString(),
      status: "CONFIRMED",
      requiresReconfirmation: true,
      releaseReason: null,
      disruptions: [
        { blockId: made.id, reasonType: "MAINTENANCE", description: "Stage rigging inspection", startsAt: at("16:00").toISOString(), endsAt: at("19:00").toISOString() },
      ],
      overlaps: [],
      replacements: [
        { id: withdrawn.id, reference: withdrawn.reference, status: "WITHDRAWN", venueName: expect.stringMatching(/^L5 Seminar Room/) },
        { id: pending.id, reference: pending.reference, status: "PENDING", venueName: expect.stringMatching(/^L5 Seminar Room/) },
      ],
    });
  });

  it("leaves out holds' slots, held or released, which the event's holds list shows (L3, L4-T5)", async () => {
    const lkc = await newVenue("L5 Auditorium");
    const eventId = randomUUID();
    const booking = await newSlot(lkc, eventId, "BKR-910021", "08:00", "10:00");
    await newSlot(lkc, eventId, "HLD-910022", "11:00", "12:00", "HELD");
    const releasedHold = await newSlot(lkc, eventId, "HLD-910023", "12:00", "13:00", "HELD");
    await sql`update venue.venue_slots set status = 'RELEASED' where id = ${releasedHold}`;

    expect((await listBookingsForEvent(sql, eventId)).map((b) => b.id)).toEqual([booking]);
  });

  it("keeps a released booking, with its reason, and drops a removed block from its disruptions", async () => {
    const lkc = await newVenue("L5 Auditorium");
    const eventId = randomUUID();
    const released = await newSlot(lkc, eventId, "BKR-910004", "14:00", "18:00", "RELEASED");
    const confirmed = await newSlot(lkc, eventId, "BKR-910005", "08:00", "10:00", "CONFIRMED");
    const made = await block(lkc, "09:00", "11:00", "Fire alarm test");
    await sql.begin((tx) => removeBlock(tx, made.id, STAFF));

    const bookings = await listBookingsForEvent(sql, eventId);

    expect(bookings.map((b) => [b.id, b.status, b.releaseReason, b.disruptions.length])).toEqual([
      [confirmed, "CONFIRMED", null, 0],
      [released, "RELEASED", "replaced", 0],
    ]);
  });

  it("lists nothing for an event with no bookings", async () => {
    expect(await listBookingsForEvent(sql, randomUUID())).toEqual([]);
  });
});
