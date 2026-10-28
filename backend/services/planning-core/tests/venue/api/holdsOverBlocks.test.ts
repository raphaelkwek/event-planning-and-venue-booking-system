import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";

/**
 * I4 (W9-41) — an active block refuses a new hold over its occupied period,
 * both when the coordinator requests it and when Venue Staff place it, and
 * nothing is stored. A hold already placed is flagged by I2, not released; a
 * requested hold reserves nothing, so there is nothing to disrupt. Removing the
 * block lets holds be requested and placed again.
 */

vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "test-subject" };
    next();
  },
}));

vi.mock("../../../src/modules/venue/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/venue/auth/identity.js")>(
    "../../../src/modules/venue/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn() };
});

const { resolveCurrentUser } = await import("../../../src/modules/venue/auth/identity.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
const OWNER = "a9999999-0000-0000-0000-0000000000b1";
const COORDINATOR = "a9999999-0000-0000-0000-0000000000b2";
const STAFF = "a9999999-0000-0000-0000-0000000000b3";
const bearer = { Authorization: "Bearer test-token" };
const EXPIRY = "2026-12-01T18:00+08:00";

function signedInAs(role: string, userId: string) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "user@connectsphere.test", role: role as never });
}
const asCoordinator = () => signedInAs("EVENT_COORDINATOR", COORDINATOR);
const asStaff = () => signedInAs("VENUE_STAFF", STAFF);

const open = (opensAt: string, closesAt: string) => ({ opensAt, closesAt });
const HOURS = {
  monday: open("08:00", "22:00"),
  tuesday: open("08:00", "22:00"),
  wednesday: open("08:00", "22:00"),
  thursday: open("08:00", "22:00"),
  friday: open("08:00", "22:00"),
  saturday: null,
  sunday: null,
};

async function cleanUp() {
  const ours = sql`select id from venue.venues where created_by = ${STAFF}`;
  const blocks = sql`select id from venue.unavailability_blocks where venue_id in (${ours})`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.holds where venue_id in (${ours}))`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.unavailability_blocks where venue_id in (${ours}))`;
  await sql`delete from venue.block_disruptions where block_id in (${blocks})`;
  await sql`delete from venue.holds where venue_id in (${ours})`;
  await sql`delete from venue.venue_slots where venue_id in (${ours})`;
  await sql`delete from venue.unavailability_blocks where venue_id in (${ours})`;
  await sql`delete from venue.venue_staff where venue_id in (${ours})`;
  await sql`delete from venue.venues where created_by = ${STAFF}`;
  const events = sql`select id from event.events where owner_id = ${OWNER}`;
  await sql`delete from event.event_history where event_id in (${events})`;
  await sql`delete from event.assignments where event_id in (${events})`;
  await sql`delete from event.events where owner_id = ${OWNER}`;
}

beforeEach(cleanUp);
afterAll(async () => {
  await cleanUp();
  await sql.end();
});

async function newVenue(name: string, setup = 0, turnaround = 0): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues
      (name, building, max_capacity, layouts, operating_hours, setup_minutes, turnaround_minutes, created_by, updated_by)
    values (${name}, 'I4 Test Building', 300, ${sql.json([{ name: "Theatre", capacity: 300 }])}, ${sql.json(HOURS)},
            ${setup}, ${turnaround}, ${STAFF}, ${STAFF})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by, updated_by) values (${row!.id}, ${STAFF}, ${STAFF}, ${STAFF})`;
  return row!.id;
}

/** A Singapore time on Wednesday 2 December 2026, or another day that month. */
const at = (hhmm: string, day = "02") => `2026-12-${day}T${hhmm}:00+08:00`;

async function newEvent(): Promise<{ id: string; reference: string }> {
  const [row] = await sql<{ id: string; reference: string }[]>`
    insert into event.events (
      reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
      expected_attendance, equipment_required, registration_required, status, submitted_at,
      last_saved_at, created_by, updated_by
    ) values (
      'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'), ${OWNER}, 'I4 Symposium', 'I4 test',
      'I4 test', ${at("14:00")}, ${at("18:00")}, 150, false, false, 'APPROVED', now(), now(), ${OWNER}, ${OWNER}
    )
    returning id, reference
  `;
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
            values (${row!.id}, ${COORDINATOR}, 'TEST', ${COORDINATOR}, ${COORDINATOR})`;
  return row!;
}

