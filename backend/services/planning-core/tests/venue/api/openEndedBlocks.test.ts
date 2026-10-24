import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";

/**
 * I5 (W9-49, decision D-01) — a block may have no end: it lasts until Venue
 * Staff remove it. It disrupts and flags everything that ends after it starts,
 * refuses new requests and holds for any later period, shows on the calendar
 * from its start labelled open-ended, leaves the venue out of search, and its
 * removal lifts it.
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
const OWNER = "a9999999-0000-0000-0000-0000000000c1";
const COORDINATOR = "a9999999-0000-0000-0000-0000000000c2";
const STAFF = "a9999999-0000-0000-0000-0000000000c3";
const BUILDING = "I5 Test Building";
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
  await sql`delete from venue.outbox where message_key in (select id::text from venue.unavailability_blocks where venue_id in (${ours}))`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.booking_requests where venue_id in (${ours}))`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.holds where venue_id in (${ours}))`;
  await sql`delete from venue.block_disruptions where block_id in (${blocks})`;
  await sql`delete from venue.holds where venue_id in (${ours})`;
  await sql`delete from venue.booking_requests where venue_id in (${ours})`;
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

async function newVenue(name: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${name}, ${BUILDING}, 300, ${sql.json([{ name: "Theatre", capacity: 300 }])}, ${sql.json(HOURS)}, ${STAFF}, ${STAFF})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by, updated_by) values (${row!.id}, ${STAFF}, ${STAFF}, ${STAFF})`;
  return row!.id;
}

/** A Singapore time on a day of December 2026 (the 2nd is a Wednesday). */
const at = (hhmm: string, day = "02") => `2026-12-${day}T${hhmm}:00+08:00`;
const utc = (hhmm: string, day = "02") => new Date(at(hhmm, day)).toISOString();

async function newEvent(): Promise<{ id: string; reference: string }> {
  const [row] = await sql<{ id: string; reference: string }[]>`
    insert into event.events (
      reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
      expected_attendance, equipment_required, registration_required, status, submitted_at,
      last_saved_at, created_by, updated_by
    ) values (
      'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'), ${OWNER}, 'I5 Symposium', 'I5 test',
      'I5 test', ${at("14:00")}, ${at("18:00")}, 150, false, false, 'APPROVED', now(), now(), ${OWNER}, ${OWNER}
    )
    returning id, reference
  `;
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
            values (${row!.id}, ${COORDINATOR}, 'TEST', ${COORDINATOR}, ${COORDINATOR})`;
  return row!;
}

const submit = (body: object) => {
  asCoordinator();
  return request(app).post("/api/v1/booking-requests").set(bearer).send(body);
};
const requestBody = (eventId: string, venueId: string, from = "14:00", until = "18:00", day = "02") => ({
  eventId,
  venueId,
  startsAt: at(from, day),
  endsAt: at(until, day),
  layout: "Theatre",
  expectedAttendance: 150,
});
async function requested(eventId: string, venueId: string, from = "14:00", until = "18:00", day = "02") {
  const res = await submit(requestBody(eventId, venueId, from, until, day));
  expect(res.status).toBe(201);
  return res.body as { id: string; reference: string };
}
async function booked(eventId: string, venueId: string, from = "14:00", until = "18:00", day = "02") {
  const made = await requested(eventId, venueId, from, until, day);
  asStaff();
  const res = await request(app).post(`/api/v1/booking-requests/${made.id}/approve`).set(bearer);
  expect(res.status).toBe(200);
  return { ...made, bookingId: res.body.bookingId as string };
}
async function otherBooking(venueId: string, from: string, until: string) {
  const event = await newEvent();
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venue_slots (venue_id, event_id, reference, starts_at, ends_at, status, created_by, updated_by)
    values (${venueId}, ${event.id}, ${`I5-FX-${event.reference}`}, ${at(from)}, ${at(until)}, 'CONFIRMED', ${STAFF}, ${STAFF})
    returning id
  `;
  return { id: row!.id, reference: `I5-FX-${event.reference}` };
}

