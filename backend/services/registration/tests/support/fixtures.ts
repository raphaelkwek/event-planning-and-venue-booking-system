import express from "express";
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import type { Sql } from "postgres";
import { handleMessage } from "../../src/consumer/handleApproval.js";
import { handleListingMessage } from "../../src/consumer/handleListing.js";
import type { UserSummary } from "@connectsphere/contracts";
import { CallerRefusedError, IdentityUnavailableError, type Authenticator } from "../../src/api/auth.js";
import type { Directory } from "../../src/api/directory.js";
import { registrationRouter } from "../../src/api/routes.js";

/**
 * Test fixtures for R1 to R4, against the real registration schema. Events
 * reach the service the way they do in production: as the messages
 * planning-core publishes, handled by the service's own consumer handlers
 * (CI has no Kafka). Every id is random, so tests never see each other's rows.
 */

export const OWNER = "00000000-0000-0000-0000-000000000001";
/** R5, R7: the coordinator every fixture event is assigned to, unless a test says otherwise. */
export const COORDINATOR = "00000000-0000-0000-0000-000000000002";
export const OPENS = "2026-12-01T01:00:00.000Z"; // Tuesday 1 December 2026, 09:00 SGT
export const CLOSES = "2026-12-10T10:00:00.000Z"; // Thursday 10 December 2026, 18:00 SGT
export const DEADLINE = "2026-12-14T10:00:00.000Z"; // Monday 14 December 2026, 18:00 SGT
export const STARTS = "2026-12-16T06:00:00.000Z"; // Wednesday 16 December 2026, 14:00 SGT
export const ENDS = "2026-12-16T10:00:00.000Z";
/** A moment inside the window, the default clock. */
export const DURING = new Date("2026-12-05T02:00:00.000Z");

const created = { events: new Set<string>(), messages: new Set<string>() };

function envelope(type: string, subject: string, data: Record<string, unknown>, source: string) {
  const id = randomUUID();
  created.messages.add(id);
  return JSON.stringify({
    specversion: "1.0",
    id,
    source,
    type,
    subject,
    time: new Date().toISOString(),
    datacontenttype: "application/json",
    traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    actor: `EVENT_ORGANISER:${OWNER}`,
    data,
  });
}

export interface ListingOptions {
  name?: string;
  description?: string | null;
  status?: string;
  registrationRequired?: boolean;
  opensAt?: string | null;
  closesAt?: string | null;
  deadline?: string | null;
  startsAt?: string;
  endsAt?: string;
  changedAt?: string;
  /** R5, R7: the assigned coordinator; COORDINATOR unless given, null for none. */
  coordinatorId?: string | null;
}

/** planning-core's event.listing-changed for an event, as its event module writes it. */
export function listingMessage(eventId: string, reference: string, o: ListingOptions = {}) {
  return envelope(
    "event.listing-changed",
    eventId,
    {
      eventId,
      eventReference: reference,
      eventName: o.name ?? "R Test Symposium",
      ownerId: OWNER,
      assignedCoordinatorId: o.coordinatorId === undefined ? COORDINATOR : o.coordinatorId,
      description: o.description === undefined ? "A one-day symposium for the school of computing." : o.description,
      status: o.status ?? "CONFIRMED",
      proposedStartAt: o.startsAt ?? STARTS,
      proposedEndAt: o.endsAt ?? ENDS,
      registrationRequired: o.registrationRequired ?? true,
      registrationOpensAt: o.opensAt === undefined ? OPENS : o.opensAt,
      registrationClosesAt: o.closesAt === undefined ? CLOSES : o.closesAt,
      withdrawalDeadlineAt: o.deadline === undefined ? DEADLINE : o.deadline,
      changedAt: o.changedAt ?? new Date().toISOString(),
    },
    "/connectsphere/planning-core/event",
  );
}

/** F3's event.cancelled for an event. */
export function cancelledMessage(eventId: string, reference: string, cancelledAt = "2026-12-06T02:00:00.000Z") {
  return envelope(
    "event.cancelled",
    eventId,
    {
      eventId,
      eventReference: reference,
      eventName: "R Test Symposium",
      ownerId: OWNER,
      assignedCoordinatorId: null,
      reason: "The speaker withdrew.",
      cancelledBy: OWNER,
      cancelledAt,
      bookings: [],
      reservations: [],
    },
    "/connectsphere/planning-core/event",
  );
}

