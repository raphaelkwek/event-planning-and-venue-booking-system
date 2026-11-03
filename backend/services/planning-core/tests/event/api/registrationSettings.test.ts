import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { parseCloudEvent } from "@connectsphere/contracts";
import { testDb } from "../../support/testDb.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";

/**
 * R2, R4 — PUT /api/v1/events/:id/registration-settings: the owning organiser
 * sets the registration window (R2) and the withdrawal deadline (R4), carrying
 * the version they loaded. A save writes the settings, a history entry per
 * changed setting and the event's `event.listing-changed` message in one
 * transaction; every refusal stores nothing.
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

const { resolveCurrentUser, resolveEventsScope } = await import("../../../src/modules/event/auth/identity.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
const OWNER = "a7777777-0000-0000-0000-000000000211";
const OTHER_ORGANISER = "a7777777-0000-0000-0000-000000000212";
const COORDINATOR = "a7777777-0000-0000-0000-000000000213";
const bearer = { Authorization: "Bearer test-token" };
// The seeded event starts four hours before this end: 2030-01-01T08:00:00.000Z.
const ENDS = new Date("2030-01-01T12:00:00.000Z");
const START = "2030-01-01T08:00:00.000Z";

const settings = {
  registrationRequired: true,
  registrationOpensAt: "2029-12-01T01:00:00.000Z",
  registrationClosesAt: "2029-12-31T10:00:00.000Z",
  withdrawalDeadlineAt: "2030-01-01T06:00:00.000Z",
};

function signedInAs(userId: string, role: string) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "user@connectsphere.test", role: role as never });
  vi.mocked(resolveEventsScope).mockResolvedValue(
    role === "EVENT_ORGANISER" ? { scopeType: "OWNED_BY_USER", userId } : { scopeType: "ALL" },
  );
}

beforeEach(async () => {
  await deleteSeededEvents(sql, [OWNER]);
});

afterAll(async () => {
  await deleteSeededEvents(sql, [OWNER]);
  await sql.end();
});

function put(id: string, body: unknown, ifMatch: string | null = '"1"') {
  const req = request(app).put(`/api/v1/events/${id}/registration-settings`).set(bearer);
  if (ifMatch !== null) req.set("If-Match", ifMatch);
  return req.send(body as object);
}

async function stored(id: string) {
  const [row] = await sql<
    { registration_required: boolean; registration_opens_at: Date | null; registration_closes_at: Date | null; withdrawal_deadline_at: Date | null; version: number }[]
  >`
    select registration_required, registration_opens_at, registration_closes_at, withdrawal_deadline_at, version
    from event.events where id = ${id}
  `;
  return row!;
}

async function history(id: string) {
  return sql<{ field_name: string; previous_value: string | null; new_value: string | null; actor_user_id: string; triggering_action: string }[]>`
    select field_name, previous_value, new_value, actor_user_id, triggering_action
    from event.event_history where event_id = ${id} and entry_type = 'FIELD_CHANGE'
    order by field_name
  `;
}

async function listings(id: string) {
  const rows = await sql<{ envelope: unknown }[]>`
    select envelope from event.outbox where message_key = ${id} and envelope->>'type' = 'event.listing-changed' order by seq
  `;
  return rows.map((r) => parseCloudEvent(r.envelope));
}

async function nothingStored(id: string) {
  expect(await stored(id)).toMatchObject({ registration_required: false, registration_opens_at: null, withdrawal_deadline_at: null, version: 1 });
  expect(await history(id)).toEqual([]);
  expect(await listings(id)).toEqual([]);
}

describe("PUT /api/v1/events/:id/registration-settings (R2, R4)", () => {
  it("R2-T11 R4-T8 the owner sets the window and the deadline, with history and the listing message", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "APPROVED", endsAt: ENDS });
    signedInAs(OWNER, "EVENT_ORGANISER");

    const res = await put(id, settings);

    expect(res.status).toBe(200);
    expect(res.headers.etag).toBe('"2"');
    expect(res.body).toMatchObject({ ...settings, version: 2 });
    expect(await stored(id)).toMatchObject({
      registration_required: true,
      registration_opens_at: new Date(settings.registrationOpensAt),
      registration_closes_at: new Date(settings.registrationClosesAt),
      withdrawal_deadline_at: new Date(settings.withdrawalDeadlineAt),
    });
    expect((await history(id)).map((h) => [h.field_name, h.previous_value, h.new_value, h.actor_user_id, h.triggering_action])).toEqual([
      ["registrationClosesAt", null, settings.registrationClosesAt, OWNER, "UPDATE_REGISTRATION_SETTINGS"],
      ["registrationOpensAt", null, settings.registrationOpensAt, OWNER, "UPDATE_REGISTRATION_SETTINGS"],
      ["registrationRequired", "false", "true", OWNER, "UPDATE_REGISTRATION_SETTINGS"],
      ["withdrawalDeadlineAt", null, settings.withdrawalDeadlineAt, OWNER, "UPDATE_REGISTRATION_SETTINGS"],
    ]);
    const [message, ...rest] = await listings(id);
    expect(rest).toEqual([]);
    expect(message!.actor).toBe(`EVENT_ORGANISER:${OWNER}`);
    expect(message!.data).toMatchObject({ eventId: id, status: "APPROVED", proposedStartAt: START, ...settings });
  });

  it("R4-T8 clearing the deadline saves no deadline, so withdrawal is allowed until the start", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: ENDS });
    signedInAs(OWNER, "EVENT_ORGANISER");
    expect((await put(id, settings)).status).toBe(200);

    const res = await put(id, { ...settings, withdrawalDeadlineAt: null }, '"2"');

    expect(res.status).toBe(200);
    expect((await stored(id)).withdrawal_deadline_at).toBeNull();
    expect((await listings(id)).at(-1)!.data).toMatchObject({ withdrawalDeadlineAt: null });
  });

  it("R4-T8 a deadline after the event start is refused, naming the field; nothing is stored", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "APPROVED", endsAt: ENDS });
    signedInAs(OWNER, "EVENT_ORGANISER");

    const res = await put(id, { ...settings, withdrawalDeadlineAt: "2030-01-01T09:00:00.000Z" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: "VALIDATION_FAILED",
      fields: [{ field: "withdrawalDeadlineAt", message: "The withdrawal deadline must be no later than the event start." }],
    });
    await nothingStored(id);
  });

  it("R2-T11 a closing before the opening is refused, naming the field; nothing is stored", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "APPROVED", endsAt: ENDS });
    signedInAs(OWNER, "EVENT_ORGANISER");

    const res = await put(id, { ...settings, registrationClosesAt: "2029-11-30T01:00:00.000Z" });

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual([{ field: "registrationClosesAt", message: "Registration closing must be later than registration opening." }]);
    await nothingStored(id);
  });

  it("R2-T11 another organiser is told no such event is available, and a coordinator is refused; nothing is stored", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "APPROVED", endsAt: ENDS });

    signedInAs(OTHER_ORGANISER, "EVENT_ORGANISER");
    const other = await put(id, settings);
    signedInAs(COORDINATOR, "EVENT_COORDINATOR");
    const coordinator = await put(id, settings);

    expect(other.status).toBe(404);
    expect(other.body.error.code).toBe("EVENT_NOT_FOUND");
    expect(coordinator.status).toBe(403);
    expect(coordinator.body.error.code).toBe("ROLE_NOT_AUTHORISED");
    await nothingStored(id);
  });

  it("refuses before approval and after the event is over, naming the status", async () => {
    for (const status of ["UNDER_REVIEW", "COMPLETED"] as const) {
      const id = await seedEvent(sql, { ownerId: OWNER, status, endsAt: ENDS });
      signedInAs(OWNER, "EVENT_ORGANISER");

      const res = await put(id, settings);

      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({ code: "EVENT_NOT_EDITABLE", message: expect.stringContaining(status === "COMPLETED" ? "It is Completed." : "It is Under Review.") });
      await nothingStored(id);
    }
  });

  it("needs the version the organiser loaded, and refuses a stale one, storing nothing", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "APPROVED", endsAt: ENDS });
    signedInAs(OWNER, "EVENT_ORGANISER");

    const missing = await put(id, settings, null);
    const stale = await put(id, settings, '"7"');

    expect(missing.status).toBe(428);
    expect(missing.body.error.code).toBe("EVENT_VERSION_REQUIRED");
    expect(stale.status).toBe(412);
    expect(stale.body.error.code).toBe("EVENT_VERSION_MISMATCH");
    await nothingStored(id);
  });

  it("R1-T1 a G1 edit of the description writes the listing message too; an edit of other details does not", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "CONFIRMED", endsAt: ENDS });
    signedInAs(OWNER, "EVENT_ORGANISER");

    const purpose = await request(app).patch(`/api/v1/events/${id}`).set(bearer).set("If-Match", '"1"').send({ purpose: "A new purpose" });
    expect(await listings(id)).toEqual([]);
    const description = await request(app)
      .patch(`/api/v1/events/${id}`)
      .set(bearer)
      .set("If-Match", '"2"')
      .send({ description: "A one-day symposium, now with a panel." });

    expect([purpose.status, description.status]).toEqual([200, 200]);
    const [only, ...rest] = await listings(id);
    expect(rest).toEqual([]);
    expect(only!.data).toMatchObject({ description: "A one-day symposium, now with a panel.", status: "CONFIRMED" });
  });

  it("saving the same settings again records nothing and writes no message", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "APPROVED", endsAt: ENDS });
    signedInAs(OWNER, "EVENT_ORGANISER");
    await put(id, settings);

    const again = await put(id, settings, '"2"');

    expect(again.status).toBe(200);
    expect(again.body.version).toBe(2);
    expect(await history(id)).toHaveLength(4);
    expect(await listings(id)).toHaveLength(1);
  });
});
