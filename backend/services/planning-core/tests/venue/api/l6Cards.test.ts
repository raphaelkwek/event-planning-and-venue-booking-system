import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { TransactionSql } from "postgres";
import { parseCloudEvent } from "@connectsphere/contracts";
import { notificationsFor } from "../../../../notification/src/domain/recipients.js";
import { testDb } from "../../support/testDb.js";
import { actorsWithPrefix } from "../../support/lineFixtures.js";
import { deleteSeededEvents, seedEvent } from "../../support/seedEvent.js";
import { EVENT_END, EVENT_START } from "../../support/eventDates.js";
import { expireHoldIfDue, remindHoldIfDue } from "../../../src/modules/venue/repo/holds.js";

/**
 * The L6 cards (tests/L6, T1 to T9): tentative holds expire. The real Express app and the real repository
 * operations against a migrated Postgres, with JWT verification and the identity lookups replaced. The
 * timer is T10's (tests/temporal/holdExpiry.unit.test.ts): here the repository's expiry and reminder
 * operations are called directly, as the workflow's activities do. T3 reads F5's readiness through its
 * route and the venue module's index. T6 and T7 pass each stored message through the notification
 * service's recipient rule, the function that turns a message into a notice.
 */
vi.mock("../../../src/shared/auth/verifyJwt.js", () => ({
  verifyJwt: (req: { auth?: { supabaseUserId?: string } }, _res: unknown, next: () => void) => {
    req.auth = { supabaseUserId: "l6-card-subject" };
    next();
  },
}));
vi.mock("../../../src/modules/venue/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/venue/auth/identity.js")>(
    "../../../src/modules/venue/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn() };
});
vi.mock("../../../src/modules/change/auth/identity.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/modules/change/auth/identity.js")>(
    "../../../src/modules/change/auth/identity.js",
  );
  return { ...actual, resolveCurrentUser: vi.fn() };
});

const { resolveCurrentUser: resolveVenueUser } = await import("../../../src/modules/venue/auth/identity.js");
const { resolveCurrentUser: resolveChangeUser } = await import("../../../src/modules/change/auth/identity.js");
const { venueArrangementsForEvent } = await import("../../../src/modules/venue/index.js");
const { app } = await import("../../../src/app.js");

const sql = testDb();
const A = actorsWithPrefix("0f600000");
const VS2_ID = "0f600000-0000-4000-8000-000000000007";
const bearer = { Authorization: "Bearer l6-card-token" };
const UNKNOWN_HOLD = "00000000-0000-4000-8000-0000000000ff";

type Role = "EVENT_COORDINATOR" | "VENUE_STAFF" | "EVENT_ORGANISER";
function signedInAs(userId: string, role: Role) {
  const user = { id: userId, email: "l6@connectsphere.test", role };
  vi.mocked(resolveVenueUser).mockResolvedValue(user as never);
  vi.mocked(resolveChangeUser).mockResolvedValue(user as never);
}
const asC1 = () => signedInAs(A.c1, "EVENT_COORDINATOR");
const asC2 = () => signedInAs(A.c2, "EVENT_COORDINATOR");
const asVs = () => signedInAs(A.vs, "VENUE_STAFF");
const asVs2 = () => signedInAs(VS2_ID, "VENUE_STAFF");

