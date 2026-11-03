import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { EventStatus, Role } from "@connectsphere/contracts";
import { testDb } from "../../support/testDb.js";
import { actorsWithPrefix, cleanLineFixtures, createBulkType, insertLineDirect } from "../../support/lineFixtures.js";
import { seedEvent } from "../../support/seedEvent.js";
import { cleanVenueFixtures } from "../../support/venueFixtures.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";

// The A4 cards (tests/A4): real Express app and migrated Postgres, with JWT verification and each
// module's identity lookup replaced, so the signed-in user is whichever actor a step names. The
// access scope itself is the real one (identity's resolveAccessScope), which is what A4 changes.
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "a4-card-subject" };
    next();
  },
}));
vi.mock("../../../src/modules/event/auth/identity.js", async () => ({
  ...(await vi.importActual<object>("../../../src/modules/event/auth/identity.js")),
  resolveCurrentUser: vi.fn(),
}));
vi.mock("../../../src/modules/change/auth/identity.js", async () => ({
  ...(await vi.importActual<object>("../../../src/modules/change/auth/identity.js")),
  resolveCurrentUser: vi.fn(),
}));
vi.mock("../../../src/modules/equipment/auth/identity.js", async () => ({
  ...(await vi.importActual<object>("../../../src/modules/equipment/auth/identity.js")),
  resolveCurrentUser: vi.fn(),
}));
vi.mock("../../../src/modules/venue/auth/identity.js", async () => ({
  ...(await vi.importActual<object>("../../../src/modules/venue/auth/identity.js")),
  resolveCurrentUser: vi.fn(),
}));

const identities = [
  await import("../../../src/modules/event/auth/identity.js"),
  await import("../../../src/modules/change/auth/identity.js"),
  await import("../../../src/modules/equipment/auth/identity.js"),
  await import("../../../src/modules/venue/auth/identity.js"),
];
const { app } = await import("../../../src/app.js");

const sql = testDb();
const A = { ...actorsWithPrefix("0a400000"), lead: "0a400000-0000-4000-8000-000000000009" };
const bearer = { Authorization: "Bearer a4-card-token" };

function signedInAs(userId: string, role: Role) {
  const user = { id: userId, email: "a4@connectsphere.test", role };
  for (const identity of identities) vi.mocked(identity.resolveCurrentUser).mockResolvedValue(user);
}
const asC1 = () => signedInAs(A.c1, "EVENT_COORDINATOR");
const asC2 = () => signedInAs(A.c2, "EVENT_COORDINATOR");
const asLead = () => signedInAs(A.lead, "EVENT_COORDINATOR_LEAD");
const asOrg = () => signedInAs(A.org, "EVENT_ORGANISER");

const NOT_ASSIGNED = "No event with that reference is assigned to you.";
const onAnEventNotAssigned = (record: string) => `No ${record} with that id is on an event assigned to you.`;

const get = (path: string) => request(app).get(path).set(bearer);
const post = (path: string, body: object = {}) => request(app).post(path).set(bearer).send(body);

// ---------------------------------------------------------------------------------------------
// FX-A4 (tests/A4/README.md)
// ---------------------------------------------------------------------------------------------

interface Fixture {
  e1: string;
  e2: string;
  e3: string;
  e4: string;
  e5: string;
  e6: string;
  v1: string;
  v2: string;
  chairs: string;
  br1: string;
  h1: string;
  el1: string;
  cr1: string;
}

async function event(name: string, status: EventStatus, coordinatorId: string | null): Promise<string> {
  const id = await seedEvent(sql, { ownerId: A.org, status, endsAt: new Date(EVENT_END), name });
  if (coordinatorId) {
    await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule) values (${id}, ${coordinatorId}, 'TEST_FIXTURE')`;
  }
  return id;
}

async function venue(name: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, operating_hours, created_by, updated_by)
    values (${name}, 'A4 Test Building', 200, ${sql.json([{ name: "Theatre", capacity: 200 }])}, ${sql.json({})}, ${A.vs}, ${A.vs})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by, updated_by) values (${row!.id}, ${A.vs}, ${A.vs}, ${A.vs})`;
  return row!.id;
}

