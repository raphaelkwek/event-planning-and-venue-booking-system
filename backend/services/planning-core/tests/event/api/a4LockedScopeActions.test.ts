import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import postgres, { type Sql } from "postgres";
import { randomUUID } from "node:crypto";
import { testDb } from "../../support/testDb.js";
import { isThrowawayDatabase } from "../../support/race.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";
import { assignForTest } from "../../support/assignment.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";
import { cleanVenueFixtures } from "../../support/venueFixtures.js";
import { cleanLineFixtures, createBulkType, insertLineDirect } from "../../support/lineFixtures.js";
import { closeActiveAssignment, findActiveAssignment, insertAssignment, lockEventForAssignment } from "../../../src/modules/event/repo/assignments.js";

/**
 * A4 (CR-05), the follow-up to tests/event/api/a4LockedScope.test.ts: D2, L1, L3 and O1 checked the
 * coordinator's scope before their transaction, so a Lead's reassignment (E4) that committed between
 * the check and the write let the outgoing coordinator act. Each action now checks the scope again
 * inside its transaction, under the event's row lock, as D4 and F5 do. Each test queues one action
 * behind an uncommitted reassignment, lets the Lead commit, and expects the action to find nothing
 * and store nothing.
 */

vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "a4-actions-subject" };
    next();
  },
}));
vi.mock("../../../src/modules/event/auth/identity.js", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveCurrentUser: vi.fn(),
}));
vi.mock("../../../src/modules/venue/auth/identity.js", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveCurrentUser: vi.fn(),
}));
vi.mock("../../../src/modules/equipment/auth/identity.js", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveCurrentUser: vi.fn(),
}));