/** "D hh:mm" of the cards: UTC on day D, sixty days ahead (tests/support/eventDates.ts); D-1 is the day before. */
const D = EVENT_START.slice(0, 10);
const DAY_BEFORE = new Date(Date.parse(`${D}T00:00:00.000Z`) - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const at = (time: string) => `${D}T${time}:00.000Z`;
const dayBefore = (time: string) => `${DAY_BEFORE}T${time}:00.000Z`;

/** A time in Singapore time, as the notices write it: "Wednesday 2 December 2026" and "18:00". */
function singapore(iso: string): { day: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Singapore",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return { day: `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}`, time: `${part("hour")}:${part("minute")}` };
}

const VENUE_NAME = "Lee Kong Chian Auditorium";
const EVENT_NAME = "Annual Research Symposium";
const open = { opensAt: "08:00", closesAt: "23:00" };
const HOURS = { monday: open, tuesday: open, wednesday: open, thursday: open, friday: open, saturday: open, sunday: open };

async function cleanUp() {
  const venues = sql`select id from venue.venues where created_by in ${sql([A.vs, VS2_ID])}`;
  const holds = sql`select id::text from venue.holds where venue_id in (${venues})`;
  const requests = sql`select id::text from venue.booking_requests where venue_id in (${venues})`;
  await sql`delete from venue.outbox where message_key in (${holds}) or message_key in (${requests})`;
  await sql`delete from venue.holds where venue_id in (${venues})`;
  await sql`delete from venue.booking_requests where venue_id in (${venues})`;
  await sql`delete from venue.venue_slots where venue_id in (${venues})`;
  await sql`delete from venue.venue_staff where venue_id in (${venues})`;
  await sql`delete from venue.venues where created_by in ${sql([A.vs, VS2_ID])}`;
  await deleteSeededEvents(sql, [A.org]);
}

beforeEach(cleanUp);
afterAll(async () => {
  await cleanUp();
  await sql.end();
});

/** FX-L6's venues: V (VS looks after it) and V2 (only VS2 does). */
async function newVenue(name: string, staffId: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into venue.venues (name, building, max_capacity, layouts, facilities, accessibility_features, operating_hours,
                              setup_minutes, turnaround_minutes, status, created_by, updated_by)
    values (${name}, 'L6 Test Building', 300, ${sql.json([{ name: "Theatre", capacity: 300 }])},
            ${["Projector"]}, ${["Step-free access"]}, ${sql.json(HOURS)}, 0, 0, 'ACTIVE', ${staffId}, ${staffId})
    returning id
  `;
  await sql`insert into venue.venue_staff (venue_id, user_id, created_by, updated_by) values (${row!.id}, ${staffId}, ${staffId}, ${staffId})`;
  return row!.id;
}

/** An Approved event owned by ORG and assigned to `coordinator` (E1 is C1's, E2 is C2's). */
async function newEvent(coordinator: string, name = EVENT_NAME): Promise<{ id: string; reference: string }> {
  const id = await seedEvent(sql, { ownerId: A.org, status: "APPROVED", endsAt: new Date(EVENT_END), name });
  await sql`insert into event.assignments (event_id, coordinator_id, assignment_rule) values (${id}, ${coordinator}, 'TEST_FIXTURE')`;
  const [row] = await sql<{ reference: string }[]>`select reference from event.events where id = ${id}`;
  return { id, reference: row!.reference };
}

const post = (path: string, body?: unknown) => request(app).post(path).set(bearer).send((body ?? {}) as object);
const patchExpiry = (id: string, body: unknown) => request(app).patch(`/api/v1/holds/${id}/expiry`).set(bearer).send(body as object);
const dayFromNow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

interface HoldOptions {
  eventId: string;
  venueId: string;
  coordinator?: string;
  placedBy?: string;
  startsAt?: string;
  endsAt?: string;
  expiresAt?: string;
  lead?: number;
}

/** Requests a hold as its coordinator (default C1) and returns it Requested. */
async function requestHold(o: HoldOptions): Promise<{ id: string; reference: string }> {
  signedInAs(o.coordinator ?? A.c1, "EVENT_COORDINATOR");
  const res = await post("/api/v1/holds", {
    eventId: o.eventId,
    venueId: o.venueId,
    startsAt: o.startsAt ?? at("10:00"),
    endsAt: o.endsAt ?? at("12:00"),
    reminderLeadMinutes: o.lead ?? 60,
  });
  expect(res.status).toBe(201);
  return res.body;
}

/** FX-L6's H1 (by default): requested by its coordinator, placed by VS, so HELD with a HELD slot. */
async function heldHold(o: HoldOptions): Promise<{ id: string; reference: string; slotId: string }> {
  const requested = await requestHold(o);
  signedInAs(o.placedBy ?? A.vs, "VENUE_STAFF");
  const placed = await post(`/api/v1/holds/${requested.id}/place`, { expiresAt: o.expiresAt ?? dayFromNow() });
  expect(placed.status).toBe(200);
  expect(placed.body.status).toBe("HELD");
  return placed.body;
}

/** FX-L6's "due" step: placed two hours ago, expired an hour ago, still HELD. */
async function backdate(holdId: string) {
  await sql`update venue.holds set placed_at = now() - interval '2 hours', expires_at = now() - interval '1 hour' where id = ${holdId}`;
}

/** The README's "Looking a hold up" query. */
async function lookUp(holdId: string) {
  const [row] = await sql<
    {
      reference: string;
      status: string;
      requested_by: string;
      placed_by: string | null;
      expires_at: Date | null;
      reminder_lead_minutes: number;
      reminded_at: Date | null;
      expired_at: Date | null;
      slot_status: string | null;
      slot_reference: string | null;
    }[]
  >`
    select h.reference, h.status, h.requested_by, h.placed_by, h.expires_at, h.reminder_lead_minutes,
           h.reminded_at, h.expired_at, s.status as slot_status, s.reference as slot_reference
    from venue.holds h left join venue.venue_slots s on s.id = h.slot_id
    where h.id = ${holdId}
  `;
  return row!;
}

/** The venue outbox messages about one hold, oldest first, parsed as CloudEvents. */
async function messagesOf(holdId: string, type?: string) {
  const rows = await sql<{ envelope: unknown }[]>`select envelope from venue.outbox where message_key = ${holdId} order by seq`;
  const all = rows.map((row) => parseCloudEvent(row.envelope));
  return type ? all.filter((message) => message.type === type) : all;
}

const inTx = <T>(work: (tx: TransactionSql) => Promise<T>): Promise<T> => sql.begin((tx) => work(tx)) as Promise<T>;

async function bookingRequestCount(eventId: string): Promise<number> {
  const [row] = await sql<{ n: number }[]>`select count(*)::int as n from venue.booking_requests where event_id = ${eventId}`;
  return row!.n;
}

describe("hold expiry (L6)", () => {
  it("L6-T1 expires a hold once its expiry has passed: Expired, kept, slot Expired, one hold-expired message", async () => {
    const venueId = await newVenue(VENUE_NAME, A.vs);
    const e1 = await newEvent(A.c1);
    const h1 = await heldHold({ eventId: e1.id, venueId });
    await backdate(h1.id);
    const before = await lookUp(h1.id);
    expect(before).toMatchObject({ status: "HELD", slot_status: "HELD", expired_at: null });

    const outcome = await inTx((tx) => expireHoldIfDue(tx, h1.id));

    expect(outcome).toEqual({ outcome: "expired" });
    const after = await lookUp(h1.id);
    expect(after).toMatchObject({
      reference: h1.reference,
      status: "EXPIRED",
      slot_status: "EXPIRED",
      requested_by: A.c1,
      placed_by: A.vs,
    });
    expect(after.expires_at).toEqual(before.expires_at);
    expect(Math.abs(Date.now() - after.expired_at!.getTime())).toBeLessThan(60_000);

    const messages = await messagesOf(h1.id, "venue-booking.hold-expired");
    expect(messages).toHaveLength(1);
    expect(messages[0]!.data).toMatchObject({
      holdId: h1.id,
      venueId,
      venueName: VENUE_NAME,
      startsAt: at("10:00"),
      endsAt: at("12:00"),
      expiresAt: before.expires_at!.toISOString(),
    });
  });

  it("L6-T2 frees the period: once H1 has expired, another event's hold on the same period is placed", async () => {
    const venueId = await newVenue(VENUE_NAME, A.vs);
    const e1 = await newEvent(A.c1);
    const e2 = await newEvent(A.c2, "L6 rival event");
    const h1 = await heldHold({ eventId: e1.id, venueId });
    await backdate(h1.id);
    expect(await inTx((tx) => expireHoldIfDue(tx, h1.id))).toEqual({ outcome: "expired" });
    const h2 = await requestHold({ eventId: e2.id, venueId, coordinator: A.c2 });

    asVs();
    const expiresAt = dayFromNow();
    const placed = await post(`/api/v1/holds/${h2.id}/place`, { expiresAt });

    expect(placed.status).toBe(200);
    expect(placed.body).toMatchObject({ id: h2.id, status: "HELD", expiresAt });
    expect(placed.body.error).toBeUndefined();
    expect(await lookUp(h2.id)).toMatchObject({ status: "HELD", slot_status: "HELD" });
    expect(await lookUp(h1.id)).toMatchObject({ status: "EXPIRED", slot_status: "EXPIRED" });
  });

  it("L6-T3 treats an expired hold as no booking: convert and release are refused with 409 and F5 does not count it", async () => {
    const venueId = await newVenue(VENUE_NAME, A.vs);
    const e1 = await newEvent(A.c1);
    const h1 = await heldHold({ eventId: e1.id, venueId });
    await backdate(h1.id);
    expect(await inTx((tx) => expireHoldIfDue(tx, h1.id))).toEqual({ outcome: "expired" });

    asC1();
    const convert = await post(`/api/v1/holds/${h1.id}/convert`, { layout: "Theatre", expectedAttendance: 150 });
    expect(convert.status).toBe(409);
    expect(convert.body.error.code).toBe("HOLD_NOT_HELD");
    expect(convert.body.error.message).toContain(`${h1.reference} is Expired`);

    const release = await post(`/api/v1/holds/${h1.id}/release`);
    expect(release.status).toBe(409);
    expect(release.body.error.code).toBe("HOLD_NOT_HELD");

    // F5: the venue is not arranged; the expired hold is not even listed as a tentative hold.
    const arrangements = await sql.begin((tx) => venueArrangementsForEvent(tx, e1.id));
    expect(arrangements.bookings).toEqual([]);
    expect(arrangements.requests).toEqual([]);
    const confirm = await post(`/api/v1/events/${e1.id}/confirmation`);
    expect(confirm.status).toBe(422);
    expect(confirm.body.error.code).toBe("ARRANGEMENTS_NOT_READY");
    expect(confirm.body.error.message).toBe("This event can't be confirmed yet. Venue: no venue booking is confirmed.");
    expect(confirm.body.error.details.venue).toEqual([{ kind: "NO_CONFIRMED_BOOKING" }]);
    const [event] = await sql<{ status: string }[]>`select status from event.events where id = ${e1.id}`;
    expect(event!.status).toBe("APPROVED");

    expect(await lookUp(h1.id)).toMatchObject({ status: "EXPIRED", slot_status: "EXPIRED" });
    expect(await bookingRequestCount(e1.id)).toBe(0);
  });

  it("L6-T4 expires at the expiry and not a second before it", async () => {
    const venueId = await newVenue(VENUE_NAME, A.vs);
    const e1 = await newEvent(A.c1);
    const h1 = await heldHold({ eventId: e1.id, venueId });

    // One second before: placed_at moves earlier so the constraint holds, expires_at is now() + 1 second.
    const notDue = await inTx(async (tx) => {
      const [moved] = await tx<{ expires_at: Date }[]>`
        update venue.holds set placed_at = now() - interval '1 hour', expires_at = now() + interval '1 second'
        where id = ${h1.id} returning expires_at
      `;
      return { moved: moved!.expires_at, outcome: await expireHoldIfDue(tx, h1.id) };
    });
    expect(notDue.outcome).toEqual({ outcome: "not-due", expiresAt: notDue.moved.toISOString() });
    expect(await lookUp(h1.id)).toMatchObject({ status: "HELD", slot_status: "HELD", expired_at: null });
    expect(await messagesOf(h1.id, "venue-booking.hold-expired")).toHaveLength(0);

    // Exactly at the expiry: expires_at = now() in the same transaction.
    const due = await inTx(async (tx) => {
      await tx`update venue.holds set expires_at = now() where id = ${h1.id}`;
      return expireHoldIfDue(tx, h1.id);
    });
    expect(due).toEqual({ outcome: "expired" });
    const after = await lookUp(h1.id);
    expect(after).toMatchObject({ status: "EXPIRED", slot_status: "EXPIRED" });
    expect(after.expired_at).not.toBeNull();
    expect(await messagesOf(h1.id, "venue-booking.hold-expired")).toHaveLength(1);
  });

  it("L6-T5 never expires a converted or a released hold", async () => {
    const venueId = await newVenue(VENUE_NAME, A.vs);
    const e3 = await newEvent(A.c1, "L6 converted event");
    const e4 = await newEvent(A.c1, "L6 released event");
    const h3 = await heldHold({ eventId: e3.id, venueId });
    const h4 = await heldHold({ eventId: e4.id, venueId, startsAt: at("13:00"), endsAt: at("15:00") });

    asC1();
    const converted = await post(`/api/v1/holds/${h3.id}/convert`, { layout: "Theatre", expectedAttendance: 150 });
    expect(converted.status).toBe(201);
    const released = await post(`/api/v1/holds/${h4.id}/release`);
    expect(released.status).toBe(200);
    await backdate(h3.id);
    await backdate(h4.id);

    expect(await inTx((tx) => expireHoldIfDue(tx, h3.id))).toEqual({ outcome: "gone", status: "CONVERTED" });
    expect(await inTx((tx) => expireHoldIfDue(tx, h4.id))).toEqual({ outcome: "gone", status: "RELEASED" });

    const converted3 = await lookUp(h3.id);
    expect(converted3).toMatchObject({ status: "CONVERTED", slot_status: "HELD", expired_at: null });
    expect(converted3.slot_reference).toBe(converted.body.request.reference);
    expect(converted3.slot_reference).toMatch(/^BKR-/);
    expect(await lookUp(h4.id)).toMatchObject({ status: "RELEASED", slot_status: "RELEASED", expired_at: null });
    expect(await messagesOf(h3.id, "venue-booking.hold-expired")).toHaveLength(0);
    expect(await messagesOf(h4.id, "venue-booking.hold-expired")).toHaveLength(0);
  });

  it("L6-T6 reminds the coordinator once, at the expiry minus the lead time", async () => {
    const venueId = await newVenue(VENUE_NAME, A.vs);
    const e1 = await newEvent(A.c1);
    const h1 = await heldHold({ eventId: e1.id, venueId, expiresAt: dayBefore("12:00"), lead: 60 });

    // One second before the reminder time: nothing is sent.
    const early = await inTx((tx) => remindHoldIfDue(tx, h1.id, new Date(`${DAY_BEFORE}T10:59:59.000Z`)));
    expect(early).toEqual({ outcome: "not-due", remindAt: dayBefore("11:00") });
    expect((await lookUp(h1.id)).reminded_at).toBeNull();
    expect(await messagesOf(h1.id, "venue-booking.hold-expiring")).toHaveLength(0);

    // At the reminder time: one reminder, and a second call sends nothing.
    const due = await inTx((tx) => remindHoldIfDue(tx, h1.id, new Date(dayBefore("11:00"))));
    expect(due.outcome).toBe("reminded");
    const remindedAt = (await lookUp(h1.id)).reminded_at;
    expect(remindedAt).not.toBeNull();
    const again = await inTx((tx) => remindHoldIfDue(tx, h1.id, new Date(dayBefore("11:00"))));
    expect(again).toEqual({ outcome: "already" });

    const after = await lookUp(h1.id);
    expect(after.reminded_at).toEqual(remindedAt);
    expect(after.status).toBe("HELD");
    const messages = await messagesOf(h1.id, "venue-booking.hold-expiring");
    expect(messages).toHaveLength(1);
    expect(messages[0]!.data).toMatchObject({ holdId: h1.id, coordinatorId: A.c1, venueName: VENUE_NAME, expiresAt: dayBefore("12:00") });

    const notices = (await messagesOf(h1.id)).flatMap((message) => notificationsFor(message));
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      recipientUserId: A.c1,
      notificationType: "venue-booking.hold-expiring",
      eventId: e1.id,
      eventReference: e1.reference,
      relatedReference: h1.reference,
    });
    const expiry = singapore(dayBefore("12:00"));
    expect(expiry.time).toBe("20:00");
    expect(notices[0]!.message).toContain(`on ${VENUE_NAME} for ${e1.reference} “${EVENT_NAME}”`);
    expect(notices[0]!.message).toContain(`${singapore(at("10:00")).day}, 18:00–20:00`);
    expect(notices[0]!.message).toContain(`expires on ${expiry.day}, 20:00`);
    expect(notices.map((notice) => notice.recipientUserId)).not.toContain(A.vs);
  });

  it("L6-T7 tells the coordinator once when the hold expires", async () => {
    const venueId = await newVenue(VENUE_NAME, A.vs);
    const e1 = await newEvent(A.c1);
    const h1 = await heldHold({ eventId: e1.id, venueId });
    await backdate(h1.id);
    const expiresAt = (await lookUp(h1.id)).expires_at!.toISOString();
    expect((await lookUp(h1.id)).reminded_at).toBeNull();

    expect(await inTx((tx) => expireHoldIfDue(tx, h1.id))).toEqual({ outcome: "expired" });
    expect(await inTx((tx) => expireHoldIfDue(tx, h1.id))).toEqual({ outcome: "gone", status: "EXPIRED" });

    const all = await messagesOf(h1.id);
    expect(all.filter((message) => message.type === "venue-booking.hold-expired")).toHaveLength(1);
    expect(all.filter((message) => message.type === "venue-booking.hold-expiring")).toHaveLength(0);

    const notices = all.flatMap((message) => notificationsFor(message));
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      recipientUserId: A.c1,
      notificationType: "venue-booking.hold-expired",
      eventId: e1.id,
      eventReference: e1.reference,
      relatedReference: h1.reference,
    });
    const expiry = singapore(expiresAt);
    expect(notices[0]!.message).toContain(`on ${VENUE_NAME} for ${e1.reference} “${EVENT_NAME}”`);
    expect(notices[0]!.message).toContain(`${singapore(at("10:00")).day}, 18:00–20:00`);
    expect(notices[0]!.message).toContain(`expired on ${expiry.day}, ${expiry.time}`);
    expect(notices.map((notice) => notice.recipientUserId)).not.toContain(A.vs);
  });

  it("L6-T8 lets Venue Staff move the expiry later: reminder armed again, one hold-expiry-changed message", async () => {
    const venueId = await newVenue(VENUE_NAME, A.vs);
    const e1 = await newEvent(A.c1);
    const h1 = await heldHold({ eventId: e1.id, venueId, expiresAt: dayBefore("12:00"), lead: 60 });
    expect(await inTx((tx) => remindHoldIfDue(tx, h1.id, new Date(dayBefore("11:00"))))).toMatchObject({ outcome: "reminded" });
    expect((await lookUp(h1.id)).reminded_at).not.toBeNull();

    asVs();
    const res = await patchExpiry(h1.id, { expiresAt: dayBefore("18:00") });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: h1.id, status: "HELD", expiresAt: dayBefore("18:00"), remindedAt: null });
    const row = await lookUp(h1.id);
    expect(row.expires_at!.toISOString()).toBe(dayBefore("18:00"));
    expect(row).toMatchObject({ reminded_at: null, status: "HELD", slot_status: "HELD" });
    const messages = await messagesOf(h1.id, "venue-booking.hold-expiry-changed");
    expect(messages).toHaveLength(1);
    expect(messages[0]!.data).toMatchObject({ holdId: h1.id, expiresAt: dayBefore("18:00"), reminderLeadMinutes: 60 });
  });

  it("L6-T9 refuses a bad or unauthorised expiry change and stores nothing", async () => {
    const v = await newVenue(VENUE_NAME, A.vs);
    const v2 = await newVenue("L6 Other Hall", VS2_ID);
    const e1 = await newEvent(A.c1);
    const e2 = await newEvent(A.c2, "L6 released event");
    const e5 = await newEvent(A.c1, "L6 other venue event");
    const h1 = await heldHold({ eventId: e1.id, venueId: v, expiresAt: dayBefore("12:00") });
    // H2 is a Released hold at V: placed, then released by its coordinator.
    const h2 = await heldHold({ eventId: e2.id, venueId: v, coordinator: A.c2, startsAt: at("13:00"), endsAt: at("15:00") });
    asC2();
    expect((await post(`/api/v1/holds/${h2.id}/release`)).status).toBe(200);
    // H5 is a Held hold at V2, which VS does not look after.
    const h5 = await heldHold({ eventId: e5.id, venueId: v2, placedBy: VS2_ID });
    const before = await lookUp(h1.id);
    const valid = { expiresAt: dayBefore("18:00") };
    const later = "The expiry must be later than now.";
    const missing = "Enter the expiry date and time.";
    const unparseable = "Enter a date and time with its offset, for example 2026-12-02T14:00+08:00.";
    const refusedWith = (res: request.Response, message: string) => {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
      expect(res.body.error.fields).toEqual([{ field: "expiresAt", message }]);
    };

    asVs();
    refusedWith(await patchExpiry(h1.id, { expiresAt: new Date(Date.now() - 60_000).toISOString() }), later);
    refusedWith(await patchExpiry(h1.id, { expiresAt: new Date().toISOString() }), later);
    refusedWith(await patchExpiry(h1.id, { expiresAt: "not-a-date" }), unparseable);
    refusedWith(await patchExpiry(h1.id, {}), missing);

    const released = await patchExpiry(h2.id, valid);
    expect(released.status).toBe(409);
    expect(released.body.error.code).toBe("HOLD_NOT_HELD");

    asVs2();
    const otherVenue = await patchExpiry(h1.id, valid);
    expect(otherVenue.status).toBe(404);
    expect(otherVenue.body.error.code).toBe("HOLD_NOT_FOUND");

    asC1();
    const coordinator = await patchExpiry(h1.id, valid);
    expect(coordinator.status).toBe(403);
    expect(coordinator.body.error.code).toBe("ROLE_NOT_AUTHORISED");

    asVs();
    const unknown = await patchExpiry(UNKNOWN_HOLD, valid);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("HOLD_NOT_FOUND");
    const notTheirs = await patchExpiry(h5.id, valid);
    expect(notTheirs.status).toBe(404);
    expect(notTheirs.body.error.code).toBe("HOLD_NOT_FOUND");

    const after = await lookUp(h1.id);
    expect(after.expires_at).toEqual(before.expires_at);
    expect(after.reminded_at).toEqual(before.reminded_at);
    const [changed] = await sql<{ n: number }[]>`
      select count(*)::int as n from venue.outbox
      where envelope->>'type' = 'venue-booking.hold-expiry-changed'
        and message_key in (select id::text from venue.holds where venue_id in ${sql([v, v2])})
    `;
    expect(changed!.n).toBe(0);
  });
});

describe("a reminder after the expiry (L6, not a card)", () => {
  it("does not remind when the expiry has passed: too-late, no hold-expiring message, reminded_at stays empty", async () => {
    const venueId = await newVenue(VENUE_NAME, A.vs);
    const e1 = await newEvent(A.c1);
    const h1 = await heldHold({ eventId: e1.id, venueId });
    await backdate(h1.id);

    expect(await inTx((tx) => remindHoldIfDue(tx, h1.id))).toEqual({ outcome: "too-late" });
    expect((await lookUp(h1.id)).reminded_at).toBeNull();
    expect(await messagesOf(h1.id, "venue-booking.hold-expiring")).toHaveLength(0);
  });
});

describe("Venue Staff's placed holds (L6, not a card)", () => {
  const placed = () => request(app).get("/api/v1/holds/placed").set(bearer);

  it("lists the held holds and the holds that expired in the last 14 days at the caller's venues, newest expiry first, and not requested, released, long-expired or other venues' holds", async () => {
    const v = await newVenue(VENUE_NAME, A.vs);
    const v2 = await newVenue("Second Venue", VS2_ID);
    const [e1, e2, e3, e4, e5, e6] = [
      await newEvent(A.c1),
      await newEvent(A.c2),
      await newEvent(A.c1),
      await newEvent(A.c2),
      await newEvent(A.c1),
      await newEvent(A.c2),
    ];
    const soon = await heldHold({ eventId: e1.id, venueId: v, expiresAt: dayFromNow() });
    const later = await heldHold({ eventId: e2.id, venueId: v, coordinator: A.c2, startsAt: at("13:00"), endsAt: at("15:00"), expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() });
    const expired = await heldHold({ eventId: e3.id, venueId: v, startsAt: at("16:00"), endsAt: at("18:00") });
    await backdate(expired.id);
    expect(await inTx((tx) => expireHoldIfDue(tx, expired.id))).toEqual({ outcome: "expired" });
    const longExpired = await heldHold({ eventId: e6.id, venueId: v, coordinator: A.c2, startsAt: at("16:00"), endsAt: at("18:00") });
    await backdate(longExpired.id);
    expect(await inTx((tx) => expireHoldIfDue(tx, longExpired.id))).toEqual({ outcome: "expired" });
    await sql`update venue.holds set expired_at = now() - interval '15 days' where id = ${longExpired.id}`;
    await requestHold({ eventId: e4.id, venueId: v, coordinator: A.c2, startsAt: at("19:00"), endsAt: at("20:00") });
    await heldHold({ eventId: e5.id, venueId: v2, placedBy: VS2_ID });

    asVs();
    const res = await placed();
    expect(res.status).toBe(200);
    expect(res.body.items.map((h: { id: string }) => h.id)).toEqual([later.id, soon.id, expired.id]);
    expect(res.body.items.map((h: { status: string }) => h.status)).toEqual(["HELD", "HELD", "EXPIRED"]);
    expect(res.body.items[0]).toMatchObject({ eventReference: e2.reference, venueName: VENUE_NAME });
    expect(res.body.items[2].expiredAt).toEqual(expect.any(String));

    asVs2();
    expect((await placed()).body.items).toHaveLength(1);

    asC1();
    const forbidden = await placed();
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("ROLE_NOT_AUTHORISED");
  });
});
