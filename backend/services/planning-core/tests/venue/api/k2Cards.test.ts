import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";

/**
 * K2 — justify booking a venue flagged as unsuitable. One test per card in
 * tests/K2, against the venue and event schemas. The venue mirrors the standard
 * venue (Theatre 300, Classroom 120, Banquet 180; Monday to Friday 08:00–22:00)
 * and the event the standard request (2 December 2026, 14:00–18:00, 150).
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
const OWNER = "a9999999-0000-0000-0000-000000000051";
const COORDINATOR = "a9999999-0000-0000-0000-000000000052";
const STAFF = "a9999999-0000-0000-0000-000000000053";
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
  saturday: open("09:00", "18:00"),
  sunday: null,
};
const LAYOUTS = [
  { name: "Theatre", capacity: 300 },
  { name: "Classroom", capacity: 120 },
  { name: "Banquet", capacity: 180 },
];
const VENUE_NAME = "K2 Auditorium";

async function cleanUp() {
  const ours = sql`select id from venue.venues where created_by = ${STAFF}`;
  await sql`delete from venue.outbox where message_key in (select id::text from venue.booking_requests where venue_id in (${ours}))`;
  await sql`delete from venue.booking_requests where venue_id in (${ours})`;
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

async function newVenue(): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, facilities, accessibility_features, operating_hours, status, created_by, updated_by)
    values (${VENUE_NAME}, 'School of Computing, Level 1', 300, ${sql.json(LAYOUTS)},
            ${["Projector", "Wireless microphones", "Stage lighting"]}, ${["Step-free access", "Hearing loop", "Accessible toilet"]},
            ${sql.json(HOURS)}, 'ACTIVE', ${STAFF}, ${STAFF})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by, updated_by) values (${row!.id}, ${STAFF}, ${STAFF}, ${STAFF})`;
  return row!.id;
}

/** A Singapore time on Wednesday 2 December 2026. */
const at = (hhmm: string) => `2026-12-02T${hhmm}:00+08:00`;

async function newEvent(): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into event.events (
      reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
      expected_attendance, equipment_required, registration_required, status, submitted_at,
      last_saved_at, created_by, updated_by
    ) values (
      'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'), ${OWNER}, 'K2 test event', 'K2 test',
      'K2 test', ${at("14:00")}, ${at("18:00")}, 150, false, false, 'APPROVED', now(), now(), ${OWNER}, ${OWNER}
    )
    returning id
  `;
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
            values (${row!.id}, ${COORDINATOR}, 'TEST', ${COORDINATOR}, ${COORDINATOR})`;
  return row!.id;
}

function body(eventId: string, venueId: string, overrides: Record<string, unknown> = {}) {
  return {
    eventId,
    venueId,
    startsAt: at("14:00"),
    endsAt: at("18:00"),
    layout: "Theatre",
    expectedAttendance: 150,
    facilities: [],
    accessibilityFeatures: [],
    ...overrides,
  };
}

const submit = (payload: unknown) => request(app).post("/api/v1/booking-requests").set(bearer).send(payload as object);
const queue = () => request(app).get("/api/v1/booking-requests/queue").set(bearer);

interface StoredRow {
  suitability_status: string | null;
  suitability_reasons: unknown;
  unsuitable_justification: string | null;
  requested_by: string;
  requested_at: Date;
}
const stored = (eventId: string) => sql<StoredRow[]>`
  select suitability_status, suitability_reasons, unsuitable_justification, requested_by, requested_at
  from venue.booking_requests where event_id = ${eventId}
`;

const REFUSAL = `${VENUE_NAME} is not suitable for this request. Give a justification to request it anyway.`;
const FIELD = { field: "justification", message: "Give a justification: at least one character that isn't a space." };
const CAPACITY = {
  condition: "LAYOUT_CAPACITY",
  outcome: "FAILED",
  required: 150,
  available: 120,
  message: "Expected attendance 150 against layout capacity 120 (Classroom).",
};
const HOURS_FAILED = {
  condition: "OPERATING_HOURS",
  outcome: "FAILED",
  required: "2026-12-02 14:00–23:00",
  available: "Wednesday 08:00–22:00",
  message: "The requested period 2026-12-02 14:00–23:00 is outside Wednesday's operating hours 08:00–22:00.",
};

async function setUp() {
  const venueId = await newVenue();
  const eventId = await newEvent();
  signedInAs("EVENT_COORDINATOR", COORDINATOR);
  return { venueId, eventId };
}

