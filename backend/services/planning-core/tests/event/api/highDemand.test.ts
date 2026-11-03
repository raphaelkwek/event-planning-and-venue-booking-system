import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { parseCloudEvent } from "@connectsphere/contracts";
import { testDb } from "../../support/testDb.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";

/**
 * EN-19 — PUT /api/v1/events/:id/high-demand: the owning organiser flags their
 * event high-demand (or takes the flag off), carrying the version they
 * loaded. A change writes the flag, a history entry and the event's
 * `event.listing-changed` message in one transaction; every refusal stores
 * nothing. CI only: it needs the event schema.
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
const OWNER = "a7777777-0000-0000-0000-000000000191";
const OTHER_ORGANISER = "a7777777-0000-0000-0000-000000000192";
const COORDINATOR = "a7777777-0000-0000-0000-000000000193";
const bearer = { Authorization: "Bearer test-token" };
const ENDS = new Date("2030-01-01T12:00:00.000Z");

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
  const req = request(app).put(`/api/v1/events/${id}/high-demand`).set(bearer);
  if (ifMatch !== null) req.set("If-Match", ifMatch);
  return req.send(body as object);
}

async function stored(id: string) {
  const [row] = await sql<{ high_demand: boolean; version: number }[]>`select high_demand, version from event.events where id = ${id}`;
  return row!;
}

async function history(id: string) {
  return sql<{ field_name: string; previous_value: string | null; new_value: string | null; actor_user_id: string; triggering_action: string }[]>`
    select field_name, previous_value, new_value, actor_user_id, triggering_action
    from event.event_history where event_id = ${id} and entry_type = 'FIELD_CHANGE' order by occurred_at
  `;
}

async function listings(id: string) {
  const rows = await sql<{ envelope: unknown }[]>`
    select envelope from event.outbox where message_key = ${id} and envelope->>'type' = 'event.listing-changed' order by seq
  `;
  return rows.map((r) => parseCloudEvent(r.envelope));
}

async function nothingStored(id: string) {
  expect(await stored(id)).toEqual({ high_demand: false, version: 1 });
  expect(await history(id)).toEqual([]);
  expect(await listings(id)).toEqual([]);
}

describe("PUT /api/v1/events/:id/high-demand (EN-19)", () => {
  it("EN-19-T1 lets the owning organiser flag and unflag an event, publishing each change on event.listing-changed", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "APPROVED", endsAt: ENDS });
    signedInAs(OWNER, "EVENT_ORGANISER");

    const flagged = await put(id, { highDemand: true });

    expect(flagged.status).toBe(200);
    expect(flagged.headers.etag).toBe('"2"');
    expect(flagged.body).toMatchObject({ id, highDemand: true, version: 2 });
    expect(await stored(id)).toEqual({ high_demand: true, version: 2 });
    expect((await history(id)).map((h) => [h.field_name, h.previous_value, h.new_value, h.actor_user_id, h.triggering_action])).toEqual([
      ["highDemand", "false", "true", OWNER, "UPDATE_HIGH_DEMAND"],
    ]);
    const [first, ...rest] = await listings(id);
    expect(rest).toEqual([]);
    expect(first!.actor).toBe(`EVENT_ORGANISER:${OWNER}`);
    expect(first!.data).toMatchObject({ eventId: id, status: "APPROVED", highDemand: true });

    const same = await put(id, { highDemand: true }, '"2"');
    expect(same.status).toBe(200);
    expect(await stored(id)).toEqual({ high_demand: true, version: 2 });
    expect(await listings(id)).toHaveLength(1);

    const unflagged = await put(id, { highDemand: false }, '"2"');
    expect(unflagged.status).toBe(200);
    expect(unflagged.body).toMatchObject({ highDemand: false, version: 3 });
    expect((await listings(id)).map((m) => (m.data as { highDemand: boolean }).highDemand)).toEqual([true, false]);
    expect(await history(id)).toHaveLength(2);
  });

  it("EN-19-T2 refuses everyone but the owner, a stale or missing version, a bad value and a closed event, changing nothing", async () => {
    const id = await seedEvent(sql, { ownerId: OWNER, status: "APPROVED", endsAt: ENDS });

    signedInAs(OTHER_ORGANISER, "EVENT_ORGANISER");
    const notMine = await put(id, { highDemand: true });
    expect(notMine.status).toBe(404);
    expect(notMine.body.error.code).toBe("EVENT_NOT_FOUND");

    signedInAs(COORDINATOR, "EVENT_COORDINATOR");
    const coordinator = await put(id, { highDemand: true });
    expect(coordinator.status).toBe(403);
    expect(coordinator.body.error.code).toBe("ROLE_NOT_AUTHORISED");

    signedInAs(OWNER, "EVENT_ORGANISER");
    const stale = await put(id, { highDemand: true }, '"7"');
    expect(stale.status).toBe(412);
    expect(stale.body.error.code).toBe("EVENT_VERSION_MISMATCH");

    const noVersion = await put(id, { highDemand: true }, null);
    expect(noVersion.status).toBe(428);
    expect(noVersion.body.error.code).toBe("EVENT_VERSION_REQUIRED");

    const notBoolean = await put(id, { highDemand: "yes" });
    expect(notBoolean.status).toBe(400);
    expect(notBoolean.body.error.code).toBe("VALIDATION_FAILED");
    expect(notBoolean.body.error.fields).toEqual([{ field: "highDemand", message: expect.any(String) }]);

    const extra = await put(id, { highDemand: true, name: "x" });
    expect(extra.status).toBe(400);
    expect(extra.body.error.fields).toEqual([{ field: "name", message: expect.any(String) }]);

    const noBody = await put(id, "nonsense");
    expect(noBody.status).toBe(400);

    await nothingStored(id);

    const closed = await seedEvent(sql, { ownerId: OWNER, status: "COMPLETED", endsAt: ENDS });
    const refusedClosed = await put(closed, { highDemand: true });
    expect(refusedClosed.status).toBe(409);
    expect(refusedClosed.body.error.code).toBe("EVENT_NOT_EDITABLE");
    expect((await stored(closed)).high_demand).toBe(false);
  });
});
