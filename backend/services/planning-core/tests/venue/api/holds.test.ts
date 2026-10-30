import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";
import { setStatusDirect } from "../../support/seedEvent.js";

/**
 * L3 — tentative holds against the venue and event schemas, one test or more
 * per card (tests/L3/): the coordinator requests, Venue Staff place with an
 * expiry, overlaps on occupied periods, first placed wins, the calendar and
 * search, converting into a request, withdrawing it, and releasing.
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
const STAFF = "a9999999-0000-0000-0000-000000000063";
const OTHER_STAFF = "a9999999-0000-0000-0000-000000000064";
const OWNER = "a9999999-0000-0000-0000-000000000061";
const COORDINATOR = "a9999999-0000-0000-0000-000000000062";
const OTHER_COORDINATOR = "a9999999-0000-0000-0000-000000000065";
const bearer = { Authorization: "Bearer test-token" };

function signedInAs(role: string, userId: string) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "user@connectsphere.test", role: role as never });
}
const asCoordinator = () => signedInAs("EVENT_COORDINATOR", COORDINATOR);
const asStaff = () => signedInAs("VENUE_STAFF", STAFF);

const open = (opensAt: string, closesAt: string) => ({ opensAt, closesAt });
const HOURS = {
  monday: open("08:00", "23:00"),
  tuesday: open("08:00", "23:00"),
  wednesday: open("08:00", "23:00"),
  thursday: open("08:00", "23:00"),
  friday: open("08:00", "23:00"),
  saturday: null,
  sunday: null,
};

async function cleanUp() {
  const ours = sql`select id from venue.venues where created_by in ${sql([STAFF, OTHER_STAFF])}`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.booking_requests where venue_id in (${ours}))`;
  await sql`delete from venue.holds where venue_id in (${ours})`;
  await sql`delete from venue.booking_requests where venue_id in (${ours})`;
  await sql`delete from venue.venue_slots where venue_id in (${ours})`;
  await sql`delete from venue.venue_staff where venue_id in (${ours})`;
  await sql`delete from venue.venues where created_by in ${sql([STAFF, OTHER_STAFF])}`;
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

async function newVenue(name: string, options: { staff?: string; setup?: number; turnaround?: number; status?: string } = {}): Promise<string> {
  const creator = options.staff ?? STAFF;
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, facilities, accessibility_features, operating_hours,
                              setup_minutes, turnaround_minutes, status, created_by, updated_by)
    values (${name}, 'L3 Test Building', 300, ${sql.json([{ name: "Theatre", capacity: 300 }])},
            ${["Projector"]}, ${["Step-free access"]}, ${sql.json(HOURS)},
            ${options.setup ?? 0}, ${options.turnaround ?? 0}, ${options.status ?? "ACTIVE"}, ${creator}, ${creator})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by, updated_by) values (${row!.id}, ${creator}, ${creator}, ${creator})`;
  return row!.id;
}

/** A Singapore time on 2 December 2026 (a Wednesday). */
const at = (hhmm: string, day = "02") => `2026-12-${day}T${hhmm}:00+08:00`;
const utc = (hhmm: string, day = "02") => new Date(at(hhmm, day)).toISOString();
/** An expiry comfortably in the future, Singapore time. */
const EXPIRY = "2026-12-01T18:00+08:00";

