import { describe, expect, it } from "vitest";
import { aListing, ATTENDEE, EVENT, NOW, OWNER, REG } from "../support/builders.js";
import { at, scriptedSql } from "../support/scriptedSql.js";
import {
  applyListing,
  closeListing,
  findListing,
  listingsOf,
  listOpenListings,
} from "../../src/repo/listings.js";
import {
  cancelRegistrationsOfEvent,
  DuplicateRegistrationError,
  findActiveRegistration,
  findRegistrationOfAttendee,
  insertManualRegistration,
  insertRegistration,
  listRegistrationsOfAttendee,
  listRegistrationsOfEvent,
  registrationCountsOf,
  withdrawRegistration,
} from "../../src/repo/registrations.js";
import { capacityOf, recordVenue, replaceVenue, venuesOf } from "../../src/repo/venues.js";
import {
  cancelEntriesOfEvent,
  closeEntryRegistered,
  DuplicateWaitlistEntryError,
  findEntryOfAttendee,
  findWaitingEntry,
  insertWaitlistEntry,
  listEntriesOfAttendee,
  listEntriesOfEvent,
  markWaitingNotified,
  waitingCountOf,
  withdrawEntry,
} from "../../src/repo/waitlist.js";

/**
 * What the repo layer does around its SQL: turning a row into the domain's
 * shape (dates to ISO text, nulls kept), passing the right values and paging
 * conditions, answering null when an update changed nothing, and naming the
 * refusal when the unique index fires. A scripted client stands in for Postgres;
 * the statements themselves run against it in the card tests (r1Cards.test.ts
 * to r7Cards.test.ts, seats.test.ts) in CI.
 */

const SEAT = "seat-1";
const registrationRow = (over: Record<string, unknown> = {}) => ({
  id: REG,
  reference: "REG-000001",
  event_id: EVENT,
  attendee_id: ATTENDEE,
  seat_id: SEAT,
  status: "REGISTERED",
  registered_at: at("2026-12-05T02:00:00.000Z"),
  withdrawn_at: null,
  cancelled_at: null,
  added_by: null,
  addition_reason: null,
  added_over_capacity: false,
  ...over,
});
const entryRow = (over: Record<string, unknown> = {}) => ({
  id: "44444444-4444-4444-8444-444444444444",
  reference: "WL-000001",
  event_id: EVENT,
  attendee_id: ATTENDEE,
  status: "WAITLISTED",
  joined_at: at("2026-12-05T02:00:00.000Z"),
  last_notified_at: null,
  registration_id: null,
  registered_at: null,
  withdrawn_at: null,
  cancelled_at: null,
  position: 2,
  ...over,
});
const listingRow = (over: Record<string, unknown> = {}) => ({
  event_id: EVENT,
  event_reference: "EVT-000123",
  name: "R Test Symposium",
  description: "A day of talks",
  owner_id: OWNER,
  assigned_coordinator_id: null,
  status: "CONFIRMED",
  starts_at: at("2026-12-16T06:00:00.000Z"),
  ends_at: at("2026-12-16T10:00:00.000Z"),
  registration_required: true,
  registration_opens_at: at("2026-12-01T01:00:00.000Z"),
  registration_closes_at: at("2026-12-10T10:00:00.000Z"),
  withdrawal_deadline_at: null,
  high_demand: false,
  ...over,
});
const uniqueViolation = (constraint: string) => Object.assign(new Error("duplicate key value"), { code: "23505", constraint_name: constraint });