/** The venue module's approval (M1) of one booking for the event, with its layout capacity. */
export function approvalMessage(
  eventId: string,
  o: { seats: number; venueName?: string; venueLocation?: string; replacedBookingId?: string; bookingId?: string },
) {
  const bookingId = o.bookingId ?? randomUUID();
  const requestId = randomUUID();
  const value = envelope(
    "venue-booking.request-approved",
    requestId,
    {
      bookingRequestId: requestId,
      reference: "BKR-000001",
      eventId,
      eventReference: "EVT-000123",
      eventName: "R Test Symposium",
      venueId: randomUUID(),
      venueName: o.venueName ?? "Lee Kong Chian Auditorium",
      venueLocation: o.venueLocation ?? "School of Computing, Level 1",
      startsAt: STARTS,
      endsAt: ENDS,
      coordinatorId: "00000000-0000-0000-0000-000000000002",
      ownerId: OWNER,
      decidedBy: "00000000-0000-0000-0000-000000000003",
      decidedAt: "2026-11-20T02:00:00.000Z",
      bookingId,
      replacedBookingId: o.replacedBookingId ?? null,
      layout: "Theatre",
      layoutCapacity: o.seats,
    },
    "/connectsphere/planning-core/venue",
  );
  return { value, bookingId };
}

let referenceNo = Math.floor(Math.random() * 900_000) + 100_000;

/**
 * An event that has reached the registration service: its listing, and one
 * confirmed venue with `seats` seats (or the venues given). Returns its id and reference.
 */
export async function anEvent(
  sql: Sql,
  o: ListingOptions & { seats?: number; venues?: { seats: number; venueName: string; venueLocation: string }[] } = {},
): Promise<{ eventId: string; reference: string; bookingIds: string[] }> {
  const eventId = randomUUID();
  const reference = `EVT-${String(referenceNo++).padStart(6, "0")}`;
  created.events.add(eventId);
  const listed = await handleListingMessage(listingMessage(eventId, reference, o), { sql });
  if (listed.outcome !== "applied") throw new Error(`listing not applied: ${JSON.stringify(listed)}`);
  const bookingIds: string[] = [];
  for (const venue of o.venues ?? [{ seats: o.seats ?? 3, venueName: "Lee Kong Chian Auditorium", venueLocation: "School of Computing, Level 1" }]) {
    const approval = approvalMessage(eventId, venue);
    const built = await handleMessage(approval.value, { sql });
    if (built.outcome !== "built") throw new Error(`seats not built: ${JSON.stringify(built)}`);
    bookingIds.push(approval.bookingId);
  }
  return { eventId, reference, bookingIds };
}

/** Removes everything the fixtures and the tests created. Test-only: src never deletes. */
export async function cleanUp(sql: Sql): Promise<void> {
  const events = [...created.events];
  const messages = [...created.messages];
  if (events.length) {
    await sql`delete from registration.outbox where message_key in (select id::text from registration.registrations where event_id in ${sql(events)})`;
    await sql`delete from registration.outbox where message_key in (select id::text from registration.waitlist_entries where event_id in ${sql(events)})`;
    await sql`delete from registration.waitlist_entries where event_id in ${sql(events)}`;
    await sql`delete from registration.registrations where event_id in ${sql(events)}`;
    await sql`delete from registration.seats where event_id in ${sql(events)}`;
    await sql`delete from registration.event_venues where event_id in ${sql(events)}`;
    await sql`delete from registration.event_listings where event_id in ${sql(events)}`;
  }
  if (messages.length) await sql`delete from registration.consumed_messages where message_id in ${sql(messages)}`;
  created.events.clear();
  created.messages.clear();
}

/** Remembers an event a test made by hand, so cleanUp removes it. */
export function track(eventId: string) {
  created.events.add(eventId);
}

/**
 * A stand-in for Supabase and identity. A token names its caller:
 * `attendee:<id>`, `organiser:<id>` and `coordinator:<id>` are signed in with
 * that role; `down` finds identity unreachable; `revoked` is refused by
 * identity; `bad` fails the signature check.
 */