async function newEvent(status = "APPROVED", coordinator: string | null = COORDINATOR): Promise<{ id: string; reference: string }> {
  const [row] = await sql<{ id: string; reference: string }[]>`
    insert into event.events (
      reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
      expected_attendance, equipment_required, registration_required, status, submitted_at,
      last_saved_at, created_by, updated_by, cancellation_reason, cancelled_by, cancelled_at
    ) values (
      'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'), ${OWNER}, 'L3 test event', 'L3 test',
      'L3 test', ${at("14:00")}, ${at("18:00")}, 150, false, false, ${status}, now(), now(), ${OWNER}, ${OWNER},
      ${status === "CANCELLED" ? "L3 test" : null}, ${status === "CANCELLED" ? OWNER : null}, ${status === "CANCELLED" ? new Date() : null}
    )
    returning id, reference
  `;
  if (coordinator) {
    await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
              values (${row!.id}, ${coordinator}, 'TEST', ${coordinator}, ${coordinator})`;
  }
  return row!;
}

const holdBody = (eventId: string, venueId: string, overrides: Record<string, unknown> = {}) => ({
  eventId,
  venueId,
  startsAt: at("14:00"),
  endsAt: at("18:00"),
  reminderLeadMinutes: 1440,
  ...overrides,
});

const requestHold = (body: unknown) => request(app).post("/api/v1/holds").set(bearer).send(body as object);
const place = (id: string, body: unknown = { expiresAt: EXPIRY }) =>
  request(app).post(`/api/v1/holds/${id}/place`).set(bearer).send(body as object);
const release = (id: string) => request(app).post(`/api/v1/holds/${id}/release`).set(bearer);
const convert = (id: string, body: unknown = { layout: "Theatre", expectedAttendance: 150 }) =>
  request(app).post(`/api/v1/holds/${id}/convert`).set(bearer).send(body as object);
const holdsOf = (eventId: string) => request(app).get("/api/v1/holds").query({ eventId }).set(bearer);
const queue = () => request(app).get("/api/v1/holds/queue").set(bearer);
const withdraw = (id: string) => request(app).post(`/api/v1/booking-requests/${id}/withdraw`).set(bearer);
const calendar = (venueId: string) =>
  request(app).get(`/api/v1/venues/${venueId}/availability`).query({ from: "2026-12-02", to: "2026-12-02" }).set(bearer);

/** Requests and places a hold, returning it Held. */
async function heldHold(eventId: string, venueId: string, overrides: Record<string, unknown> = {}) {
  asCoordinator();
  const requested = await requestHold(holdBody(eventId, venueId, overrides));
  expect(requested.status).toBe(201);
  asStaff();
  const placed = await place(requested.body.id);
  expect(placed.status).toBe(200);
  return placed.body as { id: string; reference: string; slotId: string };
}

async function holdRow(id: string) {
  const [row] = await sql<{ status: string; slot_id: string | null; slot_status: string | null; slot_reference: string | null }[]>`
    select h.status, h.slot_id, s.status as slot_status, s.reference as slot_reference
    from venue.holds h left join venue.venue_slots s on s.id = h.slot_id where h.id = ${id}
  `;
  return row!;
}

async function holdCount(eventId: string): Promise<number> {
  const [row] = await sql<{ n: number }[]>`select count(*)::int as n from venue.holds where event_id = ${eventId}`;
  return row!.n;
}

describe("requesting a hold (L3)", () => {
  it("stores it Requested with an HLD reference, its coordinator, time and reminder, and reserves nothing (L3-T1)", async () => {
    const venueId = await newVenue("L3 Auditorium");
    const event = await newEvent();
    asCoordinator();
    const before = Date.now();

    const res = await requestHold(holdBody(event.id, venueId));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      eventId: event.id,
      eventReference: event.reference,
      venueId,
      venueName: "L3 Auditorium",
      startsAt: utc("14:00"),
      endsAt: utc("18:00"),
      reminderLeadMinutes: 1440,
      status: "REQUESTED",
      requestedBy: COORDINATOR,
      placedBy: null,
      expiresAt: null,
      slotId: null,
    });
    expect(res.body.reference).toMatch(/^HLD-\d{6}$/);
    expect(Date.parse(res.body.requestedAt)).toBeGreaterThanOrEqual(before - 1000);
    const [slots] = await sql<{ n: number }[]>`select count(*)::int as n from venue.venue_slots where venue_id = ${venueId}`;
    expect(slots!.n).toBe(0);
  });

  it("refuses a coordinator who isn't assigned, and an organiser, storing nothing (L3-T2)", async () => {
    const venueId = await newVenue("L3 Auditorium");
    const event = await newEvent();

    signedInAs("EVENT_COORDINATOR", OTHER_COORDINATOR);
    const other = await requestHold(holdBody(event.id, venueId));
    expect(other.status).toBe(403);
    expect(other.body.error).toMatchObject({ code: "ROLE_NOT_AUTHORISED", message: "Only the event's assigned coordinator can request a hold for it." });

    signedInAs("EVENT_ORGANISER", OWNER);
    expect((await requestHold(holdBody(event.id, venueId))).body.error.code).toBe("ROLE_NOT_AUTHORISED");
    expect(await holdCount(event.id)).toBe(0);
  });

  it("refuses an event that is Completed, Cancelled or Rejected, and allows one in Planning (L3-T3)", async () => {
    const venueId = await newVenue("L3 Auditorium");
    asCoordinator();
    for (const [status, label] of [["CANCELLED", "Cancelled"], ["COMPLETED", "Completed"], ["REJECTED", "Rejected"]] as const) {
      const event = await newEvent(status);
      const res = await requestHold(holdBody(event.id, venueId));
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({ code: "EVENT_NOT_HOLDABLE", message: `A venue can't be held for an event that is ${label}.` });
      expect(await holdCount(event.id)).toBe(0);
    }
    const planning = await newEvent("PLANNING");
    expect((await requestHold(holdBody(planning.id, venueId))).status).toBe(201);
  });

  it("refuses a reminder of 0 or 1.5 minutes, and accepts 1 (L3-T4)", async () => {
    const venueId = await newVenue("L3 Auditorium");
    const event = await newEvent();
    asCoordinator();
    for (const reminderLeadMinutes of [0, 1.5]) {
      const res = await requestHold(holdBody(event.id, venueId, { reminderLeadMinutes }));
      expect(res.status).toBe(400);
      expect(res.body.error.fields).toEqual([{ field: "reminderLeadMinutes", message: "Enter a whole number of minutes, at least 1." }]);
    }
    expect(await holdCount(event.id)).toBe(0);
    expect((await requestHold(holdBody(event.id, venueId, { reminderLeadMinutes: 1 }))).body.reminderLeadMinutes).toBe(1);
  });

  it("refuses an unknown or inactive venue", async () => {
    const event = await newEvent();
    const inactive = await newVenue("L3 Closed Hall", { status: "INACTIVE" });
    asCoordinator();
    expect((await requestHold(holdBody(event.id, "00000000-0000-4000-8000-000000000000"))).body.error.code).toBe("VENUE_NOT_FOUND");
    expect((await requestHold(holdBody(event.id, inactive))).body.error).toMatchObject({
      code: "VENUE_INACTIVE",
      message: "L3 Closed Hall is inactive, so it can't be held.",
    });
  });

  it("allows one requested or held hold per event and venue, naming it, and another venue (L3-T11)", async () => {
    const hall = await newVenue("L3 Auditorium");
    const seminar = await newVenue("L3 Seminar Room");
    const event = await newEvent();
    asCoordinator();
    const first = await requestHold(holdBody(event.id, hall));

    const second = await requestHold(holdBody(event.id, hall, { startsAt: at("10:00", "03"), endsAt: at("12:00", "03") }));
    expect(second.status).toBe(409);
    expect(second.body.error).toMatchObject({
      code: "HOLD_DUPLICATE",
      message: `This event already has hold ${first.body.reference} at L3 Auditorium. Release it, or convert it into a booking request, before holding the venue again.`,
    });
    expect((await requestHold(holdBody(event.id, seminar))).status).toBe(201);
    expect(await holdCount(event.id)).toBe(2);
  });
});