const holdBody = (eventId: string, venueId: string, from = "14:00", until = "18:00", day = "02") => ({
  eventId,
  venueId,
  startsAt: at(from, day),
  endsAt: at(until, day),
  reminderLeadMinutes: 60,
});
const requestHold = (body: object) => {
  asCoordinator();
  return request(app).post("/api/v1/holds").set(bearer).send(body);
};
const placeHold = (id: string) => {
  asStaff();
  return request(app).post(`/api/v1/holds/${id}/place`).set(bearer).send({ expiresAt: EXPIRY });
};
const recordBlock = (venueId: string, from: string, until: string, description = "Stage rigging inspection", day = "02") => {
  asStaff();
  return request(app)
    .post(`/api/v1/venues/${venueId}/unavailability`)
    .set(bearer)
    .send({ startsAt: at(from, day), endsAt: at(until, day), reasonType: "MAINTENANCE", description });
};
const removeBlock = (venueId: string, blockId: string) => {
  asStaff();
  return request(app).post(`/api/v1/venues/${venueId}/unavailability/${blockId}/remove`).set(bearer);
};

const holdCount = async (eventId: string) =>
  (await sql<{ n: number }[]>`select count(*)::int as n from venue.holds where event_id = ${eventId}`)[0]!.n;
const holdRow = async (id: string) =>
  (await sql<{ status: string; slot_id: string | null }[]>`select status, slot_id from venue.holds where id = ${id}`)[0]!;

describe("requesting a hold over an active block (I4-T1, I4-T3, I4-T4, I4-T7)", () => {
  it("is refused, naming the venue, the block, its reason type and its period, and stores nothing (I4-T1)", async () => {
    const venueId = await newVenue("I4 Auditorium");
    const event = await newEvent();
    expect((await recordBlock(venueId, "16:00", "19:00")).status).toBe(201);

    const res = await requestHold(holdBody(event.id, venueId));

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: "VENUE_UNAVAILABLE",
      message:
        "I4 Auditorium is unavailable for Maintenance, “Stage rigging inspection” (Wednesday 2 December 2026, 16:00–19:00), " +
        "so a hold can't be requested for this period. Choose another time or venue.",
    });
    expect(await holdCount(event.id)).toBe(0);
  });

  it("names every block the hold overlaps, soonest first", async () => {
    const venueId = await newVenue("I4 Auditorium");
    const event = await newEvent();
    await recordBlock(venueId, "17:00", "19:00", "Fire alarm test");
    await recordBlock(venueId, "13:00", "15:00", "Stage rigging inspection");

    const res = await requestHold(holdBody(event.id, venueId));

    expect(res.status).toBe(409);
    const message = res.body.error.message as string;
    expect(message.indexOf("Stage rigging inspection")).toBeGreaterThan(-1);
    expect(message.indexOf("Stage rigging inspection")).toBeLessThan(message.indexOf("Fire alarm test"));
  });

  it("compares the hold's occupied period, widened by the venue's setup time (I4-T3, CR-01)", async () => {
    const venueId = await newVenue("I4 Auditorium", 30, 0);
    const event = await newEvent();
    await recordBlock(venueId, "13:00", "13:45", "Projector replacement");

    const res = await requestHold(holdBody(event.id, venueId, "14:00", "18:00"));

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain("Projector replacement");
    expect(res.body.error.message).toContain("Wednesday 2 December 2026, 13:00–13:45");
    expect(await holdCount(event.id)).toBe(0);
  });

  it("compares the hold's turnaround time after it too", async () => {
    const venueId = await newVenue("I4 Auditorium", 0, 45);
    const event = await newEvent();
    await recordBlock(venueId, "18:15", "19:00");

    expect((await requestHold(holdBody(event.id, venueId, "14:00", "18:00"))).status).toBe(409);
  });

  it("allows a hold whose period only touches the block, with no setup or turnaround (I4-T4)", async () => {
    const venueId = await newVenue("I4 Auditorium");
    const event = await newEvent();
    await recordBlock(venueId, "12:00", "14:00");
    await recordBlock(venueId, "18:00", "20:00", "Fire alarm test");

    const res = await requestHold(holdBody(event.id, venueId, "14:00", "18:00"));

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("REQUESTED");
  });

  it("allows a hold at a venue the block isn't at (I4-T7)", async () => {
    const hall = await newVenue("I4 Auditorium");
    const seminar = await newVenue("I4 Seminar Room");
    const event = await newEvent();
    await recordBlock(seminar, "14:00", "18:00", "Whiteboard replacement");

    expect((await requestHold(holdBody(event.id, hall))).status).toBe(201);
  });

  it("ignores a block that has been removed", async () => {
    const venueId = await newVenue("I4 Auditorium");
    const event = await newEvent();
    const block = await recordBlock(venueId, "16:00", "19:00");
    const removed = await removeBlock(venueId, block.body.block.id);
    expect(removed.status).toBe(200);

    expect((await requestHold(holdBody(event.id, venueId))).status).toBe(201);
  });
});

