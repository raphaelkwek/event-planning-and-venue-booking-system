import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";
import { deleteSeededEvents } from "../../support/seedEvent.js";
import { at, COORDINATOR, OWNER, removeSearchFixture, seedSearchFixture } from "../support/searchFixture.js";

/**
 * J1, J2 — the venue search API, against the venue and event schemas. The
 * search itself is tested against the query in tests/venue/repo; these tests
 * check what the API adds: who may search, reading and refusing the query,
 * the empty-result message, and the pre-fill from an event. tests/J1 and
 * tests/J2 hold the functional cases.
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
const bearer = { Authorization: "Bearer test-token" };

function signedInAs(role: string, userId = COORDINATOR) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "user@connectsphere.test", role: role as never });
}

beforeAll(async () => {
  await removeSearchFixture(sql);
  await seedSearchFixture(sql);
});
beforeEach(() => signedInAs("EVENT_COORDINATOR"));
afterAll(async () => {
  await deleteSeededEvents(sql, [OWNER]);
  await removeSearchFixture(sql);
  await sql.end();
});

/** GET /api/v1/venues/search, narrowed to the fixture's buildings unless the test sets its own location. */
const search = (query: Record<string, string | string[]> = {}) =>
  request(app).get("/api/v1/venues/search").query({ location: "J1T", ...query }).set(bearer);
const names = (body: { items: { name: string }[] }) => body.items.map((item) => item.name.replace("J1T ", ""));

describe("GET /api/v1/venues/search (J1, J2)", () => {
  it("lists every active venue for an empty search, with the row fields J2 shows", async () => {
    const res = await search();

    expect(res.status).toBe(200);
    expect(names(res.body)).toEqual(["Auditorium", "Late Studio", "Lecture Hall", "Seminar Room"]);
    expect(res.body.items[2]).toMatchObject({
      name: "J1T Lecture Hall",
      building: "J1T Arts Building",
      maxCapacity: 200,
      facilities: ["Projector", "Wireless microphones", "Stage lighting"],
    });
    expect(res.body.message).toBeNull();
    expect(res.body.nextCursor).toBeNull();
  });

  it("searches for part of a name or building, and applies the filters as well (J2)", async () => {
    expect(names((await search({ q: "AUDIT" })).body)).toEqual(["Auditorium"]);
    expect(names((await search({ q: "science", minCapacity: "100" })).body)).toEqual(["Auditorium"]);
  });

  it("reads repeated facility and accessibility parameters, and the date window", async () => {
    const res = await search({
      facilities: ["Projector", "Wireless microphones"],
      accessibility: ["Hearing loop"],
      from: at(16, "10:00"),
      to: at(16, "11:00"),
      layout: "Classroom",
      minCapacity: "100",
    });

    expect(names(res.body)).toEqual(["Auditorium"]);
    expect(res.body.items[0].layoutCapacity).toBe(120);
    expect(res.body.filters).toMatchObject({
      minCapacity: 100,
      layout: "Classroom",
      facilities: ["Projector", "Wireless microphones"],
      accessibility: ["Hearing loop"],
      from: "2026-12-16T02:00:00.000Z",
    });
  });

  it("answers a search that matches nothing with 200, an empty list and a message restating the filters (J1-T20)", async () => {
    const res = await search({ minCapacity: "500", layout: "Theatre", facilities: "Projector", from: at(14, "12:00"), to: at(14, "14:00") });

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.error).toBeUndefined();
    expect(res.body.message).toBe(
      'No active venue matches all of these filters: available from 2026-12-14 12:00 to 2026-12-14 14:00 (Singapore time); ' +
        'minimum capacity 500 (Theatre layout); building or location containing "J1T"; layout Theatre; facilities Projector.',
    );
    expect(res.body.appliedFilters).toHaveLength(5);
  });

  it("excludes a venue whose booking overlaps the window, and keeps one that only touches it (J1-T11, J1-T14)", async () => {
    expect(names((await search({ location: "J1T Science", from: at(14, "10:30"), to: at(14, "11:30") })).body)).toEqual(["Seminar Room"]);
    expect(names((await search({ from: at(14, "12:00"), to: at(14, "14:00") })).body)).toEqual([
      "Auditorium",
      "Late Studio",
      "Seminar Room",
    ]);
  });

  it("refuses a bad query, naming every field at fault, and searches nothing (J1-T23)", async () => {
    const res = await search({ minCapacity: "0", from: at(14, "12:00") });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.fields.map((f: { field: string }) => f.field)).toEqual(["to", "minCapacity"]);
    expect(res.body.items).toBeUndefined();

    const reversed = await search({ from: at(14, "12:00"), to: at(14, "11:00") });
    expect(reversed.body.error.fields).toEqual([{ field: "to", message: "The window must end after it starts." }]);
  });

  it.each(["EVENT_ORGANISER", "VENUE_STAFF", "TECH_SUPPORT_STAFF", "ATTENDEE"])(
    "refuses %s and returns no venues (policy action search on venue; J1-T24)",
    async (role) => {
      signedInAs(role);
      for (const path of ["/api/v1/venues/search", "/api/v1/venues/search/options", "/api/v1/venues/search/prefill?eventId=x"]) {
        const res = await request(app).get(path).set(bearer);
        expect(res.status, `${role} ${path}`).toBe(403);
        expect(res.body.error.code).toBe("ROLE_NOT_AUTHORISED");
        expect(res.body.items).toBeUndefined();
      }
    },
  );

  it("is rate limited to 120 requests a minute (until the gateway's limits, ADR-0011)", async () => {
    const res = await search();
    expect(res.headers["ratelimit-policy"]).toMatch(/q=120; w=60/);
  });

  it("is not shadowed by GET /venues/:id", async () => {
    const res = await request(app).get("/api/v1/venues/search").set(bearer);
    expect(res.status).toBe(200);
    expect(res.body.items).toBeInstanceOf(Array);
  });
});

