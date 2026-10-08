import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";

vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "p2-test-subject" };
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
const TECH = "a7777777-0000-0000-0000-000000000001";
const OTHER = "a7777777-0000-0000-0000-000000000002";
const bearer = { Authorization: "Bearer p2-test-token" };

function signedInAs(userId: string, role: string) {
  vi.mocked(resolveCurrentUser).mockResolvedValue({ id: userId, email: "p2@connectsphere.test", role: role as never });
}

const bulk = (changes: Record<string, unknown> = {}) => ({
  name: `P2 Folding Chairs ${randomUUID().slice(0, 8)}`,
  description: "Stackable chairs for event seating",
  characteristics: { colour: "blue", material: "polypropylene" },
  kind: "BULK",
  totalQuantity: 20,
  unitLabels: [],
  ...changes,
});

const serialized = (changes: Record<string, unknown> = {}) => ({
  name: `P2 Projectors ${randomUUID().slice(0, 8)}`,
  description: "Individually tracked laser projectors",
  characteristics: { resolution: "4K" },
  kind: "SERIALIZED",
  totalQuantity: null,
  unitLabels: ["PROJ-01", "PROJ-02"],
  ...changes,
});

const unavailable = (changes: Record<string, unknown> = {}) => ({
  unitId: null,
  quantity: 3,
  startsAt: "2026-11-02T02:00:00.000Z",
  endsAt: "2026-11-02T04:00:00.000Z",
  reason: "Damaged legs awaiting repair",
  ...changes,
});

async function cleanUp() {
  const ours = sql`select id from equipment.equipment_types where created_by in ${sql([TECH, OTHER])}`;
  const units = sql`select id from equipment.equipment_units where equipment_type_id in (${ours})`;
  await sql`delete from equipment.inventory_history where equipment_type_id in (${ours})`;
  await sql`delete from equipment.unavailability where equipment_type_id in (${ours})`;
  await sql`delete from equipment.unit_reservations where unit_id in (${units})`;
  await sql`delete from equipment.bulk_reservations where equipment_type_id in (${ours})`;
  await sql`delete from equipment.equipment_units where equipment_type_id in (${ours})`;
  await sql`delete from equipment.equipment_types where id in (${ours})`;
}

beforeEach(async () => {
  signedInAs(TECH, "TECH_SUPPORT_STAFF");
  await cleanUp();
});
afterAll(async () => {
  await cleanUp();
  await sql.end();
});

async function create(body = bulk()) {
  const response = await request(app).post("/api/v1/equipment/types").set(bearer).send(body);
  expect(response.status).toBe(201);
  return response.body;
}

