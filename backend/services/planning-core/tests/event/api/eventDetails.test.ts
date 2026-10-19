import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";

/**
 * G1 — PATCH /api/v1/events/:id: the owning organiser or the assigned
 * coordinator edits an event's descriptive details, carrying the version they
 * loaded. Every refusal is checked to store nothing and write no history.
 */

vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "test-subject" };
    next();
  },
}));

vi.mock("../../../src/modules/event/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/event/auth/identity.js")>(
    "../../../src/modules/event/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn(), resolveEventsScope: vi.fn() };
});

vi.mock("../../../src/modules/event/repo/eventHistory.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/event/repo/eventHistory.js")>(
    "../../../src/modules/event/repo/eventHistory.js",
  );
  return { ...actual, recordFieldChanges: vi.fn(actual.recordFieldChanges) };
});

const { resolveCurrentUser, resolveEventsScope } = await import("../../../src/modules/event/auth/identity.js");
const { recordFieldChanges } = await import("../../../src/modules/event/repo/eventHistory.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
const OWNER = "a7777777-0000-0000-0000-000000000111";
const OTHER_ORGANISER = "a7777777-0000-0000-0000-000000000112";
const ASSIGNED = "a7777777-0000-0000-0000-000000000113";
const UNASSIGNED = "a7777777-0000-0000-0000-000000000114";
const STAFF = "a7777777-0000-0000-0000-000000000115";
const bearer = { Authorization: "Bearer test-token" };
const FAR_FUTURE = new Date("2030-01-01T12:00:00.000Z");

function signedInAs(userId: string, role: string) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "user@connectsphere.test", role: role as never });
  vi.mocked(resolveEventsScope).mockResolvedValue(
    role === "EVENT_COORDINATOR"
      ? { scopeType: "ALL" }
      : role === "EVENT_ORGANISER"
        ? { scopeType: "OWNED_BY_USER", userId }
        : { scopeType: "NONE" },
  );
}

beforeEach(async () => {
  await deleteSeededEvents(sql, [OWNER]);
});

afterAll(async () => {
  await deleteSeededEvents(sql, [OWNER]);
  await sql.end();
});

/** An event at `status`, owned by OWNER, with ASSIGNED as its active coordinator. */
async function seed(status = "APPROVED"): Promise<string> {
  const id = await seedEvent(sql, { ownerId: OWNER, status: status as never, endsAt: FAR_FUTURE });
  await sql`
    insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
    values (${id}, ${ASSIGNED}, 'TEST', ${ASSIGNED}, ${ASSIGNED})
  `;
  return id;
}

async function stored(id: string) {
  const [row] = await sql<{ purpose: string; description: string; accessibility_needs: string | null; contact_details: string | null; expected_attendance: number; version: number }[]>`
    select purpose, description, accessibility_needs, contact_details, expected_attendance, version
    from event.events where id = ${id}
  `;
  return row!;
}

async function fieldHistory(id: string) {
  return sql<{ field_name: string; previous_value: string | null; new_value: string | null; actor_user_id: string; actor_role: string; triggering_action: string; occurred_at: Date }[]>`
    select field_name, previous_value, new_value, actor_user_id, actor_role, triggering_action, occurred_at
    from event.event_history where event_id = ${id} and entry_type = 'FIELD_CHANGE'
    order by field_name
  `;
}

function patch(id: string, body: unknown, ifMatch?: string) {
  const req = request(app).patch(`/api/v1/events/${id}`).set(bearer);
  if (ifMatch !== undefined) req.set("If-Match", ifMatch);
  return req.send(body as object);
}

const SEEDED = { purpose: "Seeded for a test", description: "Seeded for a test", accessibility_needs: null, contact_details: null };

