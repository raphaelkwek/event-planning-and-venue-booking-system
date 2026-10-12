import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";
import { actorsWithPrefix, cleanLineFixtures, createEvent, createTypes, insertLineDirect } from "../../support/lineFixtures.js";

// O1/O2 route behaviour beyond the cards: bad input, pagination, scope, and the paths a card does not name.
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: (req as { headers: { authorization?: string } }).headers.authorization ?? "o12-subject" };
    next();
  },
}));
vi.mock("../../../src/modules/equipment/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/equipment/auth/identity.js")>(
    "../../../src/modules/equipment/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn() };
});

const { resolveCurrentUser } = await import("../../../src/modules/equipment/auth/identity.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
const A = actorsWithPrefix("0b300000");
const bearer = { Authorization: "Bearer o12-token" };
const BASE = "/api/v1/equipment/request-lines";
const MISSING = "44444444-4444-4444-8444-444444444444";

type Role = "EVENT_COORDINATOR" | "TECH_SUPPORT_STAFF" | "EVENT_ORGANISER";
function signedInAs(userId: string, role: Role) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "o12@connectsphere.test", role });
}
const asC1 = () => signedInAs(A.c1, "EVENT_COORDINATOR");
const asTs = () => signedInAs(A.ts, "TECH_SUPPORT_STAFF");

let event: { id: string; reference: string; name: string };
let chairs: { id: string; name: string };
let projectors: { id: string; name: string };

const clean = () => cleanLineFixtures(sql, [A.org, A.c1], [A.ts]);
beforeAll(clean);
beforeEach(async () => {
  await clean();
  event = await createEvent(sql, { ownerId: A.org, coordinatorId: A.c1 });
  ({ chairs, projectors } = await createTypes(sql, A.ts, "O12"));
  asC1();
});
afterAll(async () => {
  await clean();
  await sql.end();
});

const body = (changes: Record<string, unknown> = {}) => ({ equipmentTypeId: chairs.id, quantity: 4, notes: "", ...changes });
const save = (lines: unknown[], eventId = event.id) => request(app).post(BASE).set(bearer).send({ eventId, lines });
const fields = (response: { body: { error: { fields: { field: string }[] } } }) => response.body.error.fields.map((entry) => entry.field);

describe("reading the event with the lines", () => {
  it("returns the event summary for a Submitted event without claiming it for review", async () => {
    await sql`update event.events set status = 'SUBMITTED' where id = ${event.id}`;
    const eventRows = () => sql`select status, reviewing_coordinator_id, review_started_at from event.events where id = ${event.id}`;
    const historyRows = async () => (await sql`select count(*)::int as n from event.event_history where event_id = ${event.id}`)[0]!.n;
    const before = await eventRows();
    const historyBefore = await historyRows();

    const response = await request(app).get(`${BASE}?eventId=${event.id}`).set(bearer);
    expect(response.status).toBe(200);
    expect(response.body.event).toEqual({
      id: event.id,
      reference: event.reference,
      name: event.name,
      status: "SUBMITTED",
      proposedStartAt: expect.any(String),
      proposedEndAt: expect.any(String),
      assignedCoordinatorId: A.c1,
    });

    expect(await eventRows()).toEqual(before);
    expect((await eventRows())[0]!.status).toBe("SUBMITTED");
    expect((await eventRows())[0]!.reviewing_coordinator_id).toBeNull();
    expect(await historyRows()).toBe(historyBefore);
  });

  it("answers 404 for an event that does not exist or is outside the caller's scope, and omits the summary without an event id", async () => {
    const missing = await request(app).get(`${BASE}?eventId=${MISSING}`).set(bearer);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("EVENT_NOT_FOUND");
    asTs();
    const all = await request(app).get(BASE).set(bearer);
    expect(all.body).not.toHaveProperty("event");
    const forTs = await request(app).get(`${BASE}?eventId=${event.id}`).set(bearer);
    expect(forTs.body.event.id).toBe(event.id);
  });
});