const noEnd = (extra: Record<string, unknown> = {}) => ({
  startsAt: at("13:00"),
  reasonType: "MAINTENANCE",
  description: "Roof leak repair",
  ...extra,
});
const record = (venueId: string, body: object) => {
  asStaff();
  return request(app).post(`/api/v1/venues/${venueId}/unavailability`).set(bearer).send(body);
};
const impact = (venueId: string, query: object) => {
  asStaff();
  return request(app).get(`/api/v1/venues/${venueId}/unavailability/impact`).query(query).set(bearer);
};
const remove = (venueId: string, blockId: string) => {
  asStaff();
  return request(app).post(`/api/v1/venues/${venueId}/unavailability/${blockId}/remove`).set(bearer);
};
const calendar = (venueId: string, from: string, to: string) => {
  asCoordinator();
  return request(app).get(`/api/v1/venues/${venueId}/availability`).query({ from, to }).set(bearer);
};

const flag = async (table: "venue_slots" | "booking_requests", id: string) =>
  (await sql<{ requires_reconfirmation: boolean }[]>`select requires_reconfirmation from venue.${sql(table)} where id = ${id}`)[0]!
    .requires_reconfirmation;

describe("recording a block with no end (I5-T1, I5-T2)", () => {
  it("creates it Active with no end, whether the end is left out, null or empty, and lists it (I5-T1)", async () => {
    const venueId = await newVenue("I5 Auditorium");
    for (const body of [noEnd(), noEnd({ endsAt: null }), noEnd({ endsAt: "" })]) {
      const res = await record(venueId, body);
      expect(res.status).toBe(201);
      expect(res.body.block).toMatchObject({ venueId, startsAt: utc("13:00"), endsAt: null, status: "ACTIVE", description: "Roof leak repair" });
    }
    const [row] = await sql<{ ends_at: Date | null; status: string }[]>`select ends_at, status from venue.unavailability_blocks where venue_id = ${venueId} limit 1`;
    expect(row).toEqual({ ends_at: null, status: "ACTIVE" });

    asStaff();
    const listed = await request(app).get(`/api/v1/venues/${venueId}/unavailability`).set(bearer);
    expect(listed.body.items).toHaveLength(3);
    expect(listed.body.items[0]).toMatchObject({ startsAt: utc("13:00"), endsAt: null });
  });

  it("still refuses an end that isn't after the start, and names an end that isn't a date and time (I5-T2)", async () => {
    const venueId = await newVenue("I5 Auditorium");

    const equal = await record(venueId, noEnd({ endsAt: at("13:00") }));
    expect(equal.status).toBe(400);
    expect(equal.body.error.fields).toEqual([{ field: "endsAt", message: "The end must be after the start." }]);
    const garbled = await record(venueId, noEnd({ endsAt: "whenever" }));
    expect(garbled.status).toBe(400);
    expect(garbled.body.error.fields[0]).toMatchObject({ field: "endsAt" });
    const [none] = await sql<{ n: number }[]>`select count(*)::int as n from venue.unavailability_blocks where venue_id = ${venueId}`;
    expect(none!.n).toBe(0);

    expect((await record(venueId, noEnd({ endsAt: at("13:01") }))).status).toBe(201);
  });
});

describe("what an open-ended block disrupts (I5-T3, I2)", () => {
  it("lists in the review, then flags, everything that ends after it starts, however late, and not what ended before", async () => {
    const venueId = await newVenue("I5 Auditorium");
    const event = await newEvent();
    const before = await otherBooking(venueId, "10:00", "12:00");
    const during = await booked(event.id, venueId, "14:00", "18:00");
    const later = await requested(event.id, venueId, "14:00", "18:00", "09");
    asCoordinator();
    const hold = await request(app)
      .post("/api/v1/holds")
      .set(bearer)
      .send({ eventId: (await newEvent()).id, venueId, startsAt: at("19:00", "03"), endsAt: at("21:00", "03"), reminderLeadMinutes: 60 });
    asStaff();
    const placed = await request(app).post(`/api/v1/holds/${hold.body.id}/place`).set(bearer).send({ expiresAt: EXPIRY });
    expect(placed.status).toBe(200);

    const review = await impact(venueId, { startsAt: at("13:00") });
    expect(review.status).toBe(200);
    expect(review.body.items.map((i: { reference: string }) => i.reference).sort()).toEqual([during.reference, hold.body.reference, later.reference].sort());

    const res = await record(venueId, noEnd());
    expect(res.status).toBe(201);
    expect(res.body.disrupted.map((d: { reference: string }) => d.reference).sort()).toEqual([during.reference, hold.body.reference, later.reference].sort());
    expect(await flag("venue_slots", during.bookingId)).toBe(true);
    expect(await flag("venue_slots", placed.body.slotId)).toBe(true);
    expect(await flag("booking_requests", later.id)).toBe(true);
    expect(await flag("venue_slots", before.id)).toBe(false);
    const [status] = await sql<{ status: string }[]>`select status from venue.venue_slots where id = ${during.bookingId}`;
    expect(status!.status).toBe("CONFIRMED");
  });
});