describe("registrations repo", () => {
  it("reads a row into a registration with ISO dates and nulls kept", async () => {
    const sql = scriptedSql([{ match: /from registration\.registrations where event_id/, rows: [registrationRow({ withdrawn_at: at("2026-12-06T00:00:00.000Z"), added_by: OWNER, addition_reason: "VIP", added_over_capacity: true })] }]);
    const found = await findActiveRegistration(sql, EVENT, ATTENDEE);
    expect(found).toEqual({
      id: REG,
      reference: "REG-000001",
      eventId: EVENT,
      attendeeId: ATTENDEE,
      seatId: SEAT,
      status: "REGISTERED",
      registeredAt: "2026-12-05T02:00:00.000Z",
      withdrawnAt: "2026-12-06T00:00:00.000Z",
      cancelledAt: null,
      addedBy: OWNER,
      additionReason: "VIP",
      addedOverCapacity: true,
    });
    expect(sql.calls[0]!.values).toEqual([EVENT, ATTENDEE]);
    expect(sql.calls[0]!.text).toContain("status = 'REGISTERED'");
  });

  it("answers null when nothing is found, for an attendee's own lookup too", async () => {
    const sql = scriptedSql([{ match: /select/ }]);
    expect(await findActiveRegistration(sql, EVENT, ATTENDEE)).toBeNull();
    expect(await findRegistrationOfAttendee(sql, REG, ATTENDEE)).toBeNull();
    expect(sql.calls[1]!.values).toEqual([REG, ATTENDEE]);
  });

  it("inserts a self-registration for the attendee, recording who made it", async () => {
    const sql = scriptedSql([{ match: /insert into registration\.registrations/, rows: [registrationRow()] }]);
    const registration = await insertRegistration(sql, { eventId: EVENT, attendeeId: ATTENDEE, seatId: SEAT, at: NOW });
    expect(registration.id).toBe(REG);
    expect(sql.calls[0]!.values).toEqual([EVENT, ATTENDEE, SEAT, NOW, ATTENDEE, ATTENDEE]);
  });

  it("names the refusal when the one-active index fires, and passes any other error on", async () => {
    const dup = scriptedSql([{ match: /insert/, error: uniqueViolation("registrations_one_active_per_attendee") }]);
    await expect(insertRegistration(dup, { eventId: EVENT, attendeeId: ATTENDEE, seatId: SEAT, at: NOW })).rejects.toBeInstanceOf(DuplicateRegistrationError);
    await expect(insertManualRegistration(dup, { eventId: EVENT, attendeeId: ATTENDEE, seatId: null, at: NOW, addedBy: OWNER, reason: null })).rejects.toBeInstanceOf(DuplicateRegistrationError);

    const other = scriptedSql([{ match: /insert/, error: uniqueViolation("some_other_index") }]);
    await expect(insertRegistration(other, { eventId: EVENT, attendeeId: ATTENDEE, seatId: SEAT, at: NOW })).rejects.toThrow("duplicate key value");
    const broken = scriptedSql([{ match: /insert/, error: new Error("connection reset") }]);
    await expect(insertManualRegistration(broken, { eventId: EVENT, attendeeId: ATTENDEE, seatId: SEAT, at: NOW, addedBy: OWNER, reason: null })).rejects.toThrow("connection reset");
  });

  it("marks a manual addition over capacity exactly when it holds no seat", async () => {
    const sql = scriptedSql([{ match: /insert into registration\.registrations/, rows: [registrationRow({ seat_id: null, added_over_capacity: true })] }]);
    await insertManualRegistration(sql, { eventId: EVENT, attendeeId: ATTENDEE, seatId: null, at: NOW, addedBy: OWNER, reason: "VIP" });
    await insertManualRegistration(sql, { eventId: EVENT, attendeeId: ATTENDEE, seatId: SEAT, at: NOW, addedBy: OWNER, reason: null });
    expect(sql.calls[0]!.values).toEqual([EVENT, ATTENDEE, null, NOW, OWNER, "VIP", true, OWNER, OWNER]);
    expect(sql.calls[1]!.values[6]).toBe(false);
  });

  it("pages an event's registrations oldest first, asking for one more than the limit", async () => {
    const sql = scriptedSql([{ match: /order by registered_at, id/, rows: [registrationRow(), registrationRow({ id: "r2" })] }]);
    const first = await listRegistrationsOfEvent(sql, EVENT, 1, null);
    expect(first.map((r) => r.id)).toEqual([REG, "r2"]);
    expect(sql.calls[0]!.values).toEqual([EVENT, 2]);
    expect(sql.calls[0]!.text).not.toContain("(registered_at, id) >");

    await listRegistrationsOfEvent(sql, EVENT, 10, { registeredAt: "2026-12-05T02:00:00.000Z", id: REG });
    expect(sql.calls[1]!.text).toContain("(registered_at, id) > (?::timestamptz, ?::uuid)");
    expect(sql.calls[1]!.values).toEqual([EVENT, "2026-12-05T02:00:00.000Z", REG, 11]);
  });

  it("pages an attendee's own registrations newest first and only theirs", async () => {
    const sql = scriptedSql([{ match: /order by registered_at desc, id desc/, rows: [registrationRow()] }]);
    await listRegistrationsOfAttendee(sql, ATTENDEE, 25, null);
    await listRegistrationsOfAttendee(sql, ATTENDEE, 25, { registeredAt: "2026-12-05T02:00:00.000Z", id: REG });
    expect(sql.calls[0]!.text).toContain("where attendee_id = ?");
    expect(sql.calls[0]!.values).toEqual([ATTENDEE, 26]);
    expect(sql.calls[1]!.text).toContain("(registered_at, id) < (?::timestamptz, ?::uuid)");
  });

  it("counts an event's registrations by status", async () => {
    const counts = { registered: 3, withdrawn: 1, cancelled: 0, manuallyAdded: 1, addedOverCapacity: 0 };
    const sql = scriptedSql([{ match: /count\(\*\) filter/, rows: [counts] }]);
    expect(await registrationCountsOf(sql, EVENT)).toEqual(counts);
  });

  it("withdraws only a registration that is the attendee's and still registered", async () => {
    const done = scriptedSql([{ match: /set status = 'WITHDRAWN'/, rows: [registrationRow({ status: "WITHDRAWN", withdrawn_at: at("2026-12-06T00:00:00.000Z") })] }]);
    expect(await withdrawRegistration(done, REG, ATTENDEE, NOW)).toMatchObject({ status: "WITHDRAWN", withdrawnAt: "2026-12-06T00:00:00.000Z" });
    expect(done.calls[0]!.values).toEqual([NOW, ATTENDEE, REG, ATTENDEE]);
    expect(done.calls[0]!.text).toContain("status = 'REGISTERED'");

    const nothing = scriptedSql([{ match: /update/, rows: [] }]);
    expect(await withdrawRegistration(nothing, REG, ATTENDEE, NOW)).toBeNull();
  });

  it("cancels an event's registered registrations at the time given", async () => {
    const sql = scriptedSql([{ match: /set status = 'CANCELLED'/, rows: [registrationRow({ status: "CANCELLED", cancelled_at: at("2026-12-06T02:00:00.000Z") })] }]);
    const cancelled = await cancelRegistrationsOfEvent(sql, EVENT, "2026-12-06T02:00:00.000Z");
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]!.cancelledAt).toBe("2026-12-06T02:00:00.000Z");
    expect(sql.calls[0]!.values).toEqual(["2026-12-06T02:00:00.000Z", EVENT]);
  });
});

