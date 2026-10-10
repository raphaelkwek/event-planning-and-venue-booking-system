import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";

/**
 * K1 — a venue's suitability for an event, against the venue and event schemas.
 * The venue and events are the ones FX-SUITABILITY gives the functional cases
 * (tests/K1/README.md), so a failure here and a failing card describe the same
 * thing.
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
const STAFF = "a9999999-0000-0000-0000-000000000033";
const OWNER = "a9999999-0000-0000-0000-000000000031";
const COORDINATOR = "a9999999-0000-0000-0000-000000000032";
const bearer = { Authorization: "Bearer test-token" };

function signedInAs(role: string) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: COORDINATOR, email: "user@connectsphere.test", role: role as never });
}

const open = (opensAt: string, closesAt: string) => ({ opensAt, closesAt });
const HOURS = {
  monday: open("08:00", "22:00"),
  tuesday: open("08:00", "22:00"),
  wednesday: open("08:00", "22:00"),
  thursday: open("08:00", "22:00"),
  friday: open("08:00", "22:00"),
  saturday: open("09:00", "18:00"),
  sunday: null,
};

async function cleanUp() {
  const ours = sql`select id from venue.venues where created_by = ${STAFF}`;
  await sql`delete from venue.venue_slots where venue_id in (${ours})`;
  await sql`delete from venue.venues where created_by = ${STAFF}`;
  await sql`delete from event.events where owner_id = ${OWNER}`;
}

beforeEach(cleanUp);
afterAll(async () => {
  await cleanUp();
  await sql.end();
});

async function newVenue(): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues
      (name, building, max_capacity, layouts, facilities, accessibility_features, operating_hours, created_by, updated_by)
    values ('K1 Test Hall', 'K1 Test Building', 120,
            ${sql.json([{ name: "Theatre", capacity: 120 }, { name: "Classroom", capacity: 60 }])},
            ${["Projector", "Microphone", "Livestream"]}, ${["Step-free entrance", "Hearing loop"]},
            ${sql.json(HOURS)}, ${STAFF}, ${STAFF})
    returning id
  `;
  return row!.id;
}

/** A Singapore time on a December 2026 day. */
const at = (day: number, hhmm: string) => `2026-12-${String(day).padStart(2, "0")}T${hhmm}:00+08:00`;

interface EventFields {
  attendance?: number;
  venueRequirements?: Record<string, unknown> | null;
  accessibilityNeeds?: string | null;
  start?: string | null;
  end?: string | null;
}

async function newEvent(fields: EventFields = {}): Promise<{ id: string; reference: string }> {
  const { attendance = 100, venueRequirements = { layout: "Theatre", facilities: ["Projector"] } } = fields;
  const accessibilityNeeds = fields.accessibilityNeeds === undefined ? "Hearing loop" : fields.accessibilityNeeds;
  const start = fields.start === undefined ? at(7, "10:00") : fields.start;
  const end = fields.end === undefined ? at(7, "12:00") : fields.end;
  const [row] = await sql<{ id: string; reference: string }[]>`
    insert into event.events (
      reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
      expected_attendance, venue_requirements, accessibility_needs, equipment_required,
      registration_required, status, submitted_at, last_saved_at, created_by, updated_by
    ) values (
      'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'), ${OWNER}, 'K1 test event', 'K1 test',
      'K1 test', ${start}, ${end}, ${attendance},
      ${venueRequirements === null ? null : sql.json(venueRequirements as never)}, ${accessibilityNeeds},
      false, false, 'PLANNING', now(), now(), ${OWNER}, ${OWNER}
    )
    returning id, reference
  `;
  return row!;
}

const suitability = (venueId: string, eventId: string) =>
  request(app).get(`/api/v1/venues/${venueId}/suitability`).query({ eventId }).set(bearer);

