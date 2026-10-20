import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";

/**
 * H1 — maintain venue records, against the venue schema. Every acceptance
 * criterion H1 owns has a test here; tests/H1 holds the functional cases.
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
const STAFF = "a9999999-0000-0000-0000-000000000003";
const OTHER_STAFF = "a9999999-0000-0000-0000-000000000013";
const COORDINATOR = "a9999999-0000-0000-0000-000000000002";
const bearer = { Authorization: "Bearer test-token" };

function signedInAs(userId: string, role: string) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "user@connectsphere.test", role: role as never });
}

const open = (opensAt: string, closesAt: string) => ({ opensAt, closesAt });

function standardVenue() {
  return {
    name: "H1 Test Auditorium",
    building: "School of Computing, Level 1",
    maxCapacity: 300,
    layouts: [
      { name: "Theatre", capacity: 300 },
      { name: "Classroom", capacity: 120 },
      { name: "Banquet", capacity: 180 },
    ],
    facilities: ["Projector", "Wireless microphones", "Stage lighting"],
    accessibilityFeatures: ["Step-free access", "Hearing loop", "Accessible toilet"],
    operatingHours: {
      monday: open("08:00", "22:00"),
      tuesday: open("08:00", "22:00"),
      wednesday: open("08:00", "22:00"),
      thursday: open("08:00", "22:00"),
      friday: open("08:00", "22:00"),
      saturday: open("09:00", "18:00"),
      sunday: null,
    },
  };
}

async function cleanUp() {
  const ours = sql`select id from venue.venues where created_by in ${sql([STAFF, OTHER_STAFF])}`;
  await sql`delete from venue.venue_history where venue_id in (${ours})`;
  await sql`delete from venue.venue_staff where venue_id in (${ours})`;
  await sql`delete from venue.venues where created_by in ${sql([STAFF, OTHER_STAFF])}`;
}

beforeEach(cleanUp);
afterAll(async () => {
  await cleanUp();
  await sql.end();
});

async function createAsStaff(body: object = standardVenue()) {
  signedInAs(STAFF, "VENUE_STAFF");
  const res = await request(app).post("/api/v1/venues").set(bearer).send(body);
  expect(res.status).toBe(201);
  return res.body;
}

async function history(venueId: string) {
  return sql`select action, changes, actor_user_id, actor_role, occurred_at from venue.venue_history where venue_id = ${venueId} order by occurred_at, action`;
}

describe("POST /api/v1/venues (H1)", () => {
  it("lets Venue Staff create a venue holding every catalogue attribute", async () => {
    const venue = await createAsStaff();
    expect(venue).toMatchObject({ ...standardVenue(), isActive: true });
    expect(venue.id).toMatch(/^[0-9a-f-]{36}$/);

    signedInAs(COORDINATOR, "EVENT_COORDINATOR");
    const read = await request(app).get(`/api/v1/venues/${venue.id}`).set(bearer);
    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({ ...standardVenue(), isActive: true, createdBy: STAFF });
  });

  it("records the creation with the acting user, the timestamp and the values", async () => {
    const venue = await createAsStaff();
    const [created] = await history(venue.id);
    expect(created).toMatchObject({ action: "CREATED", actor_user_id: STAFF, actor_role: "VENUE_STAFF" });
    expect(created!.occurred_at).toBeInstanceOf(Date);
    expect(created!.changes.maxCapacity).toEqual({ previous: null, new: 300 });
  });

  it("records the creating Venue Staff member as looking after the venue", async () => {
    const venue = await createAsStaff();
    const staff = await sql`select user_id from venue.venue_staff where venue_id = ${venue.id}`;
    expect(staff.map((s) => s.user_id)).toEqual([STAFF]);
  });

  it("refuses a maximum capacity of 0, naming the field, and stores nothing", async () => {
    signedInAs(STAFF, "VENUE_STAFF");
    const res = await request(app).post("/api/v1/venues").set(bearer).send({ ...standardVenue(), maxCapacity: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: "VALIDATION_FAILED",
      fields: [{ field: "maxCapacity", message: "Maximum capacity must be a whole number greater than zero." }],
    });
    expect(await sql`select 1 from venue.venues where created_by = ${STAFF}`).toHaveLength(0);
  });

  it("refuses a body of the wrong shape with the same field-level refusal", async () => {
    signedInAs(STAFF, "VENUE_STAFF");
    const res = await request(app).post("/api/v1/venues").set(bearer).send({ ...standardVenue(), maxCapacity: "lots" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.fields.map((f: { field: string }) => f.field)).toContain("maxCapacity");
  });

  it.each(["EVENT_ORGANISER", "EVENT_COORDINATOR", "TECH_SUPPORT_STAFF", "ATTENDEE"])(
    "refuses %s and stores nothing",
    async (role) => {
      signedInAs(STAFF, role);
      const res = await request(app).post("/api/v1/venues").set(bearer).send(standardVenue());
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ROLE_NOT_AUTHORISED");
      expect(await sql`select 1 from venue.venues where created_by = ${STAFF}`).toHaveLength(0);
    },
  );
});

describe("PUT /api/v1/venues/:id (H1)", () => {
  it("lets any Venue Staff member update a venue, recording only the changed fields with their previous values", async () => {
    const venue = await createAsStaff();
    signedInAs(OTHER_STAFF, "VENUE_STAFF");
    const facilities = [...standardVenue().facilities, "Livestream camera"];
    const res = await request(app)
      .put(`/api/v1/venues/${venue.id}`)
      .set(bearer)
      .send({ ...standardVenue(), maxCapacity: 320, facilities, isActive: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ maxCapacity: 320, facilities, updatedBy: OTHER_STAFF });
    const [, updated] = await history(venue.id);
    expect(updated).toMatchObject({
      action: "UPDATED",
      actor_user_id: OTHER_STAFF,
      changes: {
        maxCapacity: { previous: 300, new: 320 },
        facilities: { previous: standardVenue().facilities, new: facilities },
      },
    });
    expect(Object.keys(updated!.changes)).toEqual(expect.arrayContaining(["maxCapacity", "facilities"]));
    expect(Object.keys(updated!.changes)).toHaveLength(2);
  });

  it("writes no history entry when nothing changed", async () => {
    const venue = await createAsStaff();
    const res = await request(app).put(`/api/v1/venues/${venue.id}`).set(bearer).send({ ...standardVenue(), isActive: true });
    expect(res.status).toBe(200);
    expect(await history(venue.id)).toHaveLength(1);
  });

  it("leaves every stored field unchanged when the update is refused", async () => {
    const venue = await createAsStaff();
    const res = await request(app)
      .put(`/api/v1/venues/${venue.id}`)
      .set(bearer)
      .send({ ...standardVenue(), name: "Renamed Auditorium", maxCapacity: 0, isActive: true });
    expect(res.status).toBe(400);

    signedInAs(COORDINATOR, "EVENT_COORDINATOR");
    const read = await request(app).get(`/api/v1/venues/${venue.id}`).set(bearer);
    expect(read.body).toMatchObject({ name: "H1 Test Auditorium", maxCapacity: 300 });
    expect(await history(venue.id)).toHaveLength(1);
  });

  it.each(["EVENT_COORDINATOR", "TECH_SUPPORT_STAFF", "EVENT_ORGANISER"])(
    "refuses an update by %s and changes nothing",
    async (role) => {
      const venue = await createAsStaff();
      signedInAs(COORDINATOR, role);
      const res = await request(app)
        .put(`/api/v1/venues/${venue.id}`)
        .set(bearer)
        .send({ ...standardVenue(), name: "Renamed by someone else", isActive: true });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ROLE_NOT_AUTHORISED");
      const [row] = await sql`select name from venue.venues where id = ${venue.id}`;
      expect(row!.name).toBe("H1 Test Auditorium");
    },
  );

  it("marks a venue inactive, keeping the record and recording the change", async () => {
    const venue = await createAsStaff();
    const res = await request(app).put(`/api/v1/venues/${venue.id}`).set(bearer).send({ ...standardVenue(), isActive: false });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ...standardVenue(), isActive: false });
    const [, updated] = await history(venue.id);
    expect(updated!.changes).toEqual({ isActive: { previous: true, new: false } });
  });

  it("keeps the venue's active state when the update does not mention it", async () => {
    const venue = await createAsStaff();
    await request(app).put(`/api/v1/venues/${venue.id}`).set(bearer).send({ ...standardVenue(), isActive: false });
    const res = await request(app).put(`/api/v1/venues/${venue.id}`).set(bearer).send({ ...standardVenue(), maxCapacity: 310 });
    expect(res.body.isActive).toBe(false);
  });

  it.each(["00000000-0000-0000-0000-00000000dead", "not-a-uuid"])("answers 404 for a venue that does not exist (%s)", async (id) => {
    signedInAs(STAFF, "VENUE_STAFF");
    const res = await request(app).put(`/api/v1/venues/${id}`).set(bearer).send({ ...standardVenue(), isActive: true });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("VENUE_NOT_FOUND");
  });
});

describe("GET /api/v1/venues (H1 read access)", () => {
  it.each(["EVENT_ORGANISER", "EVENT_COORDINATOR", "VENUE_STAFF", "TECH_SUPPORT_STAFF"])(
    "lists venues, active and inactive, for %s",
    async (role) => {
      const venue = await createAsStaff();
      signedInAs(COORDINATOR, role);
      const res = await request(app).get("/api/v1/venues").set(bearer);
      expect(res.status).toBe(200);
      expect(res.body.items).toContainEqual({
        id: venue.id,
        name: "H1 Test Auditorium",
        building: "School of Computing, Level 1",
        maxCapacity: 300,
        isActive: true,
      });
    },
  );

  it("refuses an attendee the catalogue (H2)", async () => {
    signedInAs(COORDINATOR, "ATTENDEE");
    expect((await request(app).get("/api/v1/venues").set(bearer)).status).toBe(403);
  });

  it("answers 404 for an unknown venue", async () => {
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");
    const res = await request(app).get("/api/v1/venues/00000000-0000-0000-0000-00000000dead").set(bearer);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("VENUE_NOT_FOUND");
  });
});

describe("setup and turnaround time (H3)", () => {
  it("defaults both to 0 minutes when a venue is created without them", async () => {
    const venue = await createAsStaff();
    expect(venue).toMatchObject({ setupMinutes: 0, turnaroundMinutes: 0 });
  });

  it("stores both, and records each change with its previous and new value", async () => {
    const venue = await createAsStaff();
    const res = await request(app)
      .put(`/api/v1/venues/${venue.id}`)
      .set(bearer)
      .send({ ...standardVenue(), setupMinutes: 30, turnaroundMinutes: 45 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ setupMinutes: 30, turnaroundMinutes: 45 });
    const [, updated] = await history(venue.id);
    expect(updated!.changes).toEqual({
      setupMinutes: { previous: 0, new: 30 },
      turnaroundMinutes: { previous: 0, new: 45 },
    });
  });

  it("keeps the current times when an update leaves them out", async () => {
    const venue = await createAsStaff({ ...standardVenue(), setupMinutes: 30, turnaroundMinutes: 45 });
    const res = await request(app).put(`/api/v1/venues/${venue.id}`).set(bearer).send({ ...standardVenue(), maxCapacity: 310 });
    expect(res.body).toMatchObject({ setupMinutes: 30, turnaroundMinutes: 45 });
  });

  it("refuses -1 minutes, naming the field, and stores nothing", async () => {
    const venue = await createAsStaff();
    const res = await request(app).put(`/api/v1/venues/${venue.id}`).set(bearer).send({ ...standardVenue(), setupMinutes: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual([
      { field: "setupMinutes", message: "Setup time must be a whole number of minutes, 0 or more." },
    ]);
    const [row] = await sql`select setup_minutes from venue.venues where id = ${venue.id}`;
    expect(row!.setup_minutes).toBe(0);
  });

  it("refuses an Event Coordinator's change and stores nothing", async () => {
    const venue = await createAsStaff();
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");
    const res = await request(app).put(`/api/v1/venues/${venue.id}`).set(bearer).send({ ...standardVenue(), setupMinutes: 60 });
    expect(res.status).toBe(403);
    const [row] = await sql`select setup_minutes from venue.venues where id = ${venue.id}`;
    expect(row!.setup_minutes).toBe(0);
  });
});