describe("listings repo", () => {
  it("reads a listing row into the domain's shape", async () => {
    const sql = scriptedSql([{ match: /from registration\.event_listings where event_id/, rows: [listingRow()] }]);
    expect(await findListing(sql, EVENT)).toEqual(aListing({ description: "A day of talks" }));
  });

  it("keeps a missing date as null", async () => {
    const sql = scriptedSql([{ match: /event_listings/, rows: [listingRow({ starts_at: null, ends_at: null, registration_opens_at: null, registration_closes_at: null, withdrawal_deadline_at: at("2026-12-14T10:00:00.000Z") })] }]);
    expect(await findListing(sql, EVENT)).toMatchObject({ startsAt: null, endsAt: null, registrationOpensAt: null, registrationClosesAt: null, withdrawalDeadlineAt: "2026-12-14T10:00:00.000Z" });
  });

  it("answers null for an unknown event", async () => {
    expect(await findListing(scriptedSql([{ match: /event_listings/ }]), EVENT)).toBeNull();
  });

  it("looks up several listings by id and leaves out an event with none, asking nothing for an empty list", async () => {
    const sql = scriptedSql([{ match: /event_id in/, rows: [listingRow()] }]);
    const found = await listingsOf(sql, [EVENT, "other"]);
    expect([...found.keys()]).toEqual([EVENT]);
    expect(sql.calls[0]!.values).toEqual([[EVENT, "other"]]);
    expect(await listingsOf(sql, [])).toEqual(new Map());
    expect(sql.calls).toHaveLength(1);
  });

  it("pages the open list soonest first from the cursor, limit plus one", async () => {
    const sql = scriptedSql([{ match: /order by starts_at, event_id/, rows: [listingRow()] }]);
    await listOpenListings(sql, NOW, 5, null);
    await listOpenListings(sql, NOW, 5, { startsAt: "2026-12-16T06:00:00.000Z", eventId: EVENT });
    expect(sql.calls[0]!.values).toEqual([NOW, 6]);
    expect(sql.calls[0]!.text).toContain("status = 'CONFIRMED' and registration_required");
    expect(sql.calls[1]!.values).toEqual([NOW, "2026-12-16T06:00:00.000Z", EVENT, 6]);
  });

  it("reports whether a snapshot was applied or was older than the one held", async () => {
    const data = {
      eventId: EVENT, eventReference: "EVT-000123", eventName: "N", ownerId: OWNER, assignedCoordinatorId: null, description: null, status: "CONFIRMED",
      proposedStartAt: null, proposedEndAt: null, registrationRequired: true, registrationOpensAt: null, registrationClosesAt: null,
      withdrawalDeadlineAt: null, highDemand: true, changedAt: "2026-12-05T00:00:00.000Z",
    };
    const applied = scriptedSql([{ match: /insert into registration\.event_listings/, rows: [{ event_id: EVENT }] }]);
    expect(await applyListing(applied, data as never)).toBe(true);
    expect(applied.calls[0]!.text).toContain("source_changed_at <= excluded.source_changed_at");
    expect(applied.calls[0]!.text).toContain("status <> 'CANCELLED'");
    const stale = scriptedSql([{ match: /insert into registration\.event_listings/, rows: [] }]);
    expect(await applyListing(stale, data as never)).toBe(false);
  });

  it("records an unheard-of event as cancelled, so a late listing cannot list it", async () => {
    const sql = scriptedSql([{ match: /insert into registration\.event_listings/ }]);
    await closeListing(sql, { eventId: EVENT, eventReference: "EVT-000123", eventName: "N", ownerId: OWNER, assignedCoordinatorId: null, cancelledAt: "2026-12-06T02:00:00.000Z" } as never);
    expect(sql.calls[0]!.text).toContain("'CANCELLED'");
    expect(sql.calls[0]!.values).toContain("2026-12-06T02:00:00.000Z");
  });
});