describe("GET /api/v1/venues/:id/suitability", () => {
  it("is Suitable, with no reasons, when the event meets every requirement (K1-T1)", async () => {
    const venueId = await newVenue();
    const event = await newEvent();
    signedInAs("EVENT_COORDINATOR");

    const res = await suitability(venueId, event.id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ venueId, eventId: event.id, eventReference: event.reference, status: "SUITABLE", reasons: [], warnings: [] });
  });

  it("lists attendance 150 against layout capacity 120 as the one reason (K1-T2)", async () => {
    const venueId = await newVenue();
    const event = await newEvent({ attendance: 150 });
    signedInAs("EVENT_COORDINATOR");

    const res = await suitability(venueId, event.id);

    expect(res.body.status).toBe("NOT_SUITABLE");
    expect(res.body.reasons).toHaveLength(1);
    expect(res.body.reasons[0]).toMatchObject({ condition: "LAYOUT_CAPACITY", required: 150, available: 120 });
  });

  it("treats attendance equal to capacity as suitable and one over as not (K1-T3)", async () => {
    const venueId = await newVenue();
    const exact = await newEvent({ attendance: 120 });
    const over = await newEvent({ attendance: 121 });
    signedInAs("EVENT_COORDINATOR");

    expect((await suitability(venueId, exact.id)).body.status).toBe("SUITABLE");
    expect((await suitability(venueId, over.id)).body).toMatchObject({ status: "NOT_SUITABLE", reasons: [{ required: 121, available: 120 }] });
  });

  it("names the absent facility and what the venue offers, and nothing else (K1-T4)", async () => {
    const venueId = await newVenue();
    const event = await newEvent({ venueRequirements: { layout: "Theatre", facilities: ["Projector", "Simultaneous interpretation"] } });
    signedInAs("EVENT_COORDINATOR");

    const res = await suitability(venueId, event.id);

    expect(res.body.status).toBe("NOT_SUITABLE");
    expect(res.body.reasons).toMatchObject([
      { condition: "FACILITIES", missing: ["Simultaneous interpretation"], available: ["Projector", "Microphone", "Livestream"] },
    ]);
  });

  it("names the absent accessibility feature and what the venue offers, and nothing else (K1-T5)", async () => {
    const venueId = await newVenue();
    const event = await newEvent({ accessibilityNeeds: "Hearing loop\nBraille signage" });
    signedInAs("EVENT_COORDINATOR");

    const res = await suitability(venueId, event.id);

    expect(res.body.status).toBe("NOT_SUITABLE");
    expect(res.body.reasons).toMatchObject([
      { condition: "ACCESSIBILITY", missing: ["Braille signage"], available: ["Step-free entrance", "Hearing loop"] },
    ]);
  });

  it("fails a period starting before opening, one ending after closing, and one on a closed day (K1-T6)", async () => {
    const venueId = await newVenue();
    const early = await newEvent({ start: at(7, "07:30"), end: at(7, "10:00") });
    const late = await newEvent({ start: at(7, "20:00"), end: at(7, "22:30") });
    const sunday = await newEvent({ start: at(13, "10:00"), end: at(13, "12:00") });
    signedInAs("EVENT_COORDINATOR");

    expect((await suitability(venueId, early.id)).body.reasons).toMatchObject([
      { condition: "OPERATING_HOURS", required: "2026-12-07 07:30–10:00", available: "Monday 08:00–22:00" },
    ]);
    expect((await suitability(venueId, late.id)).body.reasons).toMatchObject([
      { condition: "OPERATING_HOURS", required: "2026-12-07 20:00–22:30", available: "Monday 08:00–22:00" },
    ]);
    expect((await suitability(venueId, sunday.id)).body.reasons).toMatchObject([
      { condition: "OPERATING_HOURS", available: "Sunday closed" },
    ]);
  });

  it("accepts a period that touches opening and closing time, and refuses one minute outside (K1-T7)", async () => {
    const venueId = await newVenue();
    const edges = await newEvent({ start: at(12, "09:00"), end: at(12, "18:00") });
    const early = await newEvent({ start: at(12, "08:59"), end: at(12, "18:00") });
    const late = await newEvent({ start: at(12, "09:00"), end: at(12, "18:01") });
    signedInAs("EVENT_COORDINATOR");

    expect((await suitability(venueId, edges.id)).body.status).toBe("SUITABLE");
    expect((await suitability(venueId, early.id)).body.status).toBe("NOT_SUITABLE");
    expect((await suitability(venueId, late.id)).body.status).toBe("NOT_SUITABLE");
  });

  it("lists every failing condition separately (K1-T8)", async () => {
    const venueId = await newVenue();
    const event = await newEvent({
      attendance: 150,
      venueRequirements: { layout: "Theatre", facilities: ["Simultaneous interpretation"] },
      accessibilityNeeds: "Braille signage",
      start: at(7, "07:00"),
      end: at(7, "09:00"),
    });
    signedInAs("EVENT_COORDINATOR");

    const res = await suitability(venueId, event.id);

    expect(res.body.reasons.map((reason: { condition: string }) => reason.condition)).toEqual([
      "LAYOUT_CAPACITY",
      "FACILITIES",
      "ACCESSIBILITY",
      "OPERATING_HOURS",
    ]);
  });

  it("is Suitable with warnings when the event records no layout or period, not a failure (K1-T11)", async () => {
    const venueId = await newVenue();
    const noLayout = await newEvent({ venueRequirements: { facilities: ["Projector"] } });
    const noPeriod = await newEvent({ start: null, end: null });
    const oddLayout = await newEvent({ venueRequirements: { layout: "Banquet", facilities: [] } });
    signedInAs("EVENT_COORDINATOR");

    for (const [event, condition] of [
      [noLayout, "LAYOUT_CAPACITY"],
      [noPeriod, "OPERATING_HOURS"],
      [oddLayout, "LAYOUT_CAPACITY"],
    ] as const) {
      const res = await suitability(venueId, event.id);
      expect(res.body).toMatchObject({ status: "SUITABLE_WITH_WARNINGS", reasons: [], warnings: [{ condition }] });
    }

    const warnAndFail = await newEvent({ venueRequirements: { facilities: ["Projector", "Simultaneous interpretation"] } });
    const mixed = await suitability(venueId, warnAndFail.id);
    expect(mixed.body).toMatchObject({
      status: "NOT_SUITABLE",
      reasons: [{ condition: "FACILITIES" }],
      warnings: [{ condition: "LAYOUT_CAPACITY" }],
    });
  });

  it("creates and changes nothing: the venue's slots and the event are the same afterwards (K1-T10)", async () => {
    const venueId = await newVenue();
    const event = await newEvent({ attendance: 150 });
    signedInAs("EVENT_COORDINATOR");
    const before = await sql`select * from event.events where id = ${event.id}`;

    await suitability(venueId, event.id);

    const after = await sql`select * from event.events where id = ${event.id}`;
    const [{ count }] = await sql<{ count: number }[]>`select count(*)::int as count from venue.venue_slots where venue_id = ${venueId}`;
    expect(count).toBe(0);
    expect(after).toEqual(before);
  });

  it.each(["EVENT_ORGANISER", "VENUE_STAFF", "TECH_SUPPORT_STAFF", "ATTENDEE"])("refuses %s (K1-T12)", async (role) => {
    const venueId = await newVenue();
    const event = await newEvent();
    signedInAs(role);

    const res = await suitability(venueId, event.id);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ROLE_NOT_AUTHORISED");
    expect(res.body.status).toBeUndefined();
  });

  it("answers 404 for an unknown venue or event, and 400 for a missing event id", async () => {
    const venueId = await newVenue();
    const event = await newEvent();
    const unknown = "b0000000-0000-4000-8000-000000000000";
    signedInAs("EVENT_COORDINATOR");

    expect((await suitability(unknown, event.id)).body.error.code).toBe("VENUE_NOT_FOUND");
    expect((await suitability(venueId, unknown)).body.error.code).toBe("EVENT_NOT_FOUND");
    expect((await request(app).get(`/api/v1/venues/${venueId}/suitability`).set(bearer)).status).toBe(400);
  });
});