async function fixture(): Promise<Fixture> {
  const e1 = await event("A4 Under Review", "UNDER_REVIEW", A.c1);
  const e2 = await event("A4 Approved", "APPROVED", A.c1);
  await sql`update event.events set equipment_required = true where id = ${e2}`;
  const e3 = await event("A4 Unassigned", "SUBMITTED", null);
  const e4 = await event("A4 Other Coordinator", "UNDER_REVIEW", A.c2);
  const e5 = await event("A4 Draft", "SUBMITTED", null);
  await sql`update event.events set status = 'DRAFT' where id = ${e5}`;
  const e6 = await event("A4 Submitted", "SUBMITTED", A.c1);

  const tag = randomUUID().slice(0, 8);
  const v1 = await venue(`A4 Hall ${tag}`);
  const v2 = await venue(`A4 Annex ${tag}`);
  const chairs = (await createBulkType(sql, A.ts, `A4 Chairs ${tag}`, 10)).id;

  const [br1] = await sql<{ id: string }[]>`
    insert into venue.booking_requests (
      event_id, venue_id, starts_at, ends_at, layout, expected_attendance, event_starts_at, event_ends_at,
      event_attendance, differs_from_event, requested_by, created_by, updated_by
    ) values (
      ${e2}, ${v1}, ${EVENT_START}, ${EVENT_END}, 'Theatre', 150, ${EVENT_START}, ${EVENT_END}, 150, false,
      ${A.c1}, ${A.c1}, ${A.c1}
    )
    returning id
  `;
  const [h1] = await sql<{ id: string }[]>`
    insert into venue.holds (event_id, venue_id, starts_at, ends_at, reminder_lead_minutes, requested_by, created_by, updated_by)
    values (${e2}, ${v2}, ${EVENT_START}, ${EVENT_END}, 60, ${A.c1}, ${A.c1}, ${A.c1})
    returning id
  `;
  const [e2Row] = await sql<{ reference: string }[]>`select reference from event.events where id = ${e2}`;
  const el1 = await insertLineDirect(sql, {
    event: { id: e2, reference: e2Row!.reference },
    equipmentTypeId: chairs,
    requestedBy: A.c1,
    quantity: 5,
  });

  asOrg();
  const raised = await post(`/api/v1/events/${e2}/change-requests`, {
    reason: "More people registered",
    changes: { expectedAttendance: 120 },
  });
  expect(raised.status).toBe(201);

  return { e1, e2, e3, e4, e5, e6, v1, v2, chairs, br1: br1!.id, h1: h1!.id, el1, cr1: raised.body.id };
}

/** Everything a refusal must leave as it was: the events and every record on them, and each outbox. */
async function state(f: Fixture) {
  const ids = [f.e1, f.e2, f.e3, f.e4, f.e5, f.e6];
  return {
    events: await sql`
      select id, status, version, purpose, expected_attendance, decided_at, reviewing_coordinator_id
      from event.events where id in ${sql(ids)} order by id`,
    assignments: await sql`select event_id, coordinator_id, is_active from event.assignments where event_id in ${sql(ids)} order by id`,
    history: await sql`select count(*)::int as n from event.event_history where event_id in ${sql(ids)}`,
    clarifications: await sql`select count(*)::int as n from event.clarifications where event_id in ${sql(ids)}`,
    requests: await sql`select id, status from venue.booking_requests where event_id in ${sql(ids)} order by id`,
    holds: await sql`select id, status from venue.holds where event_id in ${sql(ids)} order by id`,
    slots: await sql`select count(*)::int as n from venue.venue_slots where event_id in ${sql(ids)}`,
    lines: await sql`select id, status, quantity from equipment.equipment_request_lines where event_id in ${sql(ids)} order by id`,
    changes: await sql`select id, status from change.change_requests where event_id in ${sql(ids)} order by id`,
    outboxes: await sql`
      select (select count(*) from event.outbox)::int as event, (select count(*) from venue.outbox)::int as venue,
             (select count(*) from equipment.outbox)::int as equipment, (select count(*) from change.outbox)::int as change`,
  };
}