export const fakeAuth: Authenticator = {
  async verifyToken(token) {
    if (token === "bad") throw new Error("signature verification failed");
  },
  async identify(token) {
    if (token === "down") throw new IdentityUnavailableError("connect ECONNREFUSED");
    if (token === "revoked") throw new CallerRefusedError(401, "UNAUTHENTICATED", "No active session for this token.");
    const [role, id] = token.split(":");
    const roles: Record<string, "EVENT_ORGANISER" | "EVENT_COORDINATOR" | "ATTENDEE"> = { organiser: "EVENT_ORGANISER", coordinator: "EVENT_COORDINATOR" };
    return { id: id!, email: `${role}@connectsphere.test`, role: roles[role!] ?? "ATTENDEE" };
  },
};

/**
 * A stand-in for identity's people lookups (R5 to R7). Every id is named
 * `Person <last 4 of the id>`, with an email, except the people in `known`;
 * an attendee is found for any email starting `attendee`, with the id
 * `attendees` gives it or a fixed one; `down@…` finds identity unreachable.
 */
export const ATTENDEE_ONE = "00000000-0000-0000-0000-000000000005";
export const directoryPeople = {
  known: new Map<string, UserSummary>([
    [ATTENDEE_ONE, { id: ATTENDEE_ONE, displayName: "Attendee One", email: "attendee@connectsphere.test" }],
    [OWNER, { id: OWNER, displayName: "Organiser One", email: "organiser@connectsphere.test" }],
    [COORDINATOR, { id: COORDINATOR, displayName: "Coordinator One", email: "coordinator@connectsphere.test" }],
  ]),
  attendees: new Map<string, string>(),
  namesDown: false,
};

export const fakeDirectory: Directory = {
  async namesOf(_token, ids) {
    if (directoryPeople.namesDown) throw new IdentityUnavailableError("connect ECONNREFUSED");
    return new Map(
      ids.map((id) => [id, directoryPeople.known.get(id) ?? { id, displayName: `Person ${id.slice(-4)}`, email: `${id.slice(-4)}@connectsphere.test` }]),
    );
  },
  async attendeeByEmail(_token, email) {
    if (email.startsWith("down@")) throw new IdentityUnavailableError("connect ECONNREFUSED");
    if (!email.startsWith("attendee")) return null;
    const id = directoryPeople.attendees.get(email) ?? ATTENDEE_ONE;
    return { id, displayName: email === "attendee@connectsphere.test" ? "Attendee One" : null, email };
  },
};

const noLimit: RequestHandler = (_req, _res, next) => next();

/** The registration API on its own, with the fake identity and directory, and a clock the test controls. */
export function appAt(sql: Sql, clock: { now: Date }) {
  const app = express();
  app.use(express.json());
  app.use(registrationRouter({ sql, auth: fakeAuth, limiter: noLimit, clock: () => clock.now, directory: fakeDirectory }));
  return app;
}

export const asAttendee = (id: string) => ({ Authorization: `Bearer attendee:${id}` });
export const asOrganiser = (id: string) => ({ Authorization: `Bearer organiser:${id}` });
export const asCoordinator = (id: string) => ({ Authorization: `Bearer coordinator:${id}` });

/** The waitlist messages written for the event's entries (R6), in order. */
export async function waitlistOutboxOf(sql: Sql, eventId: string) {
  return sql<{ type: string; key: string; data: Record<string, unknown>; actor: string }[]>`
    select envelope->>'type' as type, message_key as key, envelope->'data' as data, envelope->>'actor' as actor
    from registration.outbox
    where message_key in (select id::text from registration.waitlist_entries where event_id = ${eventId})
    order by seq`;
}

/** The event's places remaining, as R1 shows them. */
export async function placesOf(sql: Sql, eventId: string): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from registration.seats where event_id = ${eventId} and pool = 'PUBLIC' and status = 'FREE'`;
  return row!.n;
}

/** The registration messages written for the event's registrations, validated as the relay will. */
export async function outboxOf(sql: Sql, eventId: string) {
  return sql<{ type: string; key: string; data: Record<string, unknown>; actor: string }[]>`
    select envelope->>'type' as type, message_key as key, envelope->'data' as data, envelope->>'actor' as actor
    from registration.outbox
    where message_key in (select id::text from registration.registrations where event_id = ${eventId})
    order by seq`;
}
