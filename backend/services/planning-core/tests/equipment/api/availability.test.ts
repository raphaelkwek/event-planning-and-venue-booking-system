import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { testDb } from "../../support/testDb.js";
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({ verifyJwt: (req: {auth?: unknown}, _res: unknown, next: () => void) => { req.auth = { supabaseUserId: "p1-api-subject" }; next(); } }));
vi.mock("../../../src/modules/equipment/auth/identity.js", async () => ({ ...await vi.importActual<typeof import("../../../src/modules/equipment/auth/identity.js")>("../../../src/modules/equipment/auth/identity.js"), resolveCurrentUser: vi.fn() }));
const { resolveCurrentUser, IdentityUnavailableError } = await import("../../../src/modules/equipment/auth/identity.js");
const { app } = await import("../../../src/app.js");
const sql = testDb();
const actor = "a8888888-0000-0000-0000-000000000011";
const period = { startsAt: "2026-12-01T09:00:00Z", endsAt: "2026-12-01T11:00:00Z", requestedQuantity: "7" };
async function cleanup() {
  const ours = sql`select id from equipment.equipment_types where created_by = ${actor}`;
  const units = sql`select id from equipment.equipment_units where equipment_type_id in (${ours})`;
  await sql`delete from equipment.unavailability where equipment_type_id in (${ours})`;
  await sql`delete from equipment.unit_reservations where unit_id in (${units})`;
  await sql`delete from equipment.bulk_reservations where equipment_type_id in (${ours})`;
  await sql`delete from equipment.equipment_units where equipment_type_id in (${ours})`;
  await sql`delete from equipment.equipment_types where id in (${ours})`;
}
beforeEach(async () => { await cleanup(); vi.mocked(resolveCurrentUser).mockResolvedValue({ id: actor, email: "p1@test.invalid", role: "TECH_SUPPORT_STAFF" }); });
afterAll(async () => { await cleanup(); await sql.end(); });
async function type(kind = "BULK", quantity = 10) {
  const [row] = await sql`insert into equipment.equipment_types (name, description, kind, total_quantity, created_by) values ('P1 isolated API type', 'P1 fixture', ${kind}, ${kind === "BULK" ? quantity : null}, ${actor}) returning id`;
  return row!.id as string;
}
const check = (id: string, query = period) => request(app).get(`/api/v1/equipment/types/${id}/availability`).query(query);
describe("P1 availability HTTP and persisted state", () => {
  it("uses the peak of touching bulk bookings and returns the shortfall without mutating stock", async () => {
    const id = await type();
    await sql`insert into equipment.bulk_reservations (equipment_type_id,event_id,event_reference,quantity,starts_at,ends_at,created_by) values
      (${id},${randomUUID()},'P1-API-A',4,'2026-12-01T09:00:00Z','2026-12-01T10:00:00Z',${actor}),
      (${id},${randomUUID()},'P1-API-B',4,'2026-12-01T10:00:00Z','2026-12-01T11:00:00Z',${actor})`;
    const before = await sql`select * from equipment.bulk_reservations where equipment_type_id=${id} order by id`;
    const response = await check(id);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ equipmentTypeId:id,kind:"BULK",totalQuantity:10,availableQuantity:6,requestedQuantity:7,shortfallQuantity:1,startsAt:"2026-12-01T09:00:00.000Z",endsAt:"2026-12-01T11:00:00.000Z" });
    expect(await sql`select * from equipment.bulk_reservations where equipment_type_id=${id} order by id`).toEqual(before);
    expect((await sql`select total_quantity from equipment.equipment_types where id=${id}`)[0]!.total_quantity).toBe(10);
  });
  it("counts serialized identity once when reserved and unavailable, and ignores released/removed rows", async () => {
    const id = await type("SERIALIZED");
    const units = await sql`insert into equipment.equipment_units (equipment_type_id,label) values (${id},'A'),(${id},'B'),(${id},'C') returning id`;
    await sql`insert into equipment.unit_reservations (unit_id,event_id,event_reference,starts_at,ends_at,status) values
      (${units[0]!.id},${randomUUID()},'P1-API-U','2026-12-01T09:00:00Z','2026-12-01T11:00:00Z','RESERVED'),
      (${units[1]!.id},${randomUUID()},'P1-API-R','2026-12-01T09:00:00Z','2026-12-01T11:00:00Z','RELEASED')`;
    await sql`insert into equipment.unavailability (equipment_type_id,unit_id,starts_at,ends_at,reason,status) values
      (${id},${units[0]!.id},'2026-12-01T09:00:00Z','2026-12-01T11:00:00Z','Repair','ACTIVE'),
      (${id},${units[1]!.id},'2026-12-01T09:00:00Z','2026-12-01T11:00:00Z','Finished','REMOVED')`;
    expect((await check(id)).body).toMatchObject({ totalQuantity:3,availableQuantity:2,shortfallQuantity:5 });
    const listing = await request(app).get("/api/v1/equipment/types");
    expect(listing.status).toBe(200);
    expect(listing.body.items).toContainEqual({id,name:"P1 isolated API type",description:"P1 fixture",kind:"SERIALIZED",totalQuantity:3});
  });
  it("counts only active overlapping bulk unavailability", async () => {
    const id = await type();
    await sql`insert into equipment.unavailability (equipment_type_id,quantity,starts_at,ends_at,reason,status) values
      (${id},3,'2026-12-01T09:00:00Z','2026-12-01T11:00:00Z','Repair','ACTIVE'),
      (${id},8,'2026-12-01T11:00:00Z','2026-12-01T12:00:00Z','Later','ACTIVE'),
      (${id},8,'2026-12-01T09:00:00Z','2026-12-01T11:00:00Z','Done','REMOVED')`;
    expect((await check(id)).body).toMatchObject({availableQuantity:7,shortfallQuantity:0});
  });
  it.each(["EVENT_COORDINATOR","EVENT_ORGANISER","VENUE_STAFF","ATTENDEE"])("refuses %s before equipment SQL", async (role) => {
    vi.mocked(resolveCurrentUser).mockResolvedValue({ id:actor,email:"p1@test.invalid",role:role as never });
    expect((await check(randomUUID())).status).toBe(403);
    expect((await request(app).get("/api/v1/equipment/types")).status).toBe(403);
  });
  it("returns the common identity outage refusal", async () => {
    vi.mocked(resolveCurrentUser).mockRejectedValue(new IdentityUnavailableError("isolated test outage"));
    const response = await check(randomUUID());
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("IDENTITY_UNAVAILABLE");
  });
  it.each([randomUUID(),"invalid-id"])("refuses absent equipment %s", async (id) => {
    const response = await check(id);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("EQUIPMENT_TYPE_NOT_FOUND");
  });
  it("refuses invalid period with a named field", async () => {
    const response = await check(randomUUID(), {...period,endsAt:period.startsAt});
    expect(response.status).toBe(400);
    expect(response.body.error.fields).toContainEqual(expect.objectContaining({field:"endsAt"}));
  });
});