describe("K2 — justify booking a venue flagged as unsuitable", () => {
  it("K2-T1 a request for a suitable venue needs no justification", async () => {
    const { venueId, eventId } = await setUp();

    const res = await submit(body(eventId, venueId));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "PENDING", suitabilityStatus: "SUITABLE", suitabilityReasons: [], justification: null });
    expect(await stored(eventId)).toMatchObject([{ suitability_status: "SUITABLE", suitability_reasons: [], unsuitable_justification: null }]);
  });

  it("K2-T2 a request for an unsuitable venue without a justification is refused and creates nothing", async () => {
    const { venueId, eventId } = await setUp();

    for (const payload of [body(eventId, venueId, { layout: "Classroom" }), body(eventId, venueId, { layout: "Classroom", justification: "" })]) {
      const res = await submit(payload);
      expect(res.status).toBe(422);
      expect(res.body.error).toMatchObject({
        code: "JUSTIFICATION_REQUIRED",
        message: REFUSAL,
        fields: [FIELD],
        details: { status: "NOT_SUITABLE", reasons: [CAPACITY] },
      });
    }
    expect(await stored(eventId)).toEqual([]);
    const messages = await sql`select 1 from venue.outbox where envelope->'data'->>'eventId' = ${eventId}`;
    expect(messages).toHaveLength(0);
  });

  it("K2-T3 a justification of spaces only is refused", async () => {
    const { venueId, eventId } = await setUp();

    const res = await submit(body(eventId, venueId, { layout: "Classroom", justification: "   " }));

    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: "JUSTIFICATION_REQUIRED", fields: [FIELD] });
    expect(await stored(eventId)).toEqual([]);
  });

  it("K2-T4 a justification of one character is accepted", async () => {
    const { venueId, eventId } = await setUp();

    const res = await submit(body(eventId, venueId, { layout: "Classroom", justification: "x" }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "PENDING", suitabilityStatus: "NOT_SUITABLE", suitabilityReasons: [CAPACITY], justification: "x" });
  });

  it("K2-T5 the justification is stored with a snapshot of the failing conditions, the coordinator and the time", async () => {
    const { venueId, eventId } = await setUp();
    const justification = "Only the auditorium has a stage; the extra 30 will stand at the back.";
    const before = Date.now();

    const res = await submit(body(eventId, venueId, { layout: "Classroom", justification }));
    expect(res.status).toBe(201);

    const [row] = await stored(eventId);
    expect(row).toMatchObject({
      suitability_status: "NOT_SUITABLE",
      suitability_reasons: [CAPACITY],
      unsuitable_justification: justification,
      requested_by: COORDINATOR,
    });
    expect(row!.requested_at.getTime()).toBeGreaterThanOrEqual(before - 5000);

    await sql`update venue.venues set layouts = ${sql.json(LAYOUTS.map((l) => (l.name === "Classroom" ? { ...l, capacity: 200 } : l)))} where id = ${venueId}`;
    const [after] = await stored(eventId);
    expect(after).toEqual(row);
  });

  it("K2-T6 Venue Staff see the justification and the failing conditions on the pending request", async () => {
    const { venueId, eventId } = await setUp();
    const justification = "Only the auditorium has a stage; the extra 30 will stand at the back.";
    const made = await submit(body(eventId, venueId, { layout: "Classroom", justification }));

    signedInAs("VENUE_STAFF", STAFF);
    const res = await queue();

    expect(res.status).toBe(200);
    expect(res.body.items.find((item: { id: string }) => item.id === made.body.id)).toMatchObject({
      suitabilityStatus: "NOT_SUITABLE",
      suitabilityReasons: [CAPACITY],
      justification,
    });
  });

  it("K2-T7 every failing condition is listed and stored", async () => {
    const { venueId, eventId } = await setUp();
    const unsuitable = body(eventId, venueId, { layout: "Classroom", endsAt: at("23:00") });

    const refused = await submit(unsuitable);
    expect(refused.status).toBe(422);
    expect(refused.body.error.details.reasons).toEqual([CAPACITY, HOURS_FAILED]);

    const res = await submit({ ...unsuitable, justification: "Evening keynote overruns; the hall staff agreed." });
    expect(res.status).toBe(201);
    expect((await stored(eventId))[0]!.suitability_reasons).toEqual([CAPACITY, HOURS_FAILED]);
  });

  it("K2-T8 attendance exactly at the layout's capacity is suitable and needs no justification", async () => {
    const { venueId, eventId } = await setUp();

    const res = await submit(body(eventId, venueId, { layout: "Classroom", expectedAttendance: 120 }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ suitabilityStatus: "SUITABLE", justification: null });
  });

  it("K2-T9 a justification sent with a suitable request is not stored", async () => {
    const { venueId, eventId } = await setUp();

    const res = await submit(body(eventId, venueId, { justification: "Just in case." }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ suitabilityStatus: "SUITABLE", suitabilityReasons: [], justification: null });
    expect(await stored(eventId)).toMatchObject([{ suitability_status: "SUITABLE", unsuitable_justification: null }]);
  });

  it("K2-T10 a request asking for a facility the venue lacks is not suitable and needs a justification", async () => {
    const { venueId, eventId } = await setUp();
    const livestream = body(eventId, venueId, { facilities: ["Projector", "Livestream"] });
    const facility = {
      condition: "FACILITIES",
      outcome: "FAILED",
      required: ["Projector", "Livestream"],
      available: ["Projector", "Wireless microphones", "Stage lighting"],
      missing: ["Livestream"],
      message: "Required facility absent: Livestream. The venue offers: Projector, Wireless microphones, Stage lighting.",
    };

    const refused = await submit(livestream);
    expect(refused.status).toBe(422);
    expect(refused.body.error).toMatchObject({ code: "JUSTIFICATION_REQUIRED", message: REFUSAL, details: { reasons: [facility] } });
    expect(await stored(eventId)).toEqual([]);

    const res = await submit({ ...livestream, justification: "Livestream crew brings their own kit." });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      suitabilityStatus: "NOT_SUITABLE",
      suitabilityReasons: [facility],
      justification: "Livestream crew brings their own kit.",
    });
  });

  it("refuses a justification that isn't text, naming the field", async () => {
    const { venueId, eventId } = await setUp();

    const res = await submit(body(eventId, venueId, { layout: "Classroom", justification: 42 }));

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual([{ field: "justification", message: "The justification must be text." }]);
  });
});