describe("what an open-ended block refuses (I5-T4)", () => {
  const named =
    "I5 Auditorium is unavailable for Maintenance, “Roof leak repair” (from Wednesday 2 December 2026, 13:00, open-ended)";

  it("refuses a booking request and a hold for any later period, naming it open-ended, and allows an earlier one", async () => {
    const venueId = await newVenue("I5 Auditorium");
    const event = await newEvent();
    expect((await record(venueId, noEnd())).status).toBe(201);

    const refusedRequest = await submit(requestBody(event.id, venueId, "14:00", "18:00", "21"));
    expect(refusedRequest.status).toBe(409);
    expect(refusedRequest.body.error).toMatchObject({
      code: "VENUE_UNAVAILABLE",
      message: `${named}, so it can't be requested for this period. Choose another time or venue.`,
    });

    asCoordinator();
    const refusedHold = await request(app)
      .post("/api/v1/holds")
      .set(bearer)
      .send({ eventId: event.id, venueId, startsAt: at("14:00", "21"), endsAt: at("18:00", "21"), reminderLeadMinutes: 60 });
    expect(refusedHold.status).toBe(409);
    expect(refusedHold.body.error.message).toBe(`${named}, so a hold can't be requested for this period. Choose another time or venue.`);
    const [stored] = await sql<{ n: number }[]>`select count(*)::int as n from venue.holds where event_id = ${event.id}`;
    expect(stored!.n).toBe(0);

    expect((await submit(requestBody(event.id, venueId, "10:00", "12:00", "01"))).status).toBe(201);
  });

  it("refuses approving a request made before it, naming it and saying nothing was approved", async () => {
    const venueId = await newVenue("I5 Auditorium");
    const event = await newEvent();
    const pending = await requested(event.id, venueId, "14:00", "18:00", "21");
    expect((await record(venueId, noEnd())).status).toBe(201);

    asStaff();
    const res = await request(app).post(`/api/v1/booking-requests/${pending.id}/approve`).set(bearer);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("VENUE_UNAVAILABLE");
    expect(res.body.error.message).toBe(`${pending.reference} wasn't approved: ${named}. Nothing was approved, and the request is still Pending.`);
  });

  it("leaves the venue out of search from its start, and keeps it in for a period before (I5-T6)", async () => {
    const venueId = await newVenue("I5 Auditorium");
    expect((await record(venueId, noEnd())).status).toBe(201);
    asCoordinator();
    const names = async (from: string, to: string) =>
      (await request(app).get("/api/v1/venues/search").query({ location: BUILDING, from, to }).set(bearer)).body.items.map((v: { name: string }) => v.name);

    expect(await names(at("14:00", "21"), at("18:00", "21"))).not.toContain("I5 Auditorium");
    expect(await names(at("14:00", "02"), at("18:00", "02"))).not.toContain("I5 Auditorium");
    expect(await names(at("14:00", "01"), at("18:00", "01"))).toContain("I5 Auditorium");
  });
});