describe("P2 equipment type inventory", () => {
  it.each([
    ["P2-T1", "P2 Wireless Microphone", "Handheld wireless microphone for talks and panels.", { "Frequency band": "534–598 MHz", Connector: "XLR", Power: "2×AA" }, 20, 201],
    ["P2-T2", "P2 Spare Audio Mixer", "Inventory type created before stock arrives.", { Inputs: "12" }, 0, 201],
    ["P2-T3", "P2 Negative Quantity", "Boundary test record", { Category: "Test" }, -1, 400],
  ])("%s verifies the card's inventory quantity through save, list and reopen", async (_card, name, description, characteristics, totalQuantity, status) => {
    const input = bulk({
      name,
      description,
      characteristics,
      totalQuantity,
    });
    const response = await request(app).post("/api/v1/equipment/types").set(bearer).send(input);
    expect(response.status).toBe(status);
    const listing = await request(app).get("/api/v1/equipment/types").set(bearer);
    expect(listing.status).toBe(200);
    if (status === 400) {
      expect(response.body.error.fields).toContainEqual({
        field: "totalQuantity", message: "Total quantity must be a whole number of zero or greater.",
      });
      expect(listing.body.items.some((item: { name: string }) => item.name === name)).toBe(false);
      expect(await sql`select * from equipment.inventory_history where actor_user_id = ${TECH}`).toHaveLength(0);
      return;
    }
    expect(listing.body.items).toContainEqual(expect.objectContaining({ id: response.body.id, name, totalQuantity }));
    const reopened = await request(app).get(`/api/v1/equipment/types/${response.body.id}`).set(bearer);
    expect(reopened.status).toBe(200);
    expect(reopened.body).toMatchObject(input);
  });

  it.each([
    ["P2-T4", "Battery compartments under repair", "2026-12-10T01:00:00Z", "2026-12-10T01:01:00Z", 201],
    ["P2-T5", "", "2026-12-10T01:00:00Z", "2026-12-12T09:00:00Z", 400],
    ["P2-T6", "   ", "2026-12-10T01:00:00Z", "2026-12-12T09:00:00Z", 400],
    ["P2-T7", "Battery compartments under repair", "2026-12-10T01:00:00Z", "2026-12-10T01:00:00Z", 400],
    ["P2-T8", "Battery compartments under repair", "2026-12-10T09:00:00Z", "2026-12-10T01:00:00Z", 400],
  ])("%s verifies unavailability and its persisted outcome", async (_card, reason, startsAt, endsAt, status) => {
    const type = await create(bulk({ name: "P2 Wireless Microphone" }));
    const before = (await request(app).get(`/api/v1/equipment/types/${type.id}`).set(bearer)).body;
    const input = unavailable({ quantity: 2, startsAt, endsAt, reason });
    const response = await request(app).post(`/api/v1/equipment/types/${type.id}/unavailability`).set(bearer).send(input);
    expect(response.status).toBe(status);
    const reopened = (await request(app).get(`/api/v1/equipment/types/${type.id}`).set(bearer)).body;
    expect(reopened.totalQuantity).toBe(20);
    if (status === 400) {
      expect(reopened).toEqual(before);
      expect(response.body.error.fields).toContainEqual(expect.objectContaining({
        field: reason.trim() ? "endsAt" : "reason",
      }));
      return;
    }
    expect(reopened.unavailability).toHaveLength(1);
    expect(reopened.unavailability[0]).toMatchObject({
      quantity: 2, reason, status: "ACTIVE", startsAt: "2026-12-10T01:00:00.000Z", endsAt: "2026-12-10T01:01:00.000Z",
    });
  });

  it.each([
    ["P2-T9", 10, 200],
    ["P2-T10", 9, 409],
    ["P2-T13", 11, 200],
  ])("%s checks below, at and above ten reserved units without altering reservations", async (_card, totalQuantity, status) => {
    const type = await create(bulk({ name: "P2 Reserved Conference Chair", totalQuantity: 12 }));
    await sql`
      insert into equipment.bulk_reservations
        (equipment_type_id, event_id, event_reference, quantity, starts_at, ends_at, status, created_by, updated_by)
      values
        (${type.id}, ${randomUUID()}, 'EVT-700101', 6, '2026-12-15T02:00:00Z', '2026-12-15T04:00:00Z', 'RESERVED', ${TECH}, ${TECH}),
        (${type.id}, ${randomUUID()}, 'EVT-700102', 4, '2026-12-15T02:30:00Z', '2026-12-15T03:30:00Z', 'RESERVED', ${TECH}, ${TECH})
    `;
    const reservations = await sql`select * from equipment.bulk_reservations where equipment_type_id = ${type.id} order by id`;
    const before = (await request(app).get(`/api/v1/equipment/types/${type.id}`).set(bearer)).body;
    const response = await request(app).put(`/api/v1/equipment/types/${type.id}`).set(bearer)
      .send(bulk({ name: type.name, totalQuantity }));
    expect(response.status).toBe(status);
    expect(await sql`select * from equipment.bulk_reservations where equipment_type_id = ${type.id} order by id`).toEqual(reservations);
    const reopened = (await request(app).get(`/api/v1/equipment/types/${type.id}`).set(bearer)).body;
    if (status === 409) {
      expect(reopened).toEqual(before);
      expect(response.body.error.message).toContain("EVT-700101 (6)");
      expect(response.body.error.message).toContain("EVT-700102 (4)");
    } else {
      expect(reopened.totalQuantity).toBe(totalQuantity);
    }
  });

  it("P2 AC1 creates bulk and serialized equipment types with every required detail and accepts zero", async () => {
    const zero = await create(bulk({ totalQuantity: 0 }));
    expect(zero).toMatchObject({
      description: "Stackable chairs for event seating",
      characteristics: { colour: "blue", material: "polypropylene" },
      kind: "BULK",
      totalQuantity: 0,
      unitLabels: [],
    });

    const tracked = await create(serialized());
    expect(tracked).toMatchObject({ kind: "SERIALIZED", totalQuantity: 2, unitLabels: ["PROJ-01", "PROJ-02"] });
    expect(tracked.units).toEqual([
      expect.objectContaining({ label: "PROJ-01" }),
      expect.objectContaining({ label: "PROJ-02" }),
    ]);
  });

  it("P2 AC1 rejects a negative total and stores no type or audit record", async () => {
    const response = await request(app).post("/api/v1/equipment/types").set(bearer).send(bulk({ totalQuantity: -1 }));
    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: "VALIDATION_FAILED", fields: [expect.objectContaining({ field: "totalQuantity" })] });
    expect(await sql`select 1 from equipment.equipment_types where created_by = ${TECH}`).toHaveLength(0);
    expect(await sql`select 1 from equipment.inventory_history where actor_user_id = ${TECH}`).toHaveLength(0);
  });

  it("synchronises serialized labels by retaining retired unit rows instead of deleting them", async () => {
    const projectors = await create(serialized());
    const response = await request(app)
      .put(`/api/v1/equipment/types/${projectors.id}`).set(bearer)
      .send(serialized({ name: projectors.name, unitLabels: ["PROJ-02", "PROJ-03"] }));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ totalQuantity: 2, unitLabels: ["PROJ-02", "PROJ-03"] });
    expect(await sql`
      select label, status from equipment.equipment_units
       where equipment_type_id = ${projectors.id} order by label
    `).toMatchObject([
      { label: "PROJ-01", status: "RETIRED" },
      { label: "PROJ-02", status: "ACTIVE" },
      { label: "PROJ-03", status: "ACTIVE" },
    ]);
  });

  it("P2 AC2 records bulk and serialized unavailability only with a reason and increasing period", async () => {
    const chairs = await create();
    const bulkResult = await request(app)
      .post(`/api/v1/equipment/types/${chairs.id}/unavailability`).set(bearer).send(unavailable());
    expect(bulkResult.status).toBe(201);
    expect(bulkResult.body).toMatchObject({ equipmentTypeId: chairs.id, quantity: 3, reason: "Damaged legs awaiting repair", status: "ACTIVE" });

    const projectors = await create(serialized());
    const unitResult = await request(app)
      .post(`/api/v1/equipment/types/${projectors.id}/unavailability`).set(bearer)
      .send(unavailable({ quantity: null, unitId: projectors.units[0].id }));
    expect(unitResult.status).toBe(201);
    expect(unitResult.body).toMatchObject({ equipmentTypeId: projectors.id, unitId: projectors.units[0].id, quantity: 1 });

    for (const invalid of [
      unavailable({ reason: "   " }),
      unavailable({ startsAt: "2026-11-02T04:00:00.000Z", endsAt: "2026-11-02T04:00:00.000Z" }),
      unavailable({ startsAt: "2026-11-02T05:00:00.000Z", endsAt: "2026-11-02T04:00:00.000Z" }),
    ]) {
      const refused = await request(app)
        .post(`/api/v1/equipment/types/${chairs.id}/unavailability`).set(bearer).send(invalid);
      expect(refused.status).toBe(400);
    }
    expect(await sql`select 1 from equipment.unavailability where equipment_type_id = ${chairs.id}`).toHaveLength(1);
  });

  it("P2 AC3 refuses a reduction below overlapping reservations, names every event and quantity, and changes nothing", async () => {
    const chairs = await create(bulk({ totalQuantity: 10 }));
    await sql`
      insert into equipment.bulk_reservations
        (equipment_type_id, event_id, event_reference, quantity, starts_at, ends_at, status, created_by, updated_by)
      values
        (${chairs.id}, ${randomUUID()}, 'EVT-P2-101', 4, '2026-11-02T02:00:00Z', '2026-11-02T05:00:00Z', 'RESERVED', ${TECH}, ${TECH}),
        (${chairs.id}, ${randomUUID()}, 'EVT-P2-202', 3, '2026-11-02T03:00:00Z', '2026-11-02T06:00:00Z', 'RESERVED', ${TECH}, ${TECH})
    `;

    const response = await request(app)
      .put(`/api/v1/equipment/types/${chairs.id}`).set(bearer)
      .send({ ...bulk({ name: chairs.name, totalQuantity: 5 }) });
    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({
      code: "INSUFFICIENT_EQUIPMENT",
      details: {
        proposedQuantity: 5,
        affectedReservations: [
          { eventReference: "EVT-P2-101", quantity: 4 },
          { eventReference: "EVT-P2-202", quantity: 3 },
        ],
      },
    });
    expect(response.body.error.message).toContain("EVT-P2-101 (4)");
    expect(response.body.error.message).toContain("EVT-P2-202 (3)");
    expect((await sql`select total_quantity from equipment.equipment_types where id = ${chairs.id}`)[0]!.total_quantity).toBe(10);
    expect(await sql`select 1 from equipment.inventory_history where equipment_type_id = ${chairs.id}`).toHaveLength(1);

    const threshold = await request(app)
      .put(`/api/v1/equipment/types/${chairs.id}`).set(bearer)
      .send({ ...bulk({ name: chairs.name, totalQuantity: 7 }) });
    expect(threshold.status).toBe(200);
    expect(threshold.body.totalQuantity).toBe(7);
  });

  it("refuses retiring a reserved serialized unit and retains its active label", async () => {
    const projectors = await create(serialized());
    await sql`
      insert into equipment.unit_reservations
        (unit_id, event_id, event_reference, starts_at, ends_at, status, created_by, updated_by)
      values
        (${projectors.units[0].id}, ${randomUUID()}, 'EVT-P2-UNIT', '2026-11-02T02:00:00Z', '2026-11-02T04:00:00Z',
         'RESERVED', ${TECH}, ${TECH})
    `;
    const response = await request(app)
      .put(`/api/v1/equipment/types/${projectors.id}`).set(bearer)
      .send(serialized({ name: projectors.name, unitLabels: ["PROJ-02", "PROJ-03"] }));
    expect(response.status).toBe(409);
    expect(response.body.error.message).toContain("EVT-P2-UNIT (1)");
    expect((await request(app).get(`/api/v1/equipment/types/${projectors.id}`).set(bearer)).body.unitLabels)
      .toEqual(["PROJ-01", "PROJ-02"]);
  });

  it("P2 AC4 audits inventory and unavailability with actor, timestamp, and previous/new quantity", async () => {
    const [started] = await sql`select clock_timestamp() as at`;
    const chairs = await create(bulk({ totalQuantity: 20 }));
    await request(app).put(`/api/v1/equipment/types/${chairs.id}`).set(bearer)
      .send(bulk({ name: chairs.name, totalQuantity: 24 }));
    await request(app).post(`/api/v1/equipment/types/${chairs.id}/unavailability`).set(bearer)
      .send(unavailable({ quantity: 3 }));

    const rows = await sql`
      select action, previous_quantity, new_quantity, actor_user_id, actor_role, occurred_at
        from equipment.inventory_history where equipment_type_id = ${chairs.id}
       order by occurred_at
    `;
    expect(rows).toMatchObject([
      { action: "TYPE_CREATED", previous_quantity: 0, new_quantity: 20, actor_user_id: TECH, actor_role: "TECH_SUPPORT_STAFF" },
      { action: "TYPE_UPDATED", previous_quantity: 20, new_quantity: 24, actor_user_id: TECH, actor_role: "TECH_SUPPORT_STAFF" },
      { action: "UNAVAILABILITY_RECORDED", previous_quantity: 0, new_quantity: 3, actor_user_id: TECH, actor_role: "TECH_SUPPORT_STAFF" },
    ]);
    expect(rows.every((row) => row.occurred_at instanceof Date)).toBe(true);
    const [finished] = await sql`select clock_timestamp() as at`;
    expect(rows.every((row) => row.occurred_at >= started!.at && row.occurred_at <= finished!.at)).toBe(true);
  });

  it.each(["EVENT_ORGANISER", "EVENT_COORDINATOR", "VENUE_STAFF", "ATTENDEE"])(
    "P2 AC5 refuses inventory and unavailability writes by %s and stores nothing",
    async (role) => {
      signedInAs(OTHER, role);
      const createResponse = await request(app).post("/api/v1/equipment/types").set(bearer).send(bulk());
      expect(createResponse.status).toBe(403);
      expect(createResponse.body.error.code).toBe("ROLE_NOT_AUTHORISED");
      expect(await sql`select 1 from equipment.equipment_types where created_by = ${OTHER}`).toHaveLength(0);

      signedInAs(TECH, "TECH_SUPPORT_STAFF");
      const chairs = await create();
      const before = (await request(app).get(`/api/v1/equipment/types/${chairs.id}`).set(bearer)).body;
      signedInAs(OTHER, role);
      const updateResponse = await request(app).put(`/api/v1/equipment/types/${chairs.id}`).set(bearer)
        .send(bulk({ name: chairs.name, totalQuantity: 99 }));
      const unavailableResponse = await request(app).post(`/api/v1/equipment/types/${chairs.id}/unavailability`).set(bearer)
        .send(unavailable());
      expect(updateResponse.status).toBe(403);
      expect(unavailableResponse.status).toBe(403);
      expect((await sql`select total_quantity from equipment.equipment_types where id = ${chairs.id}`)[0]!.total_quantity).toBe(20);
      expect(await sql`select 1 from equipment.unavailability where equipment_type_id = ${chairs.id}`).toHaveLength(0);
      expect(await sql`select 1 from equipment.inventory_history where equipment_type_id = ${chairs.id}`).toHaveLength(1);
      signedInAs(TECH, "TECH_SUPPORT_STAFF");
      expect((await request(app).get(`/api/v1/equipment/types/${chairs.id}`).set(bearer)).body).toEqual(before);
    },
  );
});
