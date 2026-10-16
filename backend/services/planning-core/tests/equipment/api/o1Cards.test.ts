import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";
import {
  actorsWithPrefix,
  cleanLineFixtures,
  createEvent,
  createTypes,
  EVENT_WINDOW,
  insertLineDirect,
} from "../../support/lineFixtures.js";

// The O1 cards (tests/O1): real Express app and migrated Postgres, with JWT verification and the
// identity lookup replaced. Each test is named after its card; the card's steps are the test's steps.
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "o1-card-subject" };
    next();
  },
}));
vi.mock("../../../src/modules/equipment/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/equipment/auth/identity.js")>(
    "../../../src/modules/equipment/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn() };
});

const { resolveCurrentUser, IdentityUnavailableError } = await import("../../../src/modules/equipment/auth/identity.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
const A = actorsWithPrefix("0b100000");
const bearer = { Authorization: "Bearer o1-card-token" };
const BASE = "/api/v1/equipment/request-lines";
const DAY = EVENT_WINDOW.start.slice(0, 10);
const at = (time: string) => `${DAY}T${time}:00.000Z`;
const SLACK_MS = 2_000;

type Role = "EVENT_COORDINATOR" | "TECH_SUPPORT_STAFF" | "EVENT_ORGANISER" | "VENUE_STAFF" | "ATTENDEE";
function signedInAs(userId: string, role: Role) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "o1@connectsphere.test", role });
}
const asC1 = () => signedInAs(A.c1, "EVENT_COORDINATOR");
const asC2 = () => signedInAs(A.c2, "EVENT_COORDINATOR");
const asTs = () => signedInAs(A.ts, "TECH_SUPPORT_STAFF");

let event: { id: string; reference: string; name: string };
let chairs: { id: string; name: string };
let projectors: { id: string; name: string };

async function clean() {
  await cleanLineFixtures(sql, [A.org], [A.ts]);
}

beforeAll(async () => {
  await clean();
});
beforeEach(async () => {
  await clean();
  event = await createEvent(sql, { ownerId: A.org, coordinatorId: A.c1, name: "O1 fixture event" });
  ({ chairs, projectors } = await createTypes(sql, A.ts, "O1"));
  asC1();
});
afterAll(async () => {
  await clean();
  await sql.end();
});

const line = (changes: Record<string, unknown> = {}) => ({
  equipmentTypeId: chairs.id,
  quantity: 40,
  notes: "Set out in rows of 10",
  ...changes,
});
const save = (lines: unknown[], eventId = event.id) => request(app).post(BASE).set(bearer).send({ eventId, lines });
const lineCount = async () =>
  Number((await sql`select count(*) from equipment.equipment_request_lines where event_id = ${event.id}`)[0]!.count);
const historyCount = async () =>
  Number(
    (await sql`
      select count(*) from equipment.request_line_history
      where line_id in (select id from equipment.equipment_request_lines where event_id = ${event.id})`)[0]!.count,
  );
const row = async (id: string) => (await sql`select * from equipment.equipment_request_lines where id = ${id}`)[0];
const detail = (id: string) => request(app).get(`${BASE}/${id}`).set(bearer);

async function savedLine(changes: Record<string, unknown> = {}) {
  const response = await save([line(changes)]);
  expect(response.status).toBe(201);
  return response.body.items[0] as { id: string };
}

async function refusesFieldAndStoresNothing(body: unknown, field: string) {
  const response = await request(app).post(BASE).set(bearer).send(body);
  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe("VALIDATION_FAILED");
  expect(response.body.error.fields.map((entry: { field: string }) => entry.field)).toContain(field);
  expect(await lineCount()).toBe(0);
  return response;
}