describe("PATCH /api/v1/events/:id (G1)", () => {
  it("lets the owning organiser edit the four descriptive fields, recording each change (G1-T1, G1-T7)", async () => {
    const id = await seed();
    signedInAs(OWNER, "EVENT_ORGANISER");

    const read = await request(app).get(`/api/v1/events/${id}`).set(bearer);
    expect(read.headers.etag).toBe('"1"');
    expect(read.body).toMatchObject({ version: 1, contactDetails: null });

    const before = Date.now();
    const res = await patch(
      id,
      {
        purpose: "Share faculty research with industry partners",
        description: "A one-day symposium, with an industry panel.",
        accessibilityNeeds: "Step-free access to the stage",
        contactDetails: "Dr Mei Lin Tan, meilin.tan@smu.edu.sg",
      },
      read.headers.etag,
    );

    expect(res.status).toBe(200);
    expect(res.headers.etag).toBe('"2"');
    expect(res.body).toMatchObject({
      id,
      status: "APPROVED",
      purpose: "Share faculty research with industry partners",
      contactDetails: "Dr Mei Lin Tan, meilin.tan@smu.edu.sg",
      version: 2,
    });
    expect(await stored(id)).toMatchObject({ accessibility_needs: "Step-free access to the stage", expected_attendance: 150, version: 2 });

    const history = await fieldHistory(id);
    expect(history.map((h) => [h.field_name, h.previous_value, h.new_value])).toEqual([
      ["accessibilityNeeds", null, "Step-free access to the stage"],
      ["contactDetails", null, "Dr Mei Lin Tan, meilin.tan@smu.edu.sg"],
      ["description", "Seeded for a test", "A one-day symposium, with an industry panel."],
      ["purpose", "Seeded for a test", "Share faculty research with industry partners"],
    ]);
    for (const entry of history) {
      expect(entry).toMatchObject({ actor_user_id: OWNER, actor_role: "EVENT_ORGANISER", triggering_action: "UPDATE_DETAILS" });
      expect(entry.occurred_at.getTime()).toBeGreaterThanOrEqual(before - 5000);
    }
  });

  it("lets the assigned coordinator edit, and records only the fields that changed (G1-T2, G1-T7)", async () => {
    const id = await seed();
    signedInAs(ASSIGNED, "EVENT_COORDINATOR");

    const res = await patch(id, { description: "A one-day symposium with a poster session.", purpose: "Seeded for a test" }, '"1"');

    expect(res.status).toBe(200);
    expect((await fieldHistory(id)).map((h) => [h.field_name, h.actor_user_id, h.actor_role])).toEqual([
      ["description", ASSIGNED, "EVENT_COORDINATOR"],
    ]);
  });

  it("edits in Approved, Planning, Safety Review and Confirmed (G1-T3)", async () => {
    signedInAs(OWNER, "EVENT_ORGANISER");
    for (const status of ["APPROVED", "PLANNING", "SAFETY_REVIEW", "CONFIRMED"]) {
      const id = await seed(status);
      const res = await patch(id, { purpose: `${status} purpose` }, '"1"');
      expect(res.status, status).toBe(200);
      expect(res.body.status).toBe(status);
    }
  });

  it("refuses an event before approval or after it ends, naming its status, and stores nothing (G1-T4)", async () => {
    signedInAs(OWNER, "EVENT_ORGANISER");
    for (const [status, label] of [["UNDER_REVIEW", "Under Review"], ["SUBMITTED", "Submitted"], ["COMPLETED", "Completed"], ["CANCELLED", "Cancelled"]]) {
      const id = await seed(status);
      const res = await patch(id, { purpose: "Too early or too late" }, '"1"');
      expect(res.status, status).toBe(409);
      expect(res.body.error).toMatchObject({
        code: "EVENT_NOT_EDITABLE",
        message: `Details can be edited only while the event is Approved, Planning, Safety Review or Confirmed. It is ${label}.`,
      });
      expect(await stored(id)).toMatchObject({ purpose: SEEDED.purpose, version: 1 });
      expect(await fieldHistory(id)).toEqual([]);
    }
  });

  it("refuses an edit that includes a significant field, naming each, and stores nothing (G1-T6)", async () => {
    const id = await seed();
    signedInAs(OWNER, "EVENT_ORGANISER");

    const res = await patch(id, { purpose: "Sneaked in", expectedAttendance: 400, proposedStartAt: "2026-12-03T06:00:00Z" }, '"1"');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("CHANGE_REQUEST_REQUIRED");
    expect(res.body.error.message).toMatch(/only through a change request/);
    expect(res.body.error.fields.map((f: { field: string }) => f.field)).toEqual(["expectedAttendance", "proposedStartAt"]);
    expect(await stored(id)).toMatchObject({ purpose: SEEDED.purpose, expected_attendance: 150, version: 1 });
    expect(await fieldHistory(id)).toEqual([]);
  });

  it("refuses anyone but the owner or the assigned coordinator, and stores nothing (G1-T8, G1-T9)", async () => {
    const id = await seed();

    signedInAs(UNASSIGNED, "EVENT_COORDINATOR");
    const unassigned = await patch(id, { purpose: "Not mine to change" }, '"1"');
    expect(unassigned.status).toBe(403);
    expect(unassigned.body.error).toMatchObject({
      code: "ROLE_NOT_AUTHORISED",
      message: "Only the owning organiser or the assigned coordinator can edit this event's details.",
    });

    signedInAs(OTHER_ORGANISER, "EVENT_ORGANISER");
    const otherOrganiser = await patch(id, { description: "Not my event" }, '"1"');
    expect(otherOrganiser.status).toBe(404);
    expect(otherOrganiser.body.error.code).toBe("EVENT_NOT_FOUND");

    signedInAs(STAFF, "VENUE_STAFF");
    expect((await patch(id, { purpose: "Venue staff" }, '"1"')).status).toBe(403);

    expect(await stored(id)).toMatchObject({ ...SEEDED, version: 1 });
    expect(await fieldHistory(id)).toEqual([]);
  });

  it("refuses the whole save when one field is invalid, changing nothing (G1-T10)", async () => {
    const id = await seed();
    signedInAs(OWNER, "EVENT_ORGANISER");

    const res = await patch(id, { description: "A new description", purpose: "   " }, '"1"');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "VALIDATION_FAILED", fields: [{ field: "purpose", message: "Purpose is required." }] });
    expect(await stored(id)).toMatchObject({ ...SEEDED, version: 1 });
    expect(await fieldHistory(id)).toEqual([]);
  });

  it("writes nothing at all when the save fails part-way (G1-T10)", async () => {
    const id = await seed();
    signedInAs(OWNER, "EVENT_ORGANISER");
    vi.mocked(recordFieldChanges).mockRejectedValueOnce(new Error("the history write failed"));

    const res = await patch(id, { purpose: "Never stored", description: "Never stored either" }, '"1"');

    expect(res.status).toBe(500);
    expect(await stored(id)).toMatchObject({ ...SEEDED, version: 1 });
    expect(await fieldHistory(id)).toEqual([]);
  });

  it("requires the version the editor loaded, and refuses a stale or unreadable one, storing nothing (G1-T11)", async () => {
    const id = await seed();
    signedInAs(OWNER, "EVENT_ORGANISER");

    const missing = await patch(id, { purpose: "No version" });
    expect(missing.status).toBe(428);
    expect(missing.body.error.code).toBe("EVENT_VERSION_REQUIRED");

    expect((await patch(id, { purpose: "First" }, '"1"')).status).toBe(200);

    for (const stale of ['"1"', '"9"', "1", "*"]) {
      const res = await patch(id, { purpose: "Stale" }, stale);
      expect(res.status, stale).toBe(412);
      expect(res.body.error).toMatchObject({
        code: "EVENT_VERSION_MISMATCH",
        message: "This event was changed after you opened it, so nothing was saved. Load the latest version, then make your edit again.",
      });
    }
    expect(await stored(id)).toMatchObject({ purpose: "First", version: 2 });
    expect((await fieldHistory(id)).map((h) => h.new_value)).toEqual(["First"]);
  });

  it("lets exactly one of two saves made from the same version through (G1-T11)", async () => {
    const id = await seed();
    signedInAs(OWNER, "EVENT_ORGANISER");

    const results = await Promise.all([
      patch(id, { description: "First of two at once" }, '"1"'),
      patch(id, { description: "Second of two at once" }, '"1"'),
    ]);
    const statuses = results.map((res) => res.status).sort();

    expect(statuses).toEqual([200, 412]);
    expect(await fieldHistory(id)).toHaveLength(1);
    expect((await stored(id)).version).toBe(2);
  });

  it("treats a status change as a change, so an edit form opened before it is stale", async () => {
    const id = await seed();
    await sql`update event.events set status = 'PLANNING' where id = ${id}`;
    signedInAs(OWNER, "EVENT_ORGANISER");

    expect((await patch(id, { purpose: "From before the status change" }, '"1"')).status).toBe(412);
    expect((await patch(id, { purpose: "After reloading" }, '"2"')).status).toBe(200);
  });

  it("stores nothing and writes no history when nothing changes (G1-T12)", async () => {
    const id = await seed();
    signedInAs(OWNER, "EVENT_ORGANISER");

    const res = await patch(id, { purpose: SEEDED.purpose, description: SEEDED.description }, '"1"');

    expect(res.status).toBe(200);
    expect(res.headers.etag).toBe('"1"');
    expect(await stored(id)).toMatchObject({ version: 1 });
    expect(await fieldHistory(id)).toEqual([]);
  });

  it("is rate limited (until the gateway's limits, ADR-0011)", async () => {
    const id = await seed();
    signedInAs(OWNER, "EVENT_ORGANISER");
    const res = await patch(id, { purpose: "Limited" }, '"1"');
    expect(res.headers["ratelimit-policy"]).toMatch(/q=120; w=60/);
  });
});