describe("placing a hold (L3)", () => {
  it("lists the request for the venue's staff, and placing it makes it Held with a slot, who placed it, when and the expiry (L3-T5)", async () => {
    const venueId = await newVenue("L3 Auditorium");
    const event = await newEvent();
    asCoordinator();
    const requested = await requestHold(holdBody(event.id, venueId));

    asStaff();
    const listed = await queue();
    expect(listed.body.items).toEqual([expect.objectContaining({ id: requested.body.id, eventReference: event.reference, status: "REQUESTED" })]);
    signedInAs("VENUE_STAFF", OTHER_STAFF);
    expect((await queue()).body.items).toEqual([]);

    asStaff();
    const before = Date.now();
    const placed = await place(requested.body.id);
    expect(placed.status).toBe(200);
    expect(placed.body).toMatchObject({ status: "HELD", placedBy: STAFF, expiresAt: new Date(EXPIRY).toISOString() });
    expect(Date.parse(placed.body.placedAt)).toBeGreaterThanOrEqual(before - 1000);
    expect(await holdRow(requested.body.id)).toMatchObject({ status: "HELD", slot_status: "HELD", slot_reference: requested.body.reference });
    expect((await queue()).body.items).toEqual([]);
  });

  it("refuses an expiry now or earlier, or none, and accepts one 2 minutes ahead (L3-T6)", async () => {
    const venueId = await newVenue("L3 Auditorium");
    const event = await newEvent();
    asCoordinator();
    const { id } = (await requestHold(holdBody(event.id, venueId))).body;
    asStaff();

    const past = await place(id, { expiresAt: new Date(Date.now() - 60_000).toISOString() });
    expect(past.status).toBe(400);
    expect(past.body.error.fields).toEqual([{ field: "expiresAt", message: "The expiry must be later than now." }]);
    expect((await place(id, {})).body.error.fields).toEqual([{ field: "expiresAt", message: "Enter the expiry date and time." }]);
    expect(await holdRow(id)).toMatchObject({ status: "REQUESTED", slot_id: null });

    const soon = new Date(Date.now() + 120_000).toISOString();
    expect((await place(id, { expiresAt: soon })).body).toMatchObject({ status: "HELD", expiresAt: soon });
  });

  it("lets only the venue's own staff place it; a coordinator can't (L3-T7)", async () => {
    const theirs = await newVenue("L3 Other Hall", { staff: OTHER_STAFF });
    const event = await newEvent();
    asCoordinator();
    const { id } = (await requestHold(holdBody(event.id, theirs))).body;

    asStaff();
    expect((await place(id)).body.error.code).toBe("HOLD_NOT_FOUND");
    asCoordinator();
    expect((await place(id)).body.error.code).toBe("ROLE_NOT_AUTHORISED");
    expect(await holdRow(id)).toMatchObject({ status: "REQUESTED", slot_id: null });
  });

  it("refuses an overlapping placement, naming the other hold and its period; the hold stays Requested (L3-T8)", async () => {
    const venueId = await newVenue("L3 Auditorium");
    const first = await heldHold((await newEvent()).id, venueId);
    const rival = await newEvent("APPROVED", OTHER_COORDINATOR);
    signedInAs("EVENT_COORDINATOR", OTHER_COORDINATOR);
    const { id } = (await requestHold(holdBody(rival.id, venueId, { startsAt: at("16:00"), endsAt: at("20:00") }))).body;

    asStaff();
    const res = await place(id);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: "VENUE_SLOT_CONFLICT",
      message: `This period overlaps ${first.reference} (Wednesday 2 December 2026, 14:00–18:00) at L3 Auditorium. A held or booked period can't be taken by another event.`,
    });
    expect(await holdRow(id)).toMatchObject({ status: "REQUESTED", slot_id: null });
    expect((await queue()).body.items.map((h: { id: string }) => h.id)).toEqual([id]);
  });

  it("uses occupied periods: overlapping buffers are refused, touching ones both placed (L3-T9)", async () => {
    const venueId = await newVenue("L3 Auditorium", { setup: 30, turnaround: 45 });
    const first = await heldHold((await newEvent()).id, venueId); // occupies 13:30–18:45
    const rival = await newEvent("APPROVED", OTHER_COORDINATOR);

    signedInAs("EVENT_COORDINATOR", OTHER_COORDINATOR);
    const early = (await requestHold(holdBody(rival.id, venueId, { startsAt: at("19:00"), endsAt: at("21:00") }))).body;
    asStaff();
    const refused = await place(early.id); // would occupy 18:30–21:45
    expect(refused.body.error.message).toContain(`${first.reference} (Wednesday 2 December 2026, 14:00–18:00)`);

    signedInAs("EVENT_COORDINATOR", OTHER_COORDINATOR);
    expect((await release(early.id)).status).toBe(200);
    const touching = (await requestHold(holdBody(rival.id, venueId, { startsAt: at("19:15"), endsAt: at("21:00") }))).body;
    asStaff();
    expect((await place(touching.id)).body.status).toBe("HELD"); // occupies 18:45–21:45
  });

  it("gives the period to whichever hold is placed first, not requested first (L3-T10)", async () => {
    const venueId = await newVenue("L3 Auditorium");
    const event = await newEvent();
    const rival = await newEvent("APPROVED", OTHER_COORDINATOR);
    asCoordinator();
    const a = (await requestHold(holdBody(event.id, venueId))).body;
    signedInAs("EVENT_COORDINATOR", OTHER_COORDINATOR);
    const b = (await requestHold(holdBody(rival.id, venueId))).body;

    asStaff();
    expect((await place(b.id)).body.status).toBe("HELD");
    const late = await place(a.id);
    expect(late.body.error.code).toBe("VENUE_SLOT_CONFLICT");
    expect(late.body.error.message).toContain(b.reference);
    expect(await holdRow(a.id)).toMatchObject({ status: "REQUESTED" });
  });

  it("refuses placing a hold that isn't Requested, or whose event has since been cancelled", async () => {
    const venueId = await newVenue("L3 Auditorium");
    const event = await newEvent();
    const held = await heldHold(event.id, venueId);
    const again = await place(held.id);
    expect(again.body.error).toMatchObject({ code: "HOLD_NOT_REQUESTED", message: `${held.reference} is Held, so it can't be placed. Only a requested hold can be.` });

    const other = await newEvent();
    asCoordinator();
    const { id } = (await requestHold(holdBody(other.id, venueId, { startsAt: at("19:00"), endsAt: at("21:00") }))).body;
    await setStatusDirect(sql, other.id, "CANCELLED");
    asStaff();
    expect((await place(id)).body.error.code).toBe("EVENT_NOT_HOLDABLE");
  });
});