describe("O1 cards: recording lines", () => {
  it("O1-T1 records a line and the times default from the event", async () => {
    const before = Date.now();
    const response = await save([{ equipmentTypeId: chairs.id, quantity: 40, notes: "Set out in rows of 10" }]);
    const after = Date.now();

    expect(response.status).toBe(201);
    expect(response.body.items).toHaveLength(1);
    const created = response.body.items[0];
    expect(created).toMatchObject({
      eventId: event.id,
      eventReference: event.reference,
      equipmentTypeId: chairs.id,
      equipmentTypeName: chairs.name,
      quantity: 40,
      notes: "Set out in rows of 10",
      status: "SUBMITTED",
      requiredFrom: EVENT_WINDOW.start,
      requiredTo: EVENT_WINDOW.end,
      requestedBy: A.c1,
    });
    expect(new Date(created.requestedAt).getTime()).toBeGreaterThanOrEqual(before - SLACK_MS);
    expect(new Date(created.requestedAt).getTime()).toBeLessThanOrEqual(after + SLACK_MS);

    const fetched = await detail(created.id);
    expect(fetched.status).toBe(200);
    expect(fetched.body).toMatchObject(created);
  });

  it("O1-T2 saves a request of two lines", async () => {
    const response = await save([
      { equipmentTypeId: chairs.id, quantity: 40, notes: "" },
      { equipmentTypeId: projectors.id, quantity: 2, notes: "HDMI and USB-C inputs" },
    ]);
    expect(response.status).toBe(201);
    expect(response.body.items.map((item: { equipmentTypeId: string; quantity: number; status: string }) => [item.equipmentTypeId, item.quantity, item.status])).toEqual([
      [chairs.id, 40, "SUBMITTED"],
      [projectors.id, 2, "SUBMITTED"],
    ]);
    expect(response.body.items[1].notes).toBe("HDMI and USB-C inputs");
    expect(response.body.items.every((item: { requiredFrom: string }) => item.requiredFrom === EVENT_WINDOW.start)).toBe(true);

    const listed = await request(app).get(`${BASE}?eventId=${event.id}`).set(bearer);
    expect(listed.status).toBe(200);
    expect(listed.body.items.map((item: { id: string }) => item.id)).toEqual(response.body.items.map((item: { id: string }) => item.id));
  });

  it("O1-T3 keeps times the coordinator gives instead of the defaults", async () => {
    const response = await save([line({ quantity: 10, notes: "Early set-up", requiredFrom: at("13:00"), requiredTo: at("19:30") })]);
    expect(response.status).toBe(201);
    expect(response.body.items[0]).toMatchObject({ requiredFrom: at("13:00"), requiredTo: at("19:30") });
  });

  it("O1-T4 refuses required-to equal to required-from and stores nothing", async () => {
    await refusesFieldAndStoresNothing(
      { eventId: event.id, lines: [line({ quantity: 5, notes: "", requiredFrom: at("15:00"), requiredTo: at("15:00") })] },
      "lines.0.requiredTo",
    );
  });

  it("O1-T5 refuses required-to before required-from and stores nothing", async () => {
    await refusesFieldAndStoresNothing(
      { eventId: event.id, lines: [line({ quantity: 5, notes: "", requiredFrom: at("16:00"), requiredTo: at("15:00") })] },
      "lines.0.requiredTo",
    );
  });

  it("O1-T6 accepts required-to one minute after required-from", async () => {
    const response = await save([line({ quantity: 5, notes: "", requiredFrom: at("15:00"), requiredTo: at("15:01") })]);
    expect(response.status).toBe(201);
    expect(response.body.items[0]).toMatchObject({ status: "SUBMITTED", requiredFrom: at("15:00"), requiredTo: at("15:01") });
  });

  it("O1-T7 refuses quantity 0 and stores nothing", async () => {
    const response = await refusesFieldAndStoresNothing({ eventId: event.id, lines: [line({ quantity: 0, notes: "" })] }, "lines.0.quantity");
    expect(response.body.error.fields[0].message).toBe("Quantity must be a whole number greater than zero.");
  });

  it("O1-T8 accepts quantity 1", async () => {
    const response = await save([{ equipmentTypeId: projectors.id, quantity: 1, notes: "" }]);
    expect(response.status).toBe(201);
    expect(response.body.items[0]).toMatchObject({ status: "SUBMITTED", quantity: 1 });
  });

  it("O1-T9 refuses negative, fractional and non-numeric quantities", async () => {
    for (const quantity of [-1, 1.5, "ten"]) {
      await refusesFieldAndStoresNothing({ eventId: event.id, lines: [line({ quantity, notes: "" })] }, "lines.0.quantity");
    }
  });

  it("O1-T10 creates none of a request's lines when one is invalid", async () => {
    const response = await request(app)
      .post(BASE)
      .set(bearer)
      .send({
        eventId: event.id,
        lines: [line({ notes: "valid" }), { equipmentTypeId: projectors.id, quantity: 0, notes: "invalid" }],
      });
    expect(response.status).toBe(400);
    expect(response.body.error.fields.map((entry: { field: string }) => entry.field)).toEqual(["lines.1.quantity"]);
    expect(await lineCount()).toBe(0);
    expect(await historyCount()).toBe(0);
  });

  it("O1-T11 shows the saved lines to Technical Support", async () => {
    const saved = await save([
      { equipmentTypeId: chairs.id, quantity: 40, notes: "" },
      { equipmentTypeId: projectors.id, quantity: 2, notes: "HDMI and USB-C inputs" },
    ]);
    expect(saved.status).toBe(201);

    asTs();
    const listed = await request(app).get(BASE).set(bearer);
    expect(listed.status).toBe(200);
    const ours = listed.body.items.filter((item: { eventId: string }) => item.eventId === event.id);
    expect(ours).toHaveLength(2);
    for (const item of ours) {
      expect(item).toMatchObject({ status: "SUBMITTED", eventReference: event.reference });
      expect(typeof item.equipmentTypeName).toBe("string");
    }

    const opened = await detail(saved.body.items[0].id);
    expect(opened.status).toBe(200);
    expect(opened.body).toMatchObject({ equipmentTypeId: chairs.id, requestedBy: A.c1 });
  });

  it("O1-T12 records the coordinator and the time as history", async () => {
    const before = Date.now();
    const created = await savedLine();
    const after = Date.now();

    const opened = await detail(created.id);
    expect(opened.status).toBe(200);
    expect(opened.body.history).toHaveLength(1);
    const entry = opened.body.history[0];
    expect(entry).toMatchObject({ action: "CREATED", actorUserId: A.c1, actorRole: "EVENT_COORDINATOR", newStatus: "SUBMITTED" });
    expect(new Date(entry.occurredAt).getTime()).toBeGreaterThanOrEqual(before - SLACK_MS);
    expect(new Date(entry.occurredAt).getTime()).toBeLessThanOrEqual(after + SLACK_MS);
    expect(opened.body.requestedBy).toBe(entry.actorUserId);
    expect(new Date(opened.body.requestedAt).getTime()).toBeGreaterThanOrEqual(before - SLACK_MS);
  });
});