describe("K2's rule in Postgres (ADR-0006)", () => {
  async function insert(columns: { status: string | null; reasons: unknown; justification: string | null }) {
    const venueId = await newVenue();
    const eventId = await newEvent();
    return sql`
      insert into venue.booking_requests (
        event_id, venue_id, starts_at, ends_at, layout, expected_attendance, event_starts_at, event_ends_at,
        event_attendance, differs_from_event, requested_by, suitability_status, suitability_reasons, unsuitable_justification
      ) values (
        ${eventId}, ${venueId}, ${at("14:00")}, ${at("18:00")}, 'Classroom', 150, ${at("14:00")}, ${at("18:00")},
        150, false, ${COORDINATOR}, ${columns.status},
        ${columns.reasons === null ? null : sql.json(columns.reasons as never)}, ${columns.justification}
      )
    `;
  }

  it("refuses a Not suitable request without a justification that has a non-space character", async () => {
    for (const justification of [null, "", "   "]) {
      await expect(insert({ status: "NOT_SUITABLE", reasons: [CAPACITY], justification }), String(justification)).rejects.toMatchObject({
        code: "23514",
        constraint_name: "booking_requests_justification_recorded",
      });
      await cleanUp();
    }
  });

  it("refuses a Not suitable request with no failing condition, and a suitable one with a justification", async () => {
    await expect(insert({ status: "NOT_SUITABLE", reasons: [], justification: "x" })).rejects.toMatchObject({ code: "23514" });
    await cleanUp();
    await expect(insert({ status: "SUITABLE", reasons: [], justification: "x" })).rejects.toMatchObject({ code: "23514" });
    await cleanUp();
    // Both checks refuse an unknown status; Postgres names whichever it tests first.
    await expect(insert({ status: "MAYBE", reasons: [], justification: null })).rejects.toMatchObject({ code: "23514" });
  });

  it("accepts a request made before K2, with nothing assessed, and shows it as not assessed", async () => {
    await insert({ status: null, reasons: null, justification: null });
    signedInAs("VENUE_STAFF", STAFF);

    const res = await queue();

    expect(res.body.items[0]).toMatchObject({ suitabilityStatus: null, suitabilityReasons: null, justification: null });
  });
});