describe("venues repo", () => {
  it("sums the confirmed bookings' capacity and counts them", async () => {
    const sql = scriptedSql([{ match: /sum\(layout_capacity\)/, rows: [{ capacity: 120, confirmed_bookings: 2 }] }]);
    expect(await capacityOf(sql, EVENT)).toEqual({ capacity: 120, confirmedBookings: 2 });
    expect(sql.calls[0]!.text).toContain("status = 'CONFIRMED'");
  });

  it("groups venues by event, in order, with an empty list for an event with none", async () => {
    const sql = scriptedSql([
      { match: /from registration\.event_venues/, rows: [{ event_id: EVENT, venue_name: "Hall A", venue_location: "Level 2" }, { event_id: EVENT, venue_name: "Hall B", venue_location: null }] },
    ]);
    const venues = await venuesOf(sql, [EVENT, "lonely"]);
    expect(venues.get(EVENT)).toEqual([{ name: "Hall A", location: "Level 2" }, { name: "Hall B", location: null }]);
    expect(venues.get("lonely")).toEqual([]);
    expect(await venuesOf(sql, [])).toEqual(new Map());
    expect(sql.calls).toHaveLength(1);
  });

  it("records an approved venue idempotently on its booking, and retires a replaced one", async () => {
    const sql = scriptedSql([{ match: /insert into registration\.event_venues/ }, { match: /set status = 'REPLACED'/ }]);
    await recordVenue(sql, { eventId: EVENT, bookingId: "b1", venueId: "v1", venueName: "Hall A", venueLocation: null, layout: "THEATRE", layoutCapacity: 60, startsAt: "s", endsAt: "e" } as never);
    await replaceVenue(sql, "b1");
    expect(sql.calls[0]!.text).toContain("on conflict (booking_id) do nothing");
    expect(sql.calls[0]!.values).toEqual([EVENT, "b1", "v1", "Hall A", null, "THEATRE", 60, "s", "e"]);
    expect(sql.calls[1]!.values).toEqual(["b1"]);
  });
});

