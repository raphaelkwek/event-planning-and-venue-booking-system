import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { testDb } from "../../support/testDb.js";

/**
 * L1, L2 — booking requests against the venue and event schemas: raising one,
 * the Venue Staff queue, the calendar, refusals that store nothing, and
 * withdrawal. The setup mirrors FX-BOOKING (tests/L1/README.md).
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
const STAFF = "a9999999-0000-0000-0000-000000000043";
const OTHER_STAFF = "a9999999-0000-0000-0000-000000000044";
const OWNER = "a9999999-0000-0000-0000-000000000041";
const COORDINATOR = "a9999999-0000-0000-0000-000000000042";
const OTHER_COORDINATOR = "a9999999-0000-0000-0000-000000000045";
const bearer = { Authorization: "Bearer test-token" };

function signedInAs(role: string, userId: string) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "user@connectsphere.test", role: role as never });
}

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
  const ours = sql`select id from venue.venues where created_by in ${sql([STAFF, OTHER_STAFF])}`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.booking_requests where venue_id in (${ours}))`;
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

async function newVenue(name: string, options: { staff?: string; status?: string } = {}): Promise<string> {
  const creator = options.staff ?? STAFF;
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, facilities, accessibility_features, operating_hours, status, created_by, updated_by)
    values (${name}, 'L1 Test Building', 300,
            ${sql.json([{ name: "Theatre", capacity: 300 }, { name: "Classroom", capacity: 120 }])},
            ${["Projector", "Wireless microphones"]}, ${["Step-free access", "Hearing loop"]}, ${sql.json(HOURS)},
            ${options.status ?? "ACTIVE"}, ${creator}, ${creator})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by, updated_by) values (${row!.id}, ${creator}, ${creator}, ${creator})`;
  return row!.id;
}

/** A Singapore time on 2 December 2026. */
const at = (hhmm: string) => `2026-12-02T${hhmm}:00+08:00`;
const utc = (hhmm: string) => new Date(at(hhmm)).toISOString();