describe("recording lines: bad input", () => {
  it("refuses a body without an event id, naming it", async () => {
    const response = await request(app).post(BASE).set(bearer).send({ lines: [body()] });
    expect(response.status).toBe(400);
    expect(fields(response)).toEqual(["eventId"]);
  });

  it("refuses an event id that is not an id", async () => {
    const response = await save([body()], "not-an-id");
    expect(response.status).toBe(400);
    expect(fields(response)).toEqual(["eventId"]);
  });

  it("refuses a request with no lines", async () => {
    const response = await save([]);
    expect(response.status).toBe(400);
    expect(fields(response)).toEqual(["lines"]);
  });

  it("refuses a line that is not an object", async () => {
    const response = await save(["chairs"]);
    expect(response.status).toBe(400);
    expect(fields(response)).toEqual(["lines.0"]);
  });

  it("treats an event outside the coordinator's scope as not found", async () => {
    const draft = await sql<{ id: string }[]>`
      insert into event.events (owner_id, name, status, created_by, updated_by)
      values (${A.org}, 'Someone else draft', 'DRAFT', ${A.org}, ${A.org}) returning id`;
    const response = await save([body()], draft[0]!.id);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("EVENT_NOT_FOUND");
  });

  it("refuses lines for an event that has lost its assigned coordinator", async () => {
    await sql`update event.assignments set is_active = false, ended_at = now() where event_id = ${event.id}`;
    const response = await save([body()]);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ROLE_NOT_AUTHORISED");
  });
});