const { resolveCurrentUser: resolveEventUser } = await import("../../../src/modules/event/auth/identity.js");
const { resolveCurrentUser: resolveVenueUser } = await import("../../../src/modules/venue/auth/identity.js");
const { resolveCurrentUser: resolveEquipmentUser } = await import("../../../src/modules/equipment/auth/identity.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
const OWNER = "0a4d0000-0000-4000-8000-000000000001";
const LEAD = "0a4d0000-0000-4000-8000-000000000002";
const OUTGOING = "0a4d0000-0000-4000-8000-000000000003";
const INCOMING = "0a4d0000-0000-4000-8000-000000000004";
const STAFF = "0a4d0000-0000-4000-8000-000000000005";
const TECH = "0a4d0000-0000-4000-8000-000000000006";
const bearer = { Authorization: "Bearer a4-actions-token" };
const NOT_ASSIGNED = "No event with that reference is assigned to you.";

function signedInAsOutgoing() {
  const user = { id: OUTGOING, email: "a4-actions@connectsphere.test", role: "EVENT_COORDINATOR" as const };
  for (const resolve of [resolveEventUser, resolveVenueUser, resolveEquipmentUser]) vi.mocked(resolve).mockResolvedValue(user);
}

async function cleanUp() {
  await cleanVenueFixtures(sql, STAFF);
  await cleanLineFixtures(sql, [OWNER], [TECH]);
  await deleteSeededEvents(sql, [OWNER]);
}

beforeEach(async () => {
  for (const resolve of [resolveEventUser, resolveVenueUser, resolveEquipmentUser]) vi.mocked(resolve).mockReset();
  await cleanUp();
});

afterAll(async () => {
  await cleanUp();
  await sql.end();
});

async function eventAssignedToOutgoing(status: "UNDER_REVIEW" | "APPROVED" | "PLANNING"): Promise<{ id: string; reference: string }> {
  const id = await seedEvent(sql, { ownerId: OWNER, status, endsAt: new Date(EVENT_END), name: "A4 Locked Scope Actions" });
  await assignForTest(sql, { id }, OUTGOING);
  const [row] = await sql<{ reference: string }[]>`select reference from event.events where id = ${id}`;
  return { id, reference: row!.reference };
}

const ALL_DAY = { opensAt: "00:00", closesAt: "24:00" };
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

async function newVenue(): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${`A4 Hall ${randomUUID().slice(0, 8)}`}, 'A4 Test Building', 300, ${sql.json([{ name: "Theatre", capacity: 300 }])},
            ${sql.json(Object.fromEntries(DAYS.map((day) => [day, ALL_DAY])))}, ${STAFF}, ${STAFF})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by, updated_by) values (${row!.id}, ${STAFF}, ${STAFF}, ${STAFF})`;
  return row!.id;
}

/** A hold of OUTGOING's at the venue for the event's period: Requested, or Held with its slot. */
async function holdOf(eventId: string, venueId: string, status: "REQUESTED" | "HELD"): Promise<string> {
  const reference = `HLD-${randomUUID().slice(0, 8)}`;
  let slotId: string | null = null;
  if (status === "HELD") {
    const [slot] = await sql<{ id: string }[]>`
      insert into venue.venue_slots (venue_id, event_id, reference, starts_at, ends_at, status, created_by, updated_by)
      values (${venueId}, ${eventId}, ${reference}, ${EVENT_START}, ${EVENT_END}, 'HELD', ${STAFF}, ${STAFF})
      returning id
    `;
    slotId = slot!.id;
  }
  const [hold] = await sql<{ id: string }[]>`
    insert into venue.holds (reference, event_id, venue_id, starts_at, ends_at, reminder_lead_minutes, status, requested_by,
                             slot_id, placed_by, placed_at, expires_at, created_by, updated_by)
    values (${reference}, ${eventId}, ${venueId}, ${EVENT_START}, ${EVENT_END}, 1440, ${status}, ${OUTGOING},
            ${slotId}, ${status === "HELD" ? STAFF : null}, ${status === "HELD" ? new Date() : null},
            ${status === "HELD" ? new Date(Date.now() + 7 * 86_400_000) : null}, ${OUTGOING}, ${OUTGOING})
    returning id
  `;
  return hold!.id;
}

/** Waits until another backend is blocked on a lock whose statement mentions `fragment`. */
async function waitUntilBlocked(fragment: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const rows = await sql`
      select 1 from pg_stat_activity where wait_event_type = 'Lock' and query ilike ${`%${fragment}%`} and pid <> pg_backend_pid()
    `;
    if (rows.length > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`nothing became blocked on "${fragment}"`);
}

const connection = (): Sql => postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

/**
 * The Lead reassigns the event from OUTGOING to INCOMING as E4's route does (row lock, close the
 * active assignment, insert the new one) and holds the commit. `act` starts, passes its scope check
 * outside the transaction (the reassignment isn't committed), queues behind the lock inside it, and
 * is let go when the Lead commits.
 */
async function whileTheLeadReassigns<T>(eventId: string, act: () => Promise<T>): Promise<T> {
  const leadConnection = connection();
  let commit!: () => void;
  const mayCommit = new Promise<void>((resolve) => (commit = resolve));
  let held!: () => void;
  const lockHeld = new Promise<void>((resolve) => (held = resolve));
  try {
    const lead = leadConnection.begin(async (tx) => {
      await lockEventForAssignment(tx, eventId);
      const current = (await findActiveAssignment(tx, eventId))!;
      await closeActiveAssignment(tx, current.id, LEAD);
      await insertAssignment(tx, eventId, INCOMING, "LEAD", LEAD);
      held();
      await mayCommit;
    });
    await lockHeld;
    const acting = act();
    await waitUntilBlocked("event.events");
    commit();
    await lead;
    return await acting;
  } finally {
    commit();
    await leadConnection.end();
  }
}

const count = async (rows: PromiseLike<readonly { n: number }[]>) => (await rows)[0]!.n;

describe.runIf(isThrowawayDatabase())("A4: a reassignment that commits while a coordinator's action waits for the event lock", () => {
  it("D2: the outgoing coordinator's clarification request is refused, and the event stays Under Review", async () => {
    const event = await eventAssignedToOutgoing("UNDER_REVIEW");
    signedInAsOutgoing();

    const res = await whileTheLeadReassigns(event.id, async () =>
      request(app).post(`/api/v1/events/${event.id}/clarifications`).set(bearer).send({ message: "Which hall did you want?" }),
    );

    expect(res.status, res.text).toBe(404);
    expect(res.body.error).toMatchObject({ code: "EVENT_NOT_FOUND", message: NOT_ASSIGNED });
    const [stored] = await sql<{ status: string }[]>`select status from event.events where id = ${event.id}`;
    expect(stored!.status).toBe("UNDER_REVIEW");
    expect(await count(sql<{ n: number }[]>`select count(*)::int as n from event.clarifications where event_id = ${event.id}`)).toBe(0);
    expect(await count(sql<{ n: number }[]>`select count(*)::int as n from event.outbox where message_key = ${event.id}`)).toBe(0);
  });

  it("L1: the outgoing coordinator's booking request is refused, and nothing is stored", async () => {
    const event = await eventAssignedToOutgoing("APPROVED");
    const venueId = await newVenue();
    signedInAsOutgoing();

    const res = await whileTheLeadReassigns(event.id, async () =>
      request(app)
        .post("/api/v1/booking-requests")
        .set(bearer)
        .send({
          eventId: event.id,
          venueId,
          startsAt: EVENT_START,
          endsAt: EVENT_END,
          layout: "Theatre",
          expectedAttendance: 150,
          facilities: [],
          accessibilityFeatures: [],
          justification: "A4 locked scope test.",
        }),
    );

    expect(res.status, res.text).toBe(404);
    expect(res.body.error).toMatchObject({ code: "EVENT_NOT_FOUND", message: NOT_ASSIGNED });
    expect(await count(sql<{ n: number }[]>`select count(*)::int as n from venue.booking_requests where event_id = ${event.id}`)).toBe(0);
  });

  it("L3: the outgoing coordinator's hold request is refused, and nothing is stored", async () => {
    const event = await eventAssignedToOutgoing("APPROVED");
    const venueId = await newVenue();
    signedInAsOutgoing();

    const res = await whileTheLeadReassigns(event.id, async () =>
      request(app)
        .post("/api/v1/holds")
        .set(bearer)
        .send({ eventId: event.id, venueId, startsAt: EVENT_START, endsAt: EVENT_END, reminderLeadMinutes: 1440 }),
    );

    expect(res.status, res.text).toBe(404);
    expect(res.body.error).toMatchObject({ code: "EVENT_NOT_FOUND", message: NOT_ASSIGNED });
    expect(await count(sql<{ n: number }[]>`select count(*)::int as n from venue.holds where event_id = ${event.id}`)).toBe(0);
  });

  it("L3: the outgoing coordinator's release of a hold is refused, and the hold stays Requested", async () => {
    const event = await eventAssignedToOutgoing("APPROVED");
    const holdId = await holdOf(event.id, await newVenue(), "REQUESTED");
    signedInAsOutgoing();

    const res = await whileTheLeadReassigns(event.id, async () => request(app).post(`/api/v1/holds/${holdId}/release`).set(bearer));

    expect(res.status, res.text).toBe(404);
    expect(res.body.error.code).toBe("HOLD_NOT_FOUND");
    const [stored] = await sql<{ status: string }[]>`select status from venue.holds where id = ${holdId}`;
    expect(stored!.status).toBe("REQUESTED");
  });

  it("L3: the outgoing coordinator's conversion of a hold is refused; the hold stays Held and no request is stored", async () => {
    const event = await eventAssignedToOutgoing("APPROVED");
    const holdId = await holdOf(event.id, await newVenue(), "HELD");
    signedInAsOutgoing();

    const res = await whileTheLeadReassigns(event.id, async () =>
      request(app)
        .post(`/api/v1/holds/${holdId}/convert`)
        .set(bearer)
        .send({ layout: "Theatre", expectedAttendance: 150, justification: "A4 locked scope test." }),
    );

    expect(res.status, res.text).toBe(404);
    expect(res.body.error).toMatchObject({ code: "EVENT_NOT_FOUND", message: NOT_ASSIGNED });
    const [stored] = await sql<{ status: string }[]>`select status from venue.holds where id = ${holdId}`;
    expect(stored!.status).toBe("HELD");
    expect(await count(sql<{ n: number }[]>`select count(*)::int as n from venue.booking_requests where event_id = ${event.id}`)).toBe(0);
  });

  it("O1: the outgoing coordinator's equipment request is refused, and no line is stored", async () => {
    const event = await eventAssignedToOutgoing("PLANNING");
    const chairs = await createBulkType(sql, TECH, `A4 Chairs ${randomUUID().slice(0, 8)}`, 10);
    signedInAsOutgoing();

    const res = await whileTheLeadReassigns(event.id, async () =>
      request(app)
        .post("/api/v1/equipment/request-lines")
        .set(bearer)
        .send({ eventId: event.id, lines: [{ equipmentTypeId: chairs.id, quantity: 2, notes: "" }] }),
    );

    expect(res.status, res.text).toBe(404);
    expect(res.body.error).toMatchObject({ code: "EVENT_NOT_FOUND", message: NOT_ASSIGNED });
    expect(await count(sql<{ n: number }[]>`select count(*)::int as n from equipment.equipment_request_lines where event_id = ${event.id}`)).toBe(0);
  });

  it("O1: the outgoing coordinator's edit of a line is refused, and the line keeps its quantity", async () => {
    const event = await eventAssignedToOutgoing("PLANNING");
    const chairs = await createBulkType(sql, TECH, `A4 Chairs ${randomUUID().slice(0, 8)}`, 10);
    const lineId = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: OUTGOING, quantity: 2 });
    signedInAsOutgoing();

    const res = await whileTheLeadReassigns(event.id, async () =>
      request(app).put(`/api/v1/equipment/request-lines/${lineId}`).set(bearer).send({ equipmentTypeId: chairs.id, quantity: 4, notes: "" }),
    );

    expect(res.status, res.text).toBe(404);
    expect(res.body.error.code).toBe("EQUIPMENT_LINE_NOT_FOUND");
    const [stored] = await sql<{ quantity: number; status: string }[]>`
      select quantity, status from equipment.equipment_request_lines where id = ${lineId}`;
    expect(stored).toEqual({ quantity: 2, status: "SUBMITTED" });
  });

  it("O1: the outgoing coordinator's removal of a line is refused, and the line stays Submitted", async () => {
    const event = await eventAssignedToOutgoing("PLANNING");
    const chairs = await createBulkType(sql, TECH, `A4 Chairs ${randomUUID().slice(0, 8)}`, 10);
    const lineId = await insertLineDirect(sql, { event, equipmentTypeId: chairs.id, requestedBy: OUTGOING, quantity: 2 });
    signedInAsOutgoing();

    const res = await whileTheLeadReassigns(event.id, async () =>
      request(app).post(`/api/v1/equipment/request-lines/${lineId}/removal`).set(bearer).send({}),
    );

    expect(res.status, res.text).toBe(404);
    expect(res.body.error.code).toBe("EQUIPMENT_LINE_NOT_FOUND");
    const [stored] = await sql<{ status: string }[]>`select status from equipment.equipment_request_lines where id = ${lineId}`;
    expect(stored!.status).toBe("SUBMITTED");
  });
});