async function newEvent(status = "APPROVED", coordinator: string | null = COORDINATOR): Promise<{ id: string; reference: string }> {
  const [row] = await sql<{ id: string; reference: string }[]>`
    insert into event.events (
      reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
      expected_attendance, equipment_required, registration_required, status, submitted_at,
      last_saved_at, created_by, updated_by
    ) values (
      'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'), ${OWNER}, 'L1 test event', 'L1 test',
      'L1 test', ${at("14:00")}, ${at("18:00")}, 150, false, false, ${status}, now(), now(), ${OWNER}, ${OWNER}
    )
    returning id, reference
  `;
  if (coordinator) {
    await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
              values (${row!.id}, ${coordinator}, 'TEST', ${coordinator}, ${coordinator})`;
  }
  return row!;
}

function body(eventId: string, venueId: string, overrides: Record<string, unknown> = {}) {
  return {
    eventId,
    venueId,
    startsAt: at("14:00"),
    endsAt: at("18:00"),
    layout: "Theatre",
    expectedAttendance: 150,
    facilities: ["Projector"],
    accessibilityFeatures: ["Step-free access"],
    ...overrides,
  };
}

const submit = (payload: unknown) => request(app).post("/api/v1/booking-requests").set(bearer).send(payload as object);
const withdraw = (id: string) => request(app).post(`/api/v1/booking-requests/${id}/withdraw`).set(bearer);
const queue = () => request(app).get("/api/v1/booking-requests/queue").set(bearer);
const forEvent = (eventId: string) => request(app).get("/api/v1/booking-requests").query({ eventId }).set(bearer);

async function requestCount(eventId: string): Promise<number> {
  const [row] = await sql<{ n: number }[]>`select count(*)::int as n from venue.booking_requests where event_id = ${eventId}`;
  return row!.n;
}

describe("POST /api/v1/booking-requests (L1)", () => {
  it("stores a Pending request with every detail, its coordinator, time and a BKR reference (L1-T1, L1-T2)", async () => {
    const venueId = await newVenue("L1 Auditorium");
    const event = await newEvent();
    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    const before = Date.now();

    const res = await submit(body(event.id, venueId, { layout: "classroom", facilities: ["Projector", "Wireless microphones"], accessibilityFeatures: ["Step-free access", "Hearing loop"] }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      reference: expect.stringMatching(/^BKR-\d{6}$/),
      status: "PENDING",
      eventId: event.id,
      eventReference: event.reference,
      venueId,
      venueName: "L1 Auditorium",
      startsAt: utc("14:00"),
      endsAt: utc("18:00"),
      layout: "Classroom",
      expectedAttendance: 150,
      facilities: ["Projector", "Wireless microphones"],
      accessibilityFeatures: ["Step-free access", "Hearing loop"],
      differsFromEvent: false,
      differences: [],
      replacesBookingId: null,
      requestedBy: COORDINATOR,
    });
    expect(Date.parse(res.body.requestedAt)).toBeGreaterThanOrEqual(before - 5000);
  });

  it("gives every request its own reference", async () => {
    const first = await newVenue("L1 First");
    const second = await newVenue("L1 Second");
    const event = await newEvent();
    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    const a = await submit(body(event.id, first));
    const b = await submit(body(event.id, second));
    expect(a.body.reference).not.toBe(b.body.reference);
  });

  it("flags a request whose times or attendance differ from the event's, with each value (L1-T3, L1-T4)", async () => {
    const venueId = await newVenue("L1 Auditorium");
    const event = await newEvent();
    signedInAs("EVENT_COORDINATOR", COORDINATOR);

    const res = await submit(body(event.id, venueId, { endsAt: at("19:00"), expectedAttendance: 180 }));

    expect(res.body.differsFromEvent).toBe(true);
    expect(res.body.differences).toEqual([
      { field: "endsAt", event: utc("18:00"), requested: utc("19:00") },
      { field: "expectedAttendance", event: 150, requested: 180 },
    ]);
  });

  it("writes one message to the venue outbox naming the venue's staff, in the same transaction (L1-T7)", async () => {
    const venueId = await newVenue("L1 Auditorium");
    const event = await newEvent();
    signedInAs("EVENT_COORDINATOR", COORDINATOR);

    const res = await submit(body(event.id, venueId));

    const rows = await sql<{ topic: string; envelope: { type: string; data: Record<string, unknown> } }[]>`
      select topic, envelope from venue.outbox where message_key = ${res.body.id}
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.topic).toBe("connectsphere.venue-booking.v1");
    expect(rows[0]!.envelope.type).toBe("venue-booking.request-submitted");
    expect(rows[0]!.envelope.data).toMatchObject({
      bookingRequestId: res.body.id,
      reference: res.body.reference,
      eventReference: event.reference,
      venueName: "L1 Auditorium",
      staffIds: [STAFF],
      requestedBy: COORDINATOR,
    });
  });

  it("refuses a second pending request for the same event, venue and an overlapping period, naming the first (L1-T8)", async () => {
    const venueId = await newVenue("L1 Auditorium");
    const event = await newEvent();
    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    const first = await submit(body(event.id, venueId));

    const overlapping = await submit(body(event.id, venueId, { startsAt: at("17:00"), endsAt: at("20:00") }));
    expect(overlapping.status).toBe(409);
    expect(overlapping.body.error.code).toBe("BOOKING_REQUEST_DUPLICATE");
    expect(overlapping.body.error.message).toContain(first.body.reference);
    expect(await requestCount(event.id)).toBe(1);

    const touching = await submit(body(event.id, venueId, { startsAt: at("18:00"), endsAt: at("20:00") }));
    expect(touching.status).toBe(201);
  });

  it("lets exactly one of two simultaneous duplicate requests through", async () => {
    const venueId = await newVenue("L1 Auditorium");
    const event = await newEvent();
    signedInAs("EVENT_COORDINATOR", COORDINATOR);

    const results = await Promise.all([submit(body(event.id, venueId)), submit(body(event.id, venueId))]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await requestCount(event.id)).toBe(1);
  });

  it("allows the same period at another venue, and another event's request for the same venue (L1-T9)", async () => {
    const main = await newVenue("L1 Main Hall");
    const breakout = await newVenue("L1 Breakout");
    const event = await newEvent();
    const other = await newEvent();
    signedInAs("EVENT_COORDINATOR", COORDINATOR);

    expect((await submit(body(event.id, main))).status).toBe(201);
    expect((await submit(body(event.id, breakout))).status).toBe(201);
    expect((await submit(body(other.id, main))).status).toBe(201);
  });

  it("links a replacement to the event's disrupted booking, and refuses any other booking (L1-T10)", async () => {
    const venueId = await newVenue("L1 Auditorium");
    const disruptedVenue = await newVenue("L1 Disrupted Room");
    const event = await newEvent();
    const other = await newEvent();
    const slot = async (eventId: string, flagged: boolean) => {
      const [row] = await sql<{ id: string }[]>`
        insert into venue.venue_slots (venue_id, event_id, reference, starts_at, ends_at, status, requires_reconfirmation, created_by, updated_by)
        values (${disruptedVenue}, ${eventId}, ${`L1-${randomUUID().slice(0, 8)}`}, ${at(flagged ? "14:00" : "08:00")}, ${at(flagged ? "18:00" : "10:00")},
                'CONFIRMED', ${flagged}, ${STAFF}, ${STAFF})
        returning id
      `;
      return row!.id;
    };
    const flagged = await slot(event.id, true);
    const unflagged = await slot(event.id, false);
    signedInAs("EVENT_COORDINATOR", COORDINATOR);

    const linked = await submit(body(event.id, venueId, { replacesBookingId: flagged }));
    expect(linked.status).toBe(201);
    expect(linked.body.replacesBookingId).toBe(flagged);

    const otherFlagged = await sql<{ id: string }[]>`
      insert into venue.venue_slots (venue_id, event_id, reference, starts_at, ends_at, status, requires_reconfirmation, created_by, updated_by)
      values (${disruptedVenue}, ${other.id}, 'L1-OTHER', ${at("19:00")}, ${at("21:00")}, 'CONFIRMED', true, ${STAFF}, ${STAFF})
      returning id
    `;
    for (const replacesBookingId of [unflagged, otherFlagged[0]!.id, randomUUID()]) {
      const refused = await submit(body(event.id, venueId, { replacesBookingId, startsAt: at("19:00"), endsAt: at("21:00") }));
      expect(refused.status).toBe(422);
      expect(refused.body.error).toMatchObject({
        code: "REPLACEMENT_NOT_VALID",
        message: "The booking to replace must be one of this event's confirmed bookings flagged Requires Reconfirmation.",
      });
    }
    expect(await requestCount(event.id)).toBe(1);
  });

  it("refuses anyone but the event's assigned coordinator, storing nothing (L1-T11)", async () => {
    const venueId = await newVenue("L1 Auditorium");
    const event = await newEvent();

    signedInAs("EVENT_COORDINATOR", OTHER_COORDINATOR);
    const unassigned = await submit(body(event.id, venueId));
    expect(unassigned.status).toBe(403);
    expect(unassigned.body.error).toMatchObject({
      code: "ROLE_NOT_AUTHORISED",
      message: "Only the event's assigned coordinator can request a venue for it.",
    });

    for (const [role, userId] of [["EVENT_ORGANISER", OWNER], ["VENUE_STAFF", STAFF], ["TECH_SUPPORT_STAFF", STAFF]] as const) {
      signedInAs(role, userId);
      const refused = await submit(body(event.id, venueId));
      expect(refused.status, role).toBe(403);
      expect(refused.body.error.code).toBe("ROLE_NOT_AUTHORISED");
    }
    expect(await requestCount(event.id)).toBe(0);
  });

  it("refuses invalid fields, naming each, and stores nothing (L1-T12)", async () => {
    const venueId = await newVenue("L1 Auditorium");
    const event = await newEvent();
    signedInAs("EVENT_COORDINATOR", COORDINATOR);

    const res = await submit(body(event.id, venueId, { endsAt: at("13:00"), expectedAttendance: 0 }));

    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f: { field: string }) => f.field)).toEqual(["endsAt", "expectedAttendance"]);
    expect(await requestCount(event.id)).toBe(0);
  });

  it("refuses an event that isn't approved yet, and accepts one that is (L1-T13)", async () => {
    const venueId = await newVenue("L1 Auditorium");
    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    for (const [status, label] of [["UNDER_REVIEW", "Under Review"], ["COMPLETED", "Completed"], ["REJECTED", "Rejected"]]) {
      const event = await newEvent(status);
      const res = await submit(body(event.id, venueId));
      expect(res.status, status).toBe(409);
      expect(res.body.error.code).toBe("EVENT_NOT_BOOKABLE");
      expect(res.body.error.message).toContain(`It is ${label}.`);
      expect(await requestCount(event.id)).toBe(0);
    }
    for (const status of ["APPROVED", "PLANNING", "SAFETY_REVIEW", "CONFIRMED"]) {
      const event = await newEvent(status);
      expect((await submit(body(event.id, venueId))).status, status).toBe(201);
    }
  });

  it("refuses an inactive or unknown venue, a layout it doesn't have, and an unknown event (L1-T14)", async () => {
    const venueId = await newVenue("L1 Auditorium");
    const inactive = await newVenue("L1 Old Theatre", { status: "INACTIVE" });
    const event = await newEvent();
    signedInAs("EVENT_COORDINATOR", COORDINATOR);

    const closed = await submit(body(event.id, inactive));
    expect(closed.status).toBe(422);
    expect(closed.body.error).toMatchObject({ code: "VENUE_INACTIVE", message: "L1 Old Theatre is inactive, so it can't be requested." });

    const unknown = await submit(body(event.id, randomUUID()));
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("VENUE_NOT_FOUND");

    const layout = await submit(body(event.id, venueId, { layout: "Boardroom" }));
    expect(layout.status).toBe(400);
    expect(layout.body.error.fields).toEqual([{ field: "layout", message: "L1 Auditorium has no Boardroom layout." }]);

    const noEvent = await submit(body(randomUUID(), venueId));
    expect(noEvent.status).toBe(404);
    expect(noEvent.body.error.code).toBe("EVENT_NOT_FOUND");

    expect(await requestCount(event.id)).toBe(0);
  });

  it("is rate limited (until the gateway's limits, ADR-0011)", async () => {
    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    const res = await submit({});
    expect(res.headers["ratelimit-policy"]).toMatch(/q=120; w=60/);
  });
});