describe("O1 cards: editing and removing lines", () => {
  it("O1-T13 lets the coordinator edit a Submitted line", async () => {
    const created = await savedLine();
    const original = await row(created.id);

    const response = await request(app)
      .put(`${BASE}/${created.id}`)
      .set(bearer)
      .send({
        equipmentTypeId: projectors.id,
        quantity: 45,
        notes: "Increase after headcount update",
        requiredFrom: at("13:30"),
        requiredTo: at("18:30"),
      });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      equipmentTypeId: projectors.id,
      quantity: 45,
      notes: "Increase after headcount update",
      requiredFrom: at("13:30"),
      requiredTo: at("18:30"),
      status: "SUBMITTED",
      requestedBy: A.c1,
    });
    expect(new Date(response.body.requestedAt).getTime()).toBe(original!.requested_at.getTime());

    const history = (await detail(created.id)).body.history;
    expect(history.map((entry: { action: string }) => entry.action)).toEqual(["CREATED", "EDITED"]);
    expect(history[1]).toMatchObject({ actorUserId: A.c1 });
  });

  it("O1-T14 lets the coordinator edit an Under Review line", async () => {
    const created = await savedLine();
    asTs();
    expect((await request(app).post(`${BASE}/${created.id}/status`).set(bearer).send({ status: "UNDER_REVIEW" })).status).toBe(200);

    asC1();
    const response = await request(app)
      .put(`${BASE}/${created.id}`)
      .set(bearer)
      .send({ equipmentTypeId: chairs.id, quantity: 35, notes: "Reduced", requiredFrom: at("14:00"), requiredTo: at("18:00") });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ quantity: 35, status: "UNDER_REVIEW" });
  });

  it("O1-T15 refuses to edit a Reserved line and changes nothing", async () => {
    const id = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "RESERVED" });
    const before = await row(id);
    const historyBefore = await historyCount();

    const response = await request(app)
      .put(`${BASE}/${id}`)
      .set(bearer)
      .send({ equipmentTypeId: chairs.id, quantity: 10, notes: "Attempted change", requiredFrom: at("14:00"), requiredTo: at("18:00") });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EQUIPMENT_LINE_NOT_EDITABLE");
    expect(response.body.error.message).toContain("Reserved");
    expect(await row(id)).toEqual(before);
    expect(await historyCount()).toBe(historyBefore);
  });

  it("O1-T16 refuses to edit Confirmed, Unavailable, Substituted and Removed lines", async () => {
    const ids = {
      CONFIRMED: await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "CONFIRMED" }),
      UNAVAILABLE: await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "UNAVAILABLE" }),
      SUBSTITUTED: await insertLineDirect(sql, {
        event,
        equipmentTypeId: chairs.id,
        requestedBy: A.c1,
        status: "SUBSTITUTED",
        substitute: { typeId: projectors.id, quantity: 3 },
      }),
      REMOVED: await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "REMOVED" }),
    };
    for (const [status, id] of Object.entries(ids)) {
      const before = await row(id);
      const response = await request(app)
        .put(`${BASE}/${id}`)
        .set(bearer)
        .send({ equipmentTypeId: chairs.id, quantity: 10, notes: before!.notes, requiredFrom: EVENT_WINDOW.start, requiredTo: EVENT_WINDOW.end });
      expect(response.status, status).toBe(409);
      expect(response.body.error.code).toBe("EQUIPMENT_LINE_NOT_EDITABLE");
      expect(await row(id)).toEqual(before);
    }
  });

  it("O1-T17 changes nothing when an edit is invalid", async () => {
    const created = await savedLine();
    const before = await row(created.id);
    const historyBefore = await historyCount();
    const valid = { equipmentTypeId: chairs.id, quantity: 40, notes: "x", requiredFrom: at("14:00"), requiredTo: at("18:00") };

    const zero = await request(app).put(`${BASE}/${created.id}`).set(bearer).send({ ...valid, quantity: 0 });
    expect(zero.status).toBe(400);
    expect(zero.body.error.fields.map((entry: { field: string }) => entry.field)).toEqual(["quantity"]);

    const equal = await request(app).put(`${BASE}/${created.id}`).set(bearer).send({ ...valid, requiredFrom: at("15:00"), requiredTo: at("15:00") });
    expect(equal.status).toBe(400);
    expect(equal.body.error.fields.map((entry: { field: string }) => entry.field)).toEqual(["requiredTo"]);

    expect(await row(created.id)).toEqual(before);
    expect(await historyCount()).toBe(historyBefore);
  });

  it("O1-T18 removes a Submitted line by status and records the removal", async () => {
    const created = await savedLine();
    const before = Date.now();
    const response = await request(app).post(`${BASE}/${created.id}/removal`).set(bearer).send({});
    const after = Date.now();

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("REMOVED");
    expect(await row(created.id)).toMatchObject({ status: "REMOVED" });

    const history = (await detail(created.id)).body.history;
    const removal = history[history.length - 1];
    expect(removal).toMatchObject({
      action: "REMOVED",
      actorUserId: A.c1,
      equipmentTypeName: chairs.name,
      quantity: 40,
      previousStatus: "SUBMITTED",
      newStatus: "REMOVED",
    });
    expect(new Date(removal.occurredAt).getTime()).toBeGreaterThanOrEqual(before - SLACK_MS);
    expect(new Date(removal.occurredAt).getTime()).toBeLessThanOrEqual(after + SLACK_MS);

    const listed = await request(app).get(`${BASE}?eventId=${event.id}`).set(bearer);
    expect(listed.body.items).toEqual([]);
  });

  it("O1-T19 removes an Under Review line", async () => {
    const created = await savedLine();
    asTs();
    await request(app).post(`${BASE}/${created.id}/status`).set(bearer).send({ status: "UNDER_REVIEW" });

    asC1();
    const response = await request(app).post(`${BASE}/${created.id}/removal`).set(bearer).send({});
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("REMOVED");
    const history = (await detail(created.id)).body.history;
    expect(history[history.length - 1]).toMatchObject({ action: "REMOVED", actorUserId: A.c1, equipmentTypeName: chairs.name, quantity: 40 });
  });

  it("O1-T20 refuses to remove a Reserved line that holds no active reservation, and changes nothing", async () => {
    const id = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: A.c1, status: "RESERVED" });
    const before = await row(id);
    const historyBefore = await historyCount();

    const response = await request(app).post(`${BASE}/${id}/removal`).set(bearer).send({});
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EQUIPMENT_LINE_NOT_EDITABLE");
    expect(response.body.error.message).toContain("Reserved");
    expect(await row(id)).toEqual(before);
    expect(await historyCount()).toBe(historyBefore);
  });
});