describe("what a hold shows, and what it doesn't do (L3)", () => {
  it("shows the held period as Held with the event reference, and leaves the venue out of search for it (L3-T12)", async () => {
    const venueId = await newVenue("L3 Auditorium");
    const event = await newEvent();
    await heldHold(event.id, venueId);

    asCoordinator();
    const day = (await calendar(venueId)).body.days[0];
    expect(day.committed).toContainEqual(
      expect.objectContaining({ kind: "BOOKING", bookingStatus: "HELD", eventReference: event.reference, startsAt: utc("14:00"), endsAt: utc("18:00") }),
    );

    const search = (from: string, to: string) =>
      request(app).get("/api/v1/venues/search").query({ q: "L3 Auditorium", from: at(from), to: at(to) }).set(bearer);
    const names = (res: request.Response) => (res.body.items as { name: string }[]).map((v) => v.name);
    expect(names(await search("15:00", "16:00"))).not.toContain("L3 Auditorium");
    expect(names(await search("19:00", "20:00"))).toContain("L3 Auditorium");
  });

  it("creates no confirmed booking and leaves the event's status alone (L3-T16)", async () => {
    const venueId = await newVenue("L3 Auditorium");
    const event = await newEvent("PLANNING");
    await heldHold(event.id, venueId);
    const [row] = await sql<{ status: string }[]>`select status from event.events where id = ${event.id}`;
    expect(row!.status).toBe("PLANNING");
    const [confirmed] = await sql<{ n: number }[]>`
      select count(*)::int as n from venue.venue_slots where venue_id = ${venueId} and status = 'CONFIRMED'`;
    expect(confirmed!.n).toBe(0);
  });

  it("lists an event's holds for its coordinator and organiser, but not for Venue Staff", async () => {
    const venueId = await newVenue("L3 Auditorium");
    const event = await newEvent();
    const held = await heldHold(event.id, venueId);
    asCoordinator();
    expect((await holdsOf(event.id)).body.items).toEqual([expect.objectContaining({ id: held.id, status: "HELD", eventReference: event.reference })]);
    signedInAs("EVENT_ORGANISER", OWNER);
    expect((await holdsOf(event.id)).body.items).toHaveLength(1);
    asStaff();
    expect((await holdsOf(event.id)).status).toBe(403);
  });
});