describe("GET /api/v1/venues/search/options", () => {
  it("lists the layouts, facilities and accessibility features the active venues offer", async () => {
    const res = await request(app).get("/api/v1/venues/search/options").set(bearer);

    expect(res.status).toBe(200);
    expect(res.body.layouts).toEqual(expect.arrayContaining(["Boardroom", "Classroom", "Theatre"]));
    expect(res.body.facilities).toEqual(expect.arrayContaining(["Projector", "Stage lighting", "Wireless microphones"]));
    expect(res.body.accessibilityFeatures).toEqual(expect.arrayContaining(["Accessible toilet", "Hearing loop", "Step-free access"]));
  });
});

describe("GET /api/v1/venues/search/prefill (J1 AC8)", () => {
  async function newEvent(overrides: { requirements?: object | null; needs?: string | null; attendance?: number | null } = {}) {
    const requirements = "requirements" in overrides ? overrides.requirements : { layout: "theatre", facilities: ["projector", "Wireless microphones"] };
    const [row] = await sql<{ id: string; reference: string }[]>`
      insert into event.events (
        reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
        expected_attendance, venue_requirements, accessibility_needs, equipment_required,
        registration_required, status, submitted_at, last_saved_at, created_by, updated_by
      ) values (
        'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'), ${OWNER}, 'J1 prefill event', 'J1 test', 'J1 test',
        ${at(14, "12:00")}, ${at(14, "14:00")}, ${overrides.attendance ?? 150}, ${requirements === null ? null : sql.json(requirements as never)},
        ${"needs" in overrides ? overrides.needs! : "Step-free access, hearing LOOP, Reserved seating"},
        false, false, 'PLANNING', now(), now(), ${OWNER}, ${OWNER}
      )
      returning id, reference
    `;
    return row!;
  }
  const prefill = (eventId: string) => request(app).get("/api/v1/venues/search/prefill").query({ eventId }).set(bearer);

  it("gives the event's window, attendance, layout, facilities and matched accessibility needs, in the catalogue's spelling (J1-T21)", async () => {
    const event = await newEvent();

    const res = await prefill(event.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      eventId: event.id,
      reference: event.reference,
      filters: {
        from: "2026-12-14T04:00:00.000Z",
        to: "2026-12-14T06:00:00.000Z",
        minCapacity: 150,
        layout: "Theatre",
        facilities: ["Projector", "Wireless microphones"],
        accessibility: ["Step-free access", "Hearing loop"],
      },
      unmatchedAccessibility: ["Reserved seating"],
    });
  });

  it("fills only what the event records", async () => {
    const event = await newEvent({ requirements: null, needs: null });

    const res = await prefill(event.id);

    expect(res.body.filters).toMatchObject({ layout: null, facilities: [], accessibility: [], minCapacity: 150 });
    expect(res.body.unmatchedAccessibility).toEqual([]);
  });

  it("gives filters the search accepts back unchanged, so the pre-filled search runs (J1-T21)", async () => {
    const event = await newEvent();
    const { filters } = (await prefill(event.id)).body;

    const res = await search({
      location: "J1T",
      from: filters.from,
      to: filters.to,
      minCapacity: String(filters.minCapacity),
      layout: filters.layout,
      facilities: filters.facilities,
      accessibility: filters.accessibility,
    });

    expect(res.status).toBe(200);
    expect(names(res.body)).toEqual(["Auditorium"]);
  });

  it("refuses a missing event id, naming the field", async () => {
    const res = await request(app).get("/api/v1/venues/search/prefill").set(bearer);
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual([{ field: "eventId", message: "Enter the event's id." }]);
  });

  it("answers an event that doesn't exist, or an id that isn't one, with 404", async () => {
    for (const id of ["00000000-0000-0000-0000-00000000dead", "not-an-event"]) {
      const res = await prefill(id);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("EVENT_NOT_FOUND");
    }
  });
});