describe("O1 cards: who may write, and refusals that store nothing", () => {
  it("O1-T21 refuses a coordinator who is not assigned to the event", async () => {
    const created = await savedLine();
    const before = await row(created.id);
    const historyBefore = await historyCount();

    asC2();
    const attempts = [
      await save([line()]),
      await request(app).put(`${BASE}/${created.id}`).set(bearer).send({ equipmentTypeId: chairs.id, quantity: 10, notes: "", requiredFrom: at("14:00"), requiredTo: at("18:00") }),
      await request(app).post(`${BASE}/${created.id}/removal`).set(bearer).send({}),
    ];
    for (const attempt of attempts) {
      expect(attempt.status).toBe(403);
      expect(attempt.body.error.code).toBe("ROLE_NOT_AUTHORISED");
    }
    expect(await lineCount()).toBe(1);
    expect(await row(created.id)).toEqual(before);
    expect(await historyCount()).toBe(historyBefore);
  });

  it("O1-T22 refuses the organiser, Technical Support, Venue Staff and attendees", async () => {
    const roles: [string, Role][] = [
      [A.org, "EVENT_ORGANISER"],
      [A.ts, "TECH_SUPPORT_STAFF"],
      [A.vs, "VENUE_STAFF"],
      [A.att, "ATTENDEE"],
    ];
    for (const [userId, role] of roles) {
      signedInAs(userId, role);
      const response = await save([line()]);
      expect(response.status, role).toBe(403);
      expect(response.body.error.code).toBe("ROLE_NOT_AUTHORISED");
    }
    expect(await lineCount()).toBe(0);
  });

  it("O1-T23 refuses an equipment type that does not exist", async () => {
    const response = await save([{ equipmentTypeId: "11111111-1111-4111-8111-111111111111", quantity: 2, notes: "" }]);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("EQUIPMENT_TYPE_NOT_FOUND");
    expect(await lineCount()).toBe(0);
  });

  it("O1-T24 refuses an event that does not exist", async () => {
    const response = await save([line({ quantity: 2, notes: "" })], "22222222-2222-4222-8222-222222222222");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("EVENT_NOT_FOUND");
    expect(Number((await sql`select count(*) from equipment.equipment_request_lines where requested_by = ${A.c1}`)[0]!.count)).toBe(0);
  });

  it("O1-T25 refuses the save with 503 when the identity lookup is unavailable", async () => {
    vi.mocked(resolveCurrentUser).mockRejectedValue(new IdentityUnavailableError("database unreachable"));
    const response = await save([line()]);
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("IDENTITY_UNAVAILABLE");
    expect(await lineCount()).toBe(0);
  });
});