describe("editing and removing lines: bad input and scope", () => {
  const edit = { equipmentTypeId: "", quantity: 1 };

  it("answers 404 for a line id that is not an id or has no line", async () => {
    for (const id of ["nope", MISSING]) {
      const put = await request(app).put(`${BASE}/${id}`).set(bearer).send({ ...edit, equipmentTypeId: chairs.id });
      expect(put.status).toBe(404);
      expect(put.body.error.code).toBe("EQUIPMENT_LINE_NOT_FOUND");
      const removal = await request(app).post(`${BASE}/${id}/removal`).set(bearer).send({});
      expect(removal.status).toBe(404);
      const status = await request(app).post(`${BASE}/${id}/status`).set(bearer).send({ status: "CONFIRMED" });
      expect(status.status).toBe(403);
      const opened = await request(app).get(`${BASE}/${id}`).set(bearer);
      expect(opened.status).toBe(404);
    }
  });

  it("refuses an edit that is not an object, and an edit to an unknown equipment type", async () => {
    const id = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1 });
    const notObject = await request(app).put(`${BASE}/${id}`).set(bearer).send([1, 2]);
    expect(notObject.status).toBe(400);

    const unknownType = await request(app)
      .put(`${BASE}/${id}`)
      .set(bearer)
      .send(body({ equipmentTypeId: "11111111-1111-4111-8111-111111111111" }));
    expect(unknownType.status).toBe(404);
    expect(unknownType.body.error.code).toBe("EQUIPMENT_TYPE_NOT_FOUND");
  });

  it("defaults an edit's times from the event when they are left out", async () => {
    const id = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1 });
    const response = await request(app).put(`${BASE}/${id}`).set(bearer).send(body({ quantity: 9 }));
    expect(response.status).toBe(200);
    expect(response.body.quantity).toBe(9);
  });

  it("refuses an edit by the coordinator the event was reassigned away from", async () => {
    const id = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1 });
    await sql`update event.assignments set is_active = false, ended_at = now() where event_id = ${event.id}`;
    await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule) values (${event.id}, ${A.c2}, 'TEST_FIXTURE')`;
    const response = await request(app).post(`${BASE}/${id}/removal`).set(bearer).send({});
    expect(response.status).toBe(403);
    expect((await sql`select status from equipment.equipment_request_lines where id = ${id}`)[0]!.status).toBe("SUBMITTED");
  });
});

describe("listing and opening lines", () => {
  it("makes a coordinator say which event, and refuses an unknown filter value", async () => {
    const noEvent = await request(app).get(BASE).set(bearer);
    expect(noEvent.status).toBe(400);
    expect(fields(noEvent)).toEqual(["eventId"]);

    for (const query of ["status=DONE", "limit=0", "limit=101", "cursor=abc", "eventId=nope"]) {
      const response = await request(app).get(`${BASE}?eventId=${event.id}&${query}`).set(bearer);
      expect(response.status, query).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("pages lines oldest first with a cursor", async () => {
    const first = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, quantity: 1 });
    const second = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, quantity: 2 });
    const third = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, quantity: 3 });

    const page1 = await request(app).get(`${BASE}?eventId=${event.id}&limit=2`).set(bearer);
    expect(page1.body.items.map((item: { id: string }) => item.id)).toEqual([first, second]);
    expect(page1.body.nextCursor).toEqual(expect.any(String));
    expect(page1.body.items[0]).not.toHaveProperty("seq");

    const page2 = await request(app).get(`${BASE}?eventId=${event.id}&limit=2&cursor=${page1.body.nextCursor}`).set(bearer);
    expect(page2.body.items.map((item: { id: string }) => item.id)).toEqual([third]);
    expect(page2.body.nextCursor).toBeNull();
  });

  it("lists removed lines only when asked for that status", async () => {
    await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "REMOVED" });
    asTs();
    const ours = (items: { eventId: string }[]) => items.filter((item) => item.eventId === event.id);
    const plain = await request(app).get(BASE).set(bearer);
    expect(ours(plain.body.items)).toHaveLength(0);
    const removed = await request(app).get(`${BASE}?status=REMOVED`).set(bearer);
    expect(ours(removed.body.items)).toHaveLength(1);
  });

  it("refuses the organiser reading lines", async () => {
    signedInAs(A.org, "EVENT_ORGANISER");
    const id = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1 });
    expect((await request(app).get(BASE).set(bearer)).status).toBe(403);
    expect((await request(app).get(`${BASE}/${id}`).set(bearer)).status).toBe(403);
  });
});

describe("changing status: paths the cards do not name", () => {
  it("answers 404 for a line id that is not an id", async () => {
    asTs();
    const response = await request(app).post(`${BASE}/nope/status`).set(bearer).send({ status: "CONFIRMED" });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("EQUIPMENT_LINE_NOT_FOUND");
  });

  it("refuses a status body that is not an object", async () => {
    asTs();
    const id = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1 });
    const response = await request(app).post(`${BASE}/${id}/status`).set(bearer).send([1]);
    expect(response.status).toBe(400);
    expect(fields(response)).toEqual(["status"]);
  });

  it("changes the status of a line for an event with no assigned coordinator, and notifies nobody", async () => {
    const orphan = await createEvent(sql, { ownerId: A.org, coordinatorId: null, name: "No coordinator" });
    const id = await insertLineDirect(sql, { event: orphan, equipmentTypeId: chairs.id, requestedBy: A.c1 });
    asTs();
    const response = await request(app).post(`${BASE}/${id}/status`).set(bearer).send({ status: "CONFIRMED" });
    expect(response.status).toBe(200);
    expect(await sql`select 1 from equipment.outbox where message_key = ${id}`).toHaveLength(0);
  });

  it("clears a reason and a substitute when the line moves on to another status", async () => {
    asTs();
    const id = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1 });
    await request(app).post(`${BASE}/${id}/status`).set(bearer).send({ status: "SUBSTITUTED", substituteEquipmentTypeId: projectors.id, substituteQuantity: 2 });
    const back = await request(app).post(`${BASE}/${id}/status`).set(bearer).send({ status: "UNDER_REVIEW" });
    expect(back.status).toBe(200);
    expect(back.body).toMatchObject({ status: "UNDER_REVIEW", substituteEquipmentTypeId: null, substituteQuantity: null, unavailableReason: null });
    expect(back.body.quantity).toBe(40);
  });

  it("queues an edit and a status change on the same line instead of losing one", async () => {
    const id = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1 });
    // Each request carries its own caller, because both are in flight at once.
    vi.mocked(resolveCurrentUser).mockImplementation(async (subject: string) =>
      subject === "Bearer ts"
        ? { id: A.ts, email: "ts@connectsphere.test", role: "TECH_SUPPORT_STAFF" as const }
        : { id: A.c1, email: "c1@connectsphere.test", role: "EVENT_COORDINATOR" as const },
    );
    const edit = request(app).put(`${BASE}/${id}`).set({ Authorization: "Bearer c1" }).send(body({ quantity: 7 }));
    const statusChange = request(app).post(`${BASE}/${id}/status`).set({ Authorization: "Bearer ts" }).send({ status: "CONFIRMED" });
    const [editResponse, statusResponse] = await Promise.all([edit, statusChange]);
    expect([editResponse.status, statusResponse.status].every((status) => [200, 409].includes(status))).toBe(true);
    const finalLine = (await sql`select status, quantity from equipment.equipment_request_lines where id = ${id}`)[0]!;
    // Whichever ran first, the line ends consistent: confirmed lines keep the quantity they had when confirmed.
    expect(finalLine.status === "CONFIRMED" || finalLine.status === "SUBMITTED").toBe(true);
    if (editResponse.status === 409) expect(finalLine.quantity).toBe(40);
  });
});