/** A refusal as A4 words it: 404 with the code and message, and nothing of the event in the body. */
function expectNotAssigned(response: request.Response, code = "EVENT_NOT_FOUND", message = NOT_ASSIGNED) {
  expect(response.status, response.text).toBe(404);
  expect(response.body).toEqual({ error: { code, message, correlationId: expect.any(String) } });
}

async function clean() {
  const events = sql`select id from event.events where owner_id = ${A.org}`;
  const changes = sql`select id from change.change_requests where event_id in (${events})`;
  await sql`delete from change.outbox where message_key in (select id::text from (${events}) e)`;
  await sql`delete from change.change_request_fields where request_id in (${changes})`;
  await sql`delete from change.change_requests where event_id in (${events})`;
  await cleanVenueFixtures(sql, A.vs);
  await cleanLineFixtures(sql, [A.org], [A.ts]);
}

beforeEach(clean);
afterAll(async () => {
  await clean();
  await sql.end();
});

const ids = (response: request.Response) => (response.body.items as { id: string }[]).map((item) => item.id);

describe("A4 cards (tests/A4)", () => {
  it("A4-T1 a coordinator's event list holds only the events assigned to them", async () => {
    const f = await fixture();
    const all = [f.e1, f.e2, f.e3, f.e4, f.e5, f.e6];

    asC1();
    const mine = await get("/api/v1/events");
    expect(mine.status).toBe(200);
    expect(ids(mine).filter((id) => all.includes(id)).sort()).toEqual([f.e1, f.e2, f.e6].sort());
    for (const item of mine.body.items as { assignedCoordinatorId: string }[]) expect(item.assignedCoordinatorId).toBe(A.c1);
    for (const hidden of [f.e3, f.e4, f.e5]) expect(mine.text).not.toContain(hidden);

    asC2();
    const theirs = await get("/api/v1/events");
    expect(ids(theirs).filter((id) => all.includes(id))).toEqual([f.e4]);
  });

  it("A4-T2 a coordinator's review queue (D1) holds only the requests assigned to them", async () => {
    const f = await fixture();
    // E1 was submitted before E6, so it comes first.
    await sql`update event.events set submitted_at = now() - interval '1 day' where id = ${f.e1}`;
    const all = [f.e1, f.e2, f.e3, f.e4, f.e5, f.e6];

    asC1();
    const mine = await get("/api/v1/events/queue");
    expect(ids(mine).filter((id) => all.includes(id))).toEqual([f.e1, f.e6]);

    asC2();
    const theirs = await get("/api/v1/events/queue");
    expect(ids(theirs).filter((id) => all.includes(id))).toEqual([f.e4]);
  });

  it("A4-T3 opening an event not assigned to you returns no event data, the same as an unknown id, and claims nothing", async () => {
    const f = await fixture();
    const before = await state(f);

    asC2();
    for (const id of [f.e6, f.e3, f.e5, randomUUID()]) expectNotAssigned(await get(`/api/v1/events/${id}`));

    expect(await state(f)).toEqual(before);
    const [e6] = await sql`select status, reviewing_coordinator_id from event.events where id = ${f.e6}`;
    expect(e6).toEqual({ status: "SUBMITTED", reviewing_coordinator_id: null });
  });

  it("A4-T4 a coordinator not assigned to an event cannot ask for clarification, approve or reject it (D2, D4, D5)", async () => {
    const f = await fixture();
    const before = await state(f);

    asC2();
    expectNotAssigned(await post(`/api/v1/events/${f.e1}/clarifications`, { message: "Please confirm the expected attendance." }));
    expectNotAssigned(await post(`/api/v1/events/${f.e1}/approve`));
    expectNotAssigned(await post(`/api/v1/events/${f.e1}/reject`, { reason: "No suitable venue is available." }));

    expect(await state(f)).toEqual(before);
  });

  it("A4-T5 a coordinator not assigned to an event cannot edit its details, confirm its arrangements or record equipment for it (G1, F5, O1)", async () => {
    const f = await fixture();
    const before = await state(f);
    const [{ version }] = await sql<{ version: number }[]>`select version from event.events where id = ${f.e2}`;

    asC2();
    expectNotAssigned(
      await request(app)
        .patch(`/api/v1/events/${f.e2}`)
        .set(bearer)
        .set("If-Match", `"${version}"`)
        .send({ purpose: "Share faculty research across schools" }),
    );
    expectNotAssigned(await post(`/api/v1/events/${f.e2}/confirmation`));
    expectNotAssigned(
      await post("/api/v1/equipment/request-lines", {
        eventId: f.e2,
        lines: [{ equipmentTypeId: f.chairs, quantity: 2 }],
      }),
    );

    expect(await state(f)).toEqual(before);
  });

  it("A4-T6 a coordinator not assigned to an event cannot request a venue (L1, L4, L5) or a hold (L3) for it", async () => {
    const f = await fixture();
    const before = await state(f);
    const requestBody = (venueId: string, extra: object = {}) => ({
      eventId: f.e2,
      venueId,
      startsAt: EVENT_START,
      endsAt: EVENT_END,
      layout: "Theatre",
      expectedAttendance: 150,
      ...extra,
    });

    asC2();
    expectNotAssigned(await post("/api/v1/booking-requests", requestBody(f.v1)));
    expectNotAssigned(await post("/api/v1/booking-requests", requestBody(f.v2)));
    expectNotAssigned(await post("/api/v1/booking-requests", requestBody(f.v1, { replacesBookingId: f.br1 })));
    expectNotAssigned(
      await post("/api/v1/holds", {
        eventId: f.e2,
        venueId: f.v1,
        startsAt: EVENT_START,
        endsAt: EVENT_END,
        reminderLeadMinutes: 60,
      }),
    );

    expect(await state(f)).toEqual(before);
  });

  it("A4-T7 a coordinator not assigned to an event cannot act on its booking requests, holds, equipment lines or change requests (L2, L3, L6, O1, S2)", async () => {
    const f = await fixture();
    const before = await state(f);
    const attempts = (ids: { br: string; h: string; el: string; cr: string }) => [
      ["booking request", "BOOKING_REQUEST_NOT_FOUND", () => post(`/api/v1/booking-requests/${ids.br}/withdraw`)],
      ["hold", "HOLD_NOT_FOUND", () => post(`/api/v1/holds/${ids.h}/release`)],
      ["hold", "HOLD_NOT_FOUND", () => post(`/api/v1/holds/${ids.h}/convert`, { layout: "Theatre", expectedAttendance: 150 })],
      [
        "equipment request line",
        "EQUIPMENT_LINE_NOT_FOUND",
        () => request(app).put(`/api/v1/equipment/request-lines/${ids.el}`).set(bearer).send({ quantity: 3 }),
      ],
      ["equipment request line", "EQUIPMENT_LINE_NOT_FOUND", () => post(`/api/v1/equipment/request-lines/${ids.el}/removal`)],
      ["change request", "CHANGE_REQUEST_NOT_FOUND", () => post(`/api/v1/change-requests/${ids.cr}/decision`, { decision: "APPROVE" })],
    ] as const;

    asC2();
    const real = { br: f.br1, h: f.h1, el: f.el1, cr: f.cr1 };
    const unknown = { br: randomUUID(), h: randomUUID(), el: randomUUID(), cr: randomUUID() };
    for (const target of [real, unknown]) {
      for (const [record, code, attempt] of attempts(target)) {
        expectNotAssigned(await attempt(), code, onAnEventNotAssigned(record));
      }
    }

    expect(await state(f)).toEqual(before);
  });

  it("A4-T8 the assigned coordinator still performs each coordinator action on their own events", async () => {
    const f = await fixture();
    const [{ version }] = await sql<{ version: number }[]>`select version from event.events where id = ${f.e2}`;

    asC1();
    const asked = await post(`/api/v1/events/${f.e1}/clarifications`, { message: "Please confirm the expected attendance." });
    expect(asked.status, asked.text).toBe(201);
    const edited = await request(app)
      .patch(`/api/v1/events/${f.e2}`)
      .set(bearer)
      .set("If-Match", `"${version}"`)
      .send({ purpose: "Share faculty research across schools" });
    expect(edited.status, edited.text).toBe(200);
    const recorded = await post("/api/v1/equipment/request-lines", { eventId: f.e2, lines: [{ equipmentTypeId: f.chairs, quantity: 2 }] });
    expect(recorded.status, recorded.text).toBe(201);
    const released = await post(`/api/v1/holds/${f.h1}/release`);
    expect(released.status, released.text).toBe(200);
    const decided = await post(`/api/v1/change-requests/${f.cr1}/decision`, { decision: "REJECT", reason: "Attendance stays at 150." });
    expect(decided.status, decided.text).toBe(200);

    const [e1] = await sql`select status from event.events where id = ${f.e1}`;
    const [e2] = await sql`select purpose from event.events where id = ${f.e2}`;
    const [h1] = await sql`select status from venue.holds where id = ${f.h1}`;
    const [cr1] = await sql`select status from change.change_requests where id = ${f.cr1}`;
    expect({ e1: e1!.status, purpose: e2!.purpose, hold: h1!.status, change: cr1!.status }).toEqual({
      e1: "AWAITING_CLARIFICATION",
      purpose: "Share faculty research across schools",
      hold: "RELEASED",
      change: "REJECTED",
    });
    expect((await sql`select 1 from equipment.equipment_request_lines where event_id = ${f.e2}`).length).toBe(2);
  });

  it("A4-T9 the Lead, who sees every event, cannot perform coordinator actions on any of them", async () => {
    const f = await fixture();
    const before = await state(f);
    const [{ version }] = await sql<{ version: number }[]>`select version from event.events where id = ${f.e2}`;

    asLead();
    const attempts = [
      await post(`/api/v1/events/${f.e1}/approve`),
      await request(app)
        .patch(`/api/v1/events/${f.e2}`)
        .set(bearer)
        .set("If-Match", `"${version}"`)
        .send({ purpose: "Share faculty research across schools" }),
      await post("/api/v1/booking-requests", {
        eventId: f.e2,
        venueId: f.v1,
        startsAt: EVENT_START,
        endsAt: EVENT_END,
        layout: "Theatre",
        expectedAttendance: 150,
      }),
      await post(`/api/v1/change-requests/${f.cr1}/decision`, { decision: "APPROVE" }),
    ];
    for (const attempt of attempts) {
      expect(attempt.status, attempt.text).toBe(403);
      expect(attempt.body.error).toMatchObject({
        code: "ROLE_NOT_AUTHORISED",
        message: "Your role is not authorised to use this function.",
      });
    }

    expect(await state(f)).toEqual(before);
  });

  it("A4-T10 when the Lead reassigns an event, the previous coordinator loses it at once and the new coordinator gains it", async () => {
    const f = await fixture();
    // E4's reassignment, as its repo writes it: the active assignment ends and C2's begins.
    await sql`update event.assignments set is_active = false, ended_at = now() where event_id = ${f.e1} and is_active`;
    await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule) values (${f.e1}, ${A.c2}, 'TEST_FIXTURE')`;

    asC1();
    expect(ids(await get("/api/v1/events"))).not.toContain(f.e1);
    expect(ids(await get("/api/v1/events/queue"))).not.toContain(f.e1);
    expectNotAssigned(await get(`/api/v1/events/${f.e1}`));
    expectNotAssigned(await post(`/api/v1/events/${f.e1}/approve`));
    expect((await sql`select status from event.events where id = ${f.e1}`)[0]!.status).toBe("UNDER_REVIEW");

    asC2();
    expect(ids(await get("/api/v1/events"))).toContain(f.e1);
    expect(ids(await get("/api/v1/events/queue"))).toContain(f.e1);
    const opened = await get(`/api/v1/events/${f.e1}`);
    expect(opened.status).toBe(200);
    expect(opened.body.name).toBe("A4 Under Review");
    const approved = await post(`/api/v1/events/${f.e1}/approve`);
    expect(approved.status, approved.text).toBe(200);
    expect((await sql`select status from event.events where id = ${f.e1}`)[0]!.status).toBe("APPROVED");
  });

  it("A4-T11 the Lead sees every event and every assignment (E5)", async () => {
    const f = await fixture();
    const all = [f.e1, f.e2, f.e3, f.e4, f.e5, f.e6];

    asLead();
    const listed = await get("/api/v1/events");
    expect(ids(listed).filter((id) => all.includes(id)).sort()).toEqual([f.e1, f.e2, f.e3, f.e4, f.e6].sort());
    for (const id of [f.e4, f.e3]) {
      const opened = await get(`/api/v1/events/${id}`);
      expect(opened.status).toBe(200);
      expect(opened.body.id).toBe(id);
    }

    const overview = await get("/api/v1/assignments");
    expect(overview.status).toBe(200);
    const coordinatorOf = new Map(
      (overview.body.items as { id: string; assignedCoordinatorId: string | null }[]).map((item) => [item.id, item.assignedCoordinatorId]),
    );
    expect([f.e1, f.e2, f.e6, f.e4, f.e3].map((id) => coordinatorOf.get(id))).toEqual([A.c1, A.c1, A.c1, A.c2, null]);
  });

  it("A4-T12 a coordinator cannot see the unassigned queue or claim an unassigned request", async () => {
    const f = await fixture();
    const before = await state(f);

    asC1();
    for (const response of [await get("/api/v1/assignments/unassigned"), await post(`/api/v1/events/${f.e3}/assignment`, { coordinatorId: A.c1 })]) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("ROLE_NOT_AUTHORISED");
    }
    expectNotAssigned(await post(`/api/v1/events/${f.e3}/approve`));

    expect(await state(f)).toEqual(before);
    asLead();
    expect(ids(await get("/api/v1/assignments/unassigned"))).toContain(f.e3);
  });

  it("A4-T13 every read beneath an event not assigned to you returns no data", async () => {
    const f = await fixture();
    const reads = [
      [`/api/v1/events/${f.e2}/status-history`, "EVENT_NOT_FOUND", NOT_ASSIGNED],
      [`/api/v1/events/${f.e2}/status`, "EVENT_NOT_FOUND", NOT_ASSIGNED],
      [`/api/v1/events/${f.e1}/clarifications`, "EVENT_NOT_FOUND", NOT_ASSIGNED],
      [`/api/v1/events/${f.e2}/change-requests`, "EVENT_NOT_FOUND", NOT_ASSIGNED],
      [`/api/v1/events/${f.e2}/arrangement-flags`, "EVENT_NOT_FOUND", NOT_ASSIGNED],
      [`/api/v1/booking-requests?eventId=${f.e2}`, "EVENT_NOT_FOUND", NOT_ASSIGNED],
      [`/api/v1/holds?eventId=${f.e2}`, "EVENT_NOT_FOUND", NOT_ASSIGNED],
      [`/api/v1/equipment/request-lines?eventId=${f.e2}`, "EVENT_NOT_FOUND", NOT_ASSIGNED],
      [`/api/v1/equipment/request-lines/${f.el1}`, "EQUIPMENT_LINE_NOT_FOUND", onAnEventNotAssigned("equipment request line")],
      [`/api/v1/venues/search/prefill?eventId=${f.e2}`, "EVENT_NOT_FOUND", NOT_ASSIGNED],
      [`/api/v1/venues/${f.v1}/suitability?eventId=${f.e2}`, "EVENT_NOT_FOUND", NOT_ASSIGNED],
    ] as const;

    asC2();
    for (const [path, code, message] of reads) {
      const response = await get(path);
      expectNotAssigned(response, code, message);
      for (const id of [f.e1, f.e2, f.el1, f.br1, f.h1]) expect(response.text, path).not.toContain(id);
    }

    asC1();
    for (const [path] of reads) {
      const response = await get(path);
      expect(response.status, `${path} ${response.text}`).toBe(200);
    }
  });

  it("A4-T15 a coordinator not assigned to an event cannot cancel it (F3), so its arrangements are not released (F4)", async () => {
    const f = await fixture();
    const before = await state(f);

    asC2();
    expectNotAssigned(await post(`/api/v1/events/${f.e2}/cancellation`, { reason: "Not mine to cancel." }));

    expect(await state(f)).toEqual(before);
    const [e2] = await sql`select status, cancelled_at from event.events where id = ${f.e2}`;
    expect(e2).toEqual({ status: "APPROVED", cancelled_at: null });
  });
});