describe("GET /api/v1/booking-requests (the event's requests) and /queue (Venue Staff)", () => {
  it("lists an event's requests with the event's own values, for its coordinator and its owner", async () => {
    const venueId = await newVenue("L1 Auditorium");
    const event = await newEvent();
    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    const made = await submit(body(event.id, venueId));

    const res = await forEvent(event.id);
    expect(res.status).toBe(200);
    expect(res.body.event).toMatchObject({
      id: event.id,
      reference: event.reference,
      status: "APPROVED",
      assignedCoordinatorId: COORDINATOR,
      proposedStartAt: utc("14:00"),
      proposedEndAt: utc("18:00"),
      expectedAttendance: 150,
    });
    expect(res.body.items.map((item: { reference: string }) => item.reference)).toEqual([made.body.reference]);

    signedInAs("EVENT_ORGANISER", OWNER);
    expect((await forEvent(event.id)).status).toBe(200);
    signedInAs("EVENT_ORGANISER", randomUUID());
    expect((await forEvent(event.id)).status).toBe(404);
  });

  it("shows Venue Staff the pending requests for their own venues only, differences included (L1-T5, L1-T4)", async () => {
    const mine = await newVenue("L1 Auditorium");
    const theirs = await newVenue("L1 Other Hall", { staff: OTHER_STAFF });
    const event = await newEvent();
    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    const forMine = await submit(body(event.id, mine, { expectedAttendance: 180 }));
    const forTheirs = await submit(body(event.id, theirs));

    signedInAs("VENUE_STAFF", STAFF);
    const res = await queue();

    expect(res.status).toBe(200);
    const references = res.body.items.map((item: { reference: string }) => item.reference);
    expect(references).toContain(forMine.body.reference);
    expect(references).not.toContain(forTheirs.body.reference);
    expect(res.body.items.find((item: { reference: string }) => item.reference === forMine.body.reference)).toMatchObject({
      eventReference: event.reference,
      venueName: "L1 Auditorium",
      layout: "Theatre",
      expectedAttendance: 180,
      differsFromEvent: true,
      differences: [{ field: "expectedAttendance", event: 150, requested: 180 }],
      requestedBy: COORDINATOR,
    });

    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    expect((await queue()).status).toBe(403);
  });

  it("shows a pending request on the venue's calendar, labelled with the event reference (L1-T6)", async () => {
    const venueId = await newVenue("L1 Auditorium");
    const event = await newEvent();
    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    await submit(body(event.id, venueId));

    const res = await request(app).get(`/api/v1/venues/${venueId}/availability`).query({ from: "2026-12-02", to: "2026-12-02" }).set(bearer);

    expect(res.body.days[0].committed).toContainEqual({
      kind: "BOOKING",
      startsAt: utc("14:00"),
      endsAt: utc("18:00"),
      bookingStatus: "PENDING",
      eventReference: event.reference,
    });
  });
});