describe("waitlist repo", () => {
  it("reads an entry with its place in the line, and null once it has stopped waiting", async () => {
    const sql = scriptedSql([{ match: /from registration\.waitlist_entries w/, rows: [entryRow(), entryRow({ status: "WITHDRAWN", position: undefined, withdrawn_at: at("2026-12-06T00:00:00.000Z") })] }]);
    const waiting = await findWaitingEntry(sql, EVENT, ATTENDEE);
    expect(waiting).toMatchObject({ status: "WAITLISTED", position: 2, joinedAt: "2026-12-05T02:00:00.000Z", lastNotifiedAt: null });
    const entries = await listEntriesOfEvent(sql, EVENT, 10, null);
    expect(entries[1]).toMatchObject({ status: "WITHDRAWN", position: null, withdrawnAt: "2026-12-06T00:00:00.000Z" });
  });

  it("answers null for an entry that is not the attendee's", async () => {
    const sql = scriptedSql([{ match: /waitlist_entries/ }]);
    expect(await findWaitingEntry(sql, EVENT, ATTENDEE)).toBeNull();
    expect(await findEntryOfAttendee(sql, "x", ATTENDEE)).toBeNull();
    expect(sql.calls[1]!.values).toEqual(["x", ATTENDEE]);
  });

  it("joins the line, naming the refusal when the one-waiting index fires", async () => {
    const ok = scriptedSql([{ match: /insert into registration\.waitlist_entries/, rows: [entryRow()] }]);
    expect((await insertWaitlistEntry(ok, { eventId: EVENT, attendeeId: ATTENDEE, at: NOW })).reference).toBe("WL-000001");
    expect(ok.calls[0]!.values).toEqual([EVENT, ATTENDEE, NOW, ATTENDEE, ATTENDEE]);

    const dup = scriptedSql([{ match: /insert/, error: uniqueViolation("waitlist_one_waiting_per_attendee") }]);
    await expect(insertWaitlistEntry(dup, { eventId: EVENT, attendeeId: ATTENDEE, at: NOW })).rejects.toBeInstanceOf(DuplicateWaitlistEntryError);
    const other = scriptedSql([{ match: /insert/, error: new Error("connection reset") }]);
    await expect(insertWaitlistEntry(other, { eventId: EVENT, attendeeId: ATTENDEE, at: NOW })).rejects.toThrow("connection reset");
  });

  it("pages an attendee's entries newest first and an event's oldest first", async () => {
    const sql = scriptedSql([{ match: /waitlist_entries/, rows: [entryRow()] }]);
    await listEntriesOfAttendee(sql, ATTENDEE, 5, null);
    await listEntriesOfAttendee(sql, ATTENDEE, 5, { joinedAt: "2026-12-05T02:00:00.000Z", id: "e" });
    await listEntriesOfEvent(sql, EVENT, 5, { joinedAt: "2026-12-05T02:00:00.000Z", id: "e" });
    expect(sql.calls[0]!.text).toContain("order by joined_at desc, id desc");
    expect(sql.calls[1]!.text).toContain("(joined_at, id) < (?::timestamptz, ?::uuid)");
    expect(sql.calls[2]!.text).toContain("(joined_at, id) > (?::timestamptz, ?::uuid)");
    expect(sql.calls[0]!.values).toEqual([ATTENDEE, 6]);
  });

  it("counts the entries still waiting", async () => {
    const sql = scriptedSql([{ match: /count\(\*\)::int as n/, rows: [{ n: 7 }] }]);
    expect(await waitingCountOf(sql, EVENT)).toBe(7);
  });

  it("leaves only while waiting; null when the update changed nothing", async () => {
    const done = scriptedSql([{ match: /set status = 'WITHDRAWN'/, rows: [entryRow({ status: "WITHDRAWN" })] }]);
    expect(await withdrawEntry(done, "e", ATTENDEE, NOW)).toMatchObject({ status: "WITHDRAWN" });
    expect(done.calls[0]!.values).toEqual([NOW, ATTENDEE, "e", ATTENDEE]);
    expect(await withdrawEntry(scriptedSql([{ match: /update/ }]), "e", ATTENDEE, NOW)).toBeNull();
  });

  it("closes a waiting entry on registration, naming the registration, or null when none was waiting", async () => {
    const input = { eventId: EVENT, attendeeId: ATTENDEE, registrationId: REG, at: NOW, by: OWNER };
    const done = scriptedSql([{ match: /set status = 'REGISTERED'/, rows: [entryRow({ status: "REGISTERED", registration_id: REG })] }]);
    expect(await closeEntryRegistered(done, input)).toMatchObject({ status: "REGISTERED", registrationId: REG });
    expect(done.calls[0]!.values).toEqual([REG, NOW, OWNER, EVENT, ATTENDEE]);
    expect(await closeEntryRegistered(scriptedSql([{ match: /update/ }]), input)).toBeNull();
  });

  it("returns the entries it told in the order they joined, ties broken by id", async () => {
    const sql = scriptedSql([
      {
        match: /set last_notified_at/,
        rows: [
          entryRow({ id: "b", joined_at: at("2026-12-05T03:00:00.000Z") }),
          entryRow({ id: "z", joined_at: at("2026-12-05T02:00:00.000Z") }),
          entryRow({ id: "a", joined_at: at("2026-12-05T02:00:00.000Z") }),
        ],
      },
    ]);
    expect((await markWaitingNotified(sql, EVENT, NOW)).map((e) => e.id)).toEqual(["a", "z", "b"]);
  });

  it("cancels an event's waiting entries at the time given", async () => {
    const sql = scriptedSql([{ match: /set status = 'CANCELLED'/, rows: [entryRow({ status: "CANCELLED", cancelled_at: at("2026-12-06T02:00:00.000Z") })] }]);
    expect(await cancelEntriesOfEvent(sql, EVENT, "2026-12-06T02:00:00.000Z")).toMatchObject([{ status: "CANCELLED", cancelledAt: "2026-12-06T02:00:00.000Z" }]);
  });
});