describe("the calendar (I5-T5)", () => {
  it("shows the venue unavailable from the block's start, with no end, labelled open-ended, on every later day", async () => {
    const venueId = await newVenue("I5 Auditorium");
    expect((await record(venueId, noEnd({ startsAt: at("13:00", "09") }))).status).toBe(201);

    const res = await calendar(venueId, "2026-12-08", "2026-12-11");

    expect(res.status).toBe(200);
    const days = res.body.days as {
      date: string;
      committed: { kind: string; startsAt: string; endsAt: string; openEnded?: boolean; reasonType?: string; description?: string }[];
      free: { startsAt: string; endsAt: string }[];
    }[];
    const unavailable = (date: string) => days.find((d) => d.date === date)!.committed.filter((p) => p.kind === "UNAVAILABLE");
    expect(unavailable("2026-12-08")).toEqual([]);
    expect(unavailable("2026-12-09")).toEqual([
      { kind: "UNAVAILABLE", startsAt: utc("13:00", "09"), endsAt: utc("00:00", "10"), openEnded: true, reasonType: "MAINTENANCE", description: "Roof leak repair" },
    ]);
    for (const date of ["2026-12-10", "2026-12-11"]) {
      expect(unavailable(date)).toEqual([expect.objectContaining({ openEnded: true, reasonType: "MAINTENANCE" })]);
      expect(days.find((d) => d.date === date)!.free).toEqual([]);
    }
    expect(days.find((d) => d.date === "2026-12-09")!.free).toEqual([{ startsAt: utc("08:00", "09"), endsAt: utc("13:00", "09") }]);
    expect(days.find((d) => d.date === "2026-12-08")!.free).toEqual([{ startsAt: utc("08:00", "08"), endsAt: utc("22:00", "08") }]);
  });

  it("doesn't label a block that has an end", async () => {
    const venueId = await newVenue("I5 Auditorium");
    expect((await record(venueId, noEnd({ startsAt: at("13:00", "09"), endsAt: at("15:00", "09") }))).status).toBe(201);

    const res = await calendar(venueId, "2026-12-09", "2026-12-09");
    const [block] = res.body.days[0].committed.filter((p: { kind: string }) => p.kind === "UNAVAILABLE");
    expect(block).toMatchObject({ startsAt: utc("13:00", "09"), endsAt: utc("15:00", "09") });
    expect(block.openEnded).toBeUndefined();
  });
});

describe("removing it, and telling the coordinator (I5-T7, I5-T8)", () => {
  it("lifts it: records who and when, clears the flags it set, and allows requests, holds and search again", async () => {
    const venueId = await newVenue("I5 Auditorium");
    const event = await newEvent();
    const during = await booked(event.id, venueId);
    const block = await record(venueId, noEnd());
    expect(await flag("venue_slots", during.bookingId)).toBe(true);

    const removed = await remove(venueId, block.body.block.id);

    expect(removed.status).toBe(200);
    expect(removed.body.block).toMatchObject({ status: "REMOVED", endsAt: null, removedBy: STAFF });
    expect(removed.body.block.removedAt).toEqual(expect.any(String));
    expect(await flag("venue_slots", during.bookingId)).toBe(false);
    expect((await submit(requestBody(event.id, venueId, "14:00", "18:00", "21"))).status).toBe(201);
    asCoordinator();
    const names = (await request(app).get("/api/v1/venues/search").query({ location: BUILDING, from: at("10:00", "22"), to: at("12:00", "22") }).set(bearer)).body.items.map(
      (v: { name: string }) => v.name,
    );
    expect(names).toContain("I5 Auditorium");
  });

  it("writes the disruption message with no block end, to the event's assigned coordinator", async () => {
    const venueId = await newVenue("I5 Auditorium");
    const event = await newEvent();
    const during = await booked(event.id, venueId);

    const block = await record(venueId, noEnd());

    const [message] = await sql<{ envelope: { data: Record<string, unknown> } }[]>`
      select envelope from venue.outbox where message_key = ${block.body.block.id} and envelope->>'type' = 'venue-booking.booking-disrupted'
    `;
    expect(message!.envelope.data).toMatchObject({
      blockId: block.body.block.id,
      reference: during.reference,
      coordinatorId: COORDINATOR,
      blockStartsAt: utc("13:00"),
      blockEndsAt: null,
      reasonType: "MAINTENANCE",
    });
  });
});