describe("POST /api/v1/booking-requests/:id/withdraw (L2)", () => {
  async function pending() {
    const venueId = await newVenue("L1 Auditorium");
    const event = await newEvent();
    signedInAs("EVENT_COORDINATOR", COORDINATOR);
    const made = await submit(body(event.id, venueId));
    return { venueId, event, id: made.body.id as string, reference: made.body.reference as string };
  }

  it("withdraws a pending request, recording who and when, and keeps the record (L2-T1)", async () => {
    const { id, event } = await pending();
    const before = Date.now();

    const res = await withdraw(id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, status: "WITHDRAWN", withdrawnBy: COORDINATOR });
    expect(Date.parse(res.body.withdrawnAt)).toBeGreaterThanOrEqual(before - 5000);
    expect((await forEvent(event.id)).body.items.map((item: { status: string }) => item.status)).toEqual(["WITHDRAWN"]);
  });

  it("refuses anyone but the event's assigned coordinator, changing nothing (L2-T2)", async () => {
    const { id } = await pending();
    for (const [role, userId] of [["EVENT_COORDINATOR", OTHER_COORDINATOR], ["EVENT_ORGANISER", OWNER], ["VENUE_STAFF", STAFF]] as const) {
      signedInAs(role, userId);
      const res = await withdraw(id);
      expect(res.status, role).toBe(403);
      expect(res.body.error.code).toBe("ROLE_NOT_AUTHORISED");
    }
    const [row] = await sql<{ status: string; withdrawn_by: string | null }[]>`select status, withdrawn_by from venue.booking_requests where id = ${id}`;
    expect(row).toEqual({ status: "PENDING", withdrawn_by: null });
  });

  it("refuses a request that isn't pending, naming its status, and an unknown one (L2-T3)", async () => {
    const { id, reference } = await pending();
    for (const [status, label] of [["APPROVED", "Approved"], ["REJECTED", "Rejected"]]) {
      await sql`update venue.booking_requests set status = ${status} where id = ${id}`;
      const res = await withdraw(id);
      expect(res.status, status).toBe(409);
      expect(res.body.error).toMatchObject({
        code: "BOOKING_REQUEST_NOT_PENDING",
        message: `${reference} is ${label}, so it can't be withdrawn. Only a pending request can be.`,
      });
    }
    await sql`update venue.booking_requests set status = 'PENDING' where id = ${id}`;
    expect((await withdraw(id)).status).toBe(200);
    expect((await withdraw(id)).body.error.message).toContain("is Withdrawn");

    for (const unknown of [randomUUID(), "not-a-request"]) {
      const res = await withdraw(unknown);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("BOOKING_REQUEST_NOT_FOUND");
    }
  });

  it("takes the request off the Venue Staff queue and the calendar (L2-T4, L2-T5)", async () => {
    const { id, reference, venueId } = await pending();
    await withdraw(id);

    signedInAs("VENUE_STAFF", STAFF);
    expect((await queue()).body.items.map((item: { reference: string }) => item.reference)).not.toContain(reference);
    const calendar = await request(app).get(`/api/v1/venues/${venueId}/availability`).query({ from: "2026-12-02", to: "2026-12-02" }).set(bearer);
    expect(calendar.body.days[0].committed.some((p: { kind: string }) => p.kind === "BOOKING")).toBe(false);
  });

  it("leaves the event untouched: its status and its version (L2-T6)", async () => {
    const { id, event } = await pending();
    const [before] = await sql`select status, version from event.events where id = ${event.id}`;

    await withdraw(id);

    const [after] = await sql`select status, version from event.events where id = ${event.id}`;
    expect(after).toEqual(before);
  });
});