describe("placing a requested hold over an active block (I4-T2)", () => {
  it("is refused when a block was recorded after the request, naming it; the hold stays Requested with no slot", async () => {
    const venueId = await newVenue("I4 Auditorium");
    const event = await newEvent();
    const hold = (await requestHold(holdBody(event.id, venueId))).body as { id: string; reference: string };
    expect((await recordBlock(venueId, "16:00", "19:00")).status).toBe(201);

    const res = await placeHold(hold.id);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: "VENUE_UNAVAILABLE",
      message:
        "I4 Auditorium is unavailable for Maintenance, “Stage rigging inspection” (Wednesday 2 December 2026, 16:00–19:00), " +
        `so ${hold.reference} can't be placed for this period. It stays Requested.`,
    });
    expect(await holdRow(hold.id)).toEqual({ status: "REQUESTED", slot_id: null });
    const [slots] = await sql<{ n: number }[]>`select count(*)::int as n from venue.venue_slots where venue_id = ${venueId}`;
    expect(slots!.n).toBe(0);
  });

  it("compares occupied periods when placing, with the venue's times as they are now", async () => {
    const venueId = await newVenue("I4 Auditorium");
    const event = await newEvent();
    const hold = (await requestHold(holdBody(event.id, venueId))).body as { id: string };
    await recordBlock(venueId, "13:00", "13:45", "Projector replacement");
    expect((await placeHold(hold.id)).status).toBe(200);

    const other = await newEvent();
    const second = (await requestHold(holdBody(other.id, venueId, "20:00", "21:00"))).body as { id: string };
    await recordBlock(venueId, "19:30", "19:45", "Fire alarm test");
    await sql`update venue.venues set setup_minutes = 30 where id = ${venueId}`;
    const res = await placeHold(second.id);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain("Fire alarm test");
  });

  it("places it once the block is removed (I4-T6)", async () => {
    const venueId = await newVenue("I4 Auditorium");
    const event = await newEvent();
    const hold = (await requestHold(holdBody(event.id, venueId))).body as { id: string };
    const block = await recordBlock(venueId, "16:00", "19:00");
    expect((await placeHold(hold.id)).status).toBe(409);
    expect((await removeBlock(venueId, block.body.block.id)).status).toBe(200);

    const placed = await placeHold(hold.id);

    expect(placed.status).toBe(200);
    expect(placed.body.status).toBe("HELD");
    expect((await requestHold(holdBody((await newEvent()).id, venueId, "14:00", "18:00", "03"))).status).toBe(201);
  });

  it("places a hold at a venue with no block over its period", async () => {
    const venueId = await newVenue("I4 Auditorium");
    const event = await newEvent();
    const hold = (await requestHold(holdBody(event.id, venueId))).body as { id: string };
    await recordBlock(venueId, "09:00", "10:00");

    expect((await placeHold(hold.id)).status).toBe(200);
  });
});

describe("holds that exist when a block is created (I4-T5, I2)", () => {
  it("flags a Held hold, naming it, and neither releases nor refuses it; a Requested hold is untouched", async () => {
    const venueId = await newVenue("I4 Auditorium");
    const event = await newEvent();
    const held = (await requestHold(holdBody(event.id, venueId))).body as { id: string; reference: string };
    const placed = (await placeHold(held.id)).body as { slotId: string };
    // CR-03: one live hold per event and venue, so the second hold is another event's.
    const requested = (await requestHold(holdBody((await newEvent()).id, venueId, "14:00", "18:00", "03"))).body as { id: string };

    const block = await recordBlock(venueId, "16:00", "19:00");

    expect(block.status).toBe(201);
    expect(block.body.disrupted).toEqual([expect.objectContaining({ kind: "HOLD", reference: held.reference })]);
    expect(await holdRow(held.id)).toMatchObject({ status: "HELD", slot_id: placed.slotId });
    const [slot] = await sql<{ status: string; requires_reconfirmation: boolean }[]>`
      select status, requires_reconfirmation from venue.venue_slots where id = ${placed.slotId}
    `;
    expect(slot).toEqual({ status: "HELD", requires_reconfirmation: true });
    expect(await holdRow(requested.id)).toEqual({ status: "REQUESTED", slot_id: null });
  });
});