describe("converting and releasing (L3)", () => {
  it("converts a Held hold into a request for its venue and period; the slot stays HELD under the request, shown once as Pending (L3-T13)", async () => {
    const venueId = await newVenue("L3 Auditorium");
    const event = await newEvent();
    const held = await heldHold(event.id, venueId);

    asCoordinator();
    // The period sent is ignored: the hold's is used.
    const res = await convert(held.id, { layout: "theatre", expectedAttendance: 150, startsAt: at("09:00"), endsAt: at("10:00") });
    expect(res.status).toBe(201);
    expect(res.body.request).toMatchObject({ venueId, startsAt: utc("14:00"), endsAt: utc("18:00"), layout: "Theatre", status: "PENDING" });
    expect(res.body.hold).toMatchObject({ status: "CONVERTED", convertedRequestId: res.body.request.id, convertedBy: COORDINATOR });
    expect(await holdRow(held.id)).toMatchObject({ status: "CONVERTED", slot_status: "HELD", slot_reference: res.body.request.reference });

    const bookings = (await calendar(venueId)).body.days[0].committed.filter((p: { kind: string }) => p.kind === "BOOKING");
    expect(bookings).toEqual([expect.objectContaining({ bookingStatus: "PENDING", eventReference: event.reference })]);
  });

  it("returns the converted request with what it clashes with at the venue (N2)", async () => {
    const venueId = await newVenue("L3 Auditorium");
    const other = await newEvent();
    asCoordinator();
    const pending = await request(app)
      .post("/api/v1/booking-requests")
      .set(bearer)
      .send({ eventId: other.id, venueId, startsAt: at("17:00"), endsAt: at("19:00"), layout: "Theatre", expectedAttendance: 150 });
    expect(pending.status).toBe(201);
    const held = await heldHold((await newEvent()).id, venueId);

    asCoordinator();
    const res = await convert(held.id);
    expect(res.status).toBe(201);
    expect(res.body.request.conflicts).toEqual([
      { kind: "REQUEST", reference: pending.body.reference, startsAt: utc("17:00"), endsAt: utc("19:00") },
    ]);
  });

  it("refuses converting a hold that isn't Held, or has passed its expiry", async () => {
    const venueId = await newVenue("L3 Auditorium");
    const event = await newEvent();
    asCoordinator();
    const requested = (await requestHold(holdBody(event.id, venueId))).body;
    expect((await convert(requested.id)).body.error).toMatchObject({
      code: "HOLD_NOT_HELD",
      message: `${requested.reference} is Requested, so it can't be converted. Only a hold Venue Staff have placed can be.`,
    });

    asStaff();
    await place(requested.id);
    await sql`update venue.holds set placed_at = now() - interval '2 hours', expires_at = now() - interval '1 hour' where id = ${requested.id}`;
    asCoordinator();
    const expired = await convert(requested.id);
    expect(expired.body.error.code).toBe("HOLD_NOT_HELD");
    expect(expired.body.error.message).toMatch(/expired on .*, so it can't be converted\. Ask for a new hold\.$/);
    const [requests] = await sql<{ n: number }[]>`select count(*)::int as n from venue.booking_requests where event_id = ${event.id}`;
    expect(requests!.n).toBe(0);
  });

  it("refuses converting for an event not yet approved, or by a coordinator who isn't assigned", async () => {
    const venueId = await newVenue("L3 Auditorium");
    const review = await newEvent("UNDER_REVIEW");
    const held = await heldHold(review.id, venueId);
    asCoordinator();
    expect((await convert(held.id)).body.error.code).toBe("EVENT_NOT_BOOKABLE");
    signedInAs("EVENT_COORDINATOR", OTHER_COORDINATOR);
    expect((await convert(held.id)).body.error.code).toBe("ROLE_NOT_AUTHORISED");
    expect(await holdRow(held.id)).toMatchObject({ status: "HELD" });
  });

  it("releases the held period when the converted request is withdrawn (L3-T14)", async () => {
    const venueId = await newVenue("L3 Auditorium");
    const event = await newEvent();
    const held = await heldHold(event.id, venueId);
    asCoordinator();
    const converted = (await convert(held.id)).body;

    expect((await withdraw(converted.request.id)).body.status).toBe("WITHDRAWN");
    expect(await holdRow(held.id)).toMatchObject({ status: "CONVERTED", slot_status: "RELEASED" });
    const bookings = (await calendar(venueId)).body.days[0].committed.filter((p: { kind: string }) => p.kind === "BOOKING");
    expect(bookings).toEqual([]);
  });

  it("confirms the held period itself when the converted request is approved, without a second booking (L3-T13, M1)", async () => {
    const venueId = await newVenue("L3 Auditorium");
    const event = await newEvent();
    const held = await heldHold(event.id, venueId);
    asCoordinator();
    const converted = (await convert(held.id)).body;

    asStaff();
    const approved = await request(app).post(`/api/v1/booking-requests/${converted.request.id}/approve`).set(bearer);
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("APPROVED");
    const hold = await holdRow(held.id);
    expect(hold).toMatchObject({ status: "CONVERTED", slot_status: "CONFIRMED" });
    const [row] = await sql<{ booking_id: string }[]>`select booking_id from venue.booking_requests where id = ${converted.request.id}`;
    expect(row!.booking_id).toBe(hold.slot_id);
    const slots = await sql`select status from venue.venue_slots where venue_id = ${venueId}`;
    expect(slots.map((s) => s.status)).toEqual(["CONFIRMED"]);
  });

  it("releases the held period when the converted request is rejected (L3-T14, M2)", async () => {
    const venueId = await newVenue("L3 Auditorium");
    const event = await newEvent();
    const other = await newEvent();
    const held = await heldHold(event.id, venueId);
    asCoordinator();
    const converted = (await convert(held.id)).body;

    asStaff();
    const rejected = await request(app)
      .post(`/api/v1/booking-requests/${converted.request.id}/reject`)
      .set(bearer)
      .send({ reason: "The hall is closed for a private function." });
    expect(rejected.body.status).toBe("REJECTED");
    expect(await holdRow(held.id)).toMatchObject({ status: "CONVERTED", slot_status: "RELEASED" });
    // The period is free: another event's hold can take it (heldHold expects the placement to succeed).
    expect((await heldHold(other.id, venueId)).slotId).toBeTruthy();
  });

  it("releases a requested or held hold for its coordinator only, keeping the record (L3-T15)", async () => {
    const hall = await newVenue("L3 Auditorium");
    const seminar = await newVenue("L3 Seminar Room");
    const event = await newEvent();
    const held = await heldHold(event.id, hall);
    asCoordinator();
    const requested = (await requestHold(holdBody(event.id, seminar))).body;

    signedInAs("EVENT_COORDINATOR", OTHER_COORDINATOR);
    expect((await release(held.id)).status).toBe(403);

    asCoordinator();
    expect((await release(held.id)).body).toMatchObject({ status: "RELEASED", releasedBy: COORDINATOR });
    expect((await release(requested.id)).body).toMatchObject({ status: "RELEASED" });
    expect(await holdRow(held.id)).toMatchObject({ status: "RELEASED", slot_status: "RELEASED" });
    expect(await holdRow(requested.id)).toMatchObject({ status: "RELEASED", slot_id: null });
    expect((await calendar(hall)).body.days[0].committed.filter((p: { kind: string }) => p.kind === "BOOKING")).toEqual([]);

    const again = await release(held.id);
    expect(again.body.error).toMatchObject({
      code: "HOLD_NOT_HELD",
      message: `${held.reference} is Released, so it can't be released. Only a requested or held hold can be.`,
    });
    // Released, the venue can be held again.
    expect((await requestHold(holdBody(event.id, hall))).status).toBe(201);
  });

  it("answers 404 for an unknown hold", async () => {
    asCoordinator();
    expect((await release("not-a-uuid")).body.error.code).toBe("HOLD_NOT_FOUND");
    expect((await convert("00000000-0000-4000-8000-000000000000")).body.error.code).toBe("HOLD_NOT_FOUND");
  });
});
