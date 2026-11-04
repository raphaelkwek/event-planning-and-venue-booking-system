import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import type { Sql } from "postgres";
import type { UserSummary } from "@connectsphere/contracts";
import { errorHandler } from "../../src/errorHandler.js";
import type { Directory } from "../../src/api/directory.js";
import { IdentityUnavailableError } from "../../src/api/auth.js";
import { encodeCursor } from "../../src/api/http.js";
import { aListing, aRegistration, anEntry, ATTENDEE, EVENT, NOW, OWNER, REG } from "../support/builders.js";
import { fakeAuth } from "../support/fixtures.js";

/**
 * R1 to R7 — what each handler does with what the service layer tells it: the
 * status, the error code and the shape of every answer, and that a handler
 * never reaches past the service for a refusal's wording. The services and
 * repos are scripted here; the same routes run against Postgres in the card
 * tests (r1Cards.test.ts to r7Cards.test.ts).
 */

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  withdraw: vi.fn(),
  addManually: vi.fn(),
  joinWaitlist: vi.fn(),
  leaveWaitlist: vi.fn(),
  findListing: vi.fn(),
  listingsOf: vi.fn(),
  listOpenListings: vi.fn(),
  findRegistrationOfAttendee: vi.fn(),
  listRegistrationsOfAttendee: vi.fn(),
  listRegistrationsOfEvent: vi.fn(),
  registrationCountsOf: vi.fn(),
  placeCountsOf: vi.fn(),
  venuesOf: vi.fn(),
  capacityOf: vi.fn(),
  listEntriesOfAttendee: vi.fn(),
  listEntriesOfEvent: vi.fn(),
  waitingCountOf: vi.fn(),
}));

vi.mock("../../src/service/register.js", () => ({ register: mocks.register }));
vi.mock("../../src/service/withdraw.js", () => ({ withdraw: mocks.withdraw }));
vi.mock("../../src/service/addManually.js", () => ({ addManually: mocks.addManually }));
vi.mock("../../src/service/waitlist.js", () => ({ joinWaitlist: mocks.joinWaitlist, leaveWaitlist: mocks.leaveWaitlist }));
vi.mock("../../src/repo/listings.js", () => ({ findListing: mocks.findListing, listingsOf: mocks.listingsOf, listOpenListings: mocks.listOpenListings }));
vi.mock("../../src/repo/registrations.js", () => ({
  findRegistrationOfAttendee: mocks.findRegistrationOfAttendee,
  listRegistrationsOfAttendee: mocks.listRegistrationsOfAttendee,
  listRegistrationsOfEvent: mocks.listRegistrationsOfEvent,
  registrationCountsOf: mocks.registrationCountsOf,
}));
vi.mock("../../src/repo/seats.js", () => ({ placeCountsOf: mocks.placeCountsOf }));
vi.mock("../../src/repo/venues.js", () => ({ venuesOf: mocks.venuesOf, capacityOf: mocks.capacityOf }));
vi.mock("../../src/repo/waitlist.js", () => ({
  listEntriesOfAttendee: mocks.listEntriesOfAttendee,
  listEntriesOfEvent: mocks.listEntriesOfEvent,
  waitingCountOf: mocks.waitingCountOf,
}));

const { registrationRouter } = await import("../../src/api/routes.js");

const noLimit: RequestHandler = (_req, _res, next) => next();
const people = new Map<string, UserSummary>([[ATTENDEE, { id: ATTENDEE, displayName: "Attendee One", email: "attendee@connectsphere.test" }]]);
const directory: Directory = {
  namesOf: vi.fn(async (_token: string, ids: string[]) => new Map(ids.flatMap((id) => (people.has(id) ? [[id, people.get(id)!] as const] : [])))),
  attendeeByEmail: vi.fn(async (_token: string, email: string) => (email === "attendee@connectsphere.test" ? people.get(ATTENDEE)! : null)),
};

function appFor() {
  return express()
    .use(express.json())
    .use((req, res, next) => {
      res.setHeader("x-correlation-id", "corr-test");
      next();
    })
    .use(registrationRouter({ sql: {} as Sql, auth: fakeAuth, limiter: noLimit, clock: () => NOW, signingKey: "k".repeat(32), directory }))
    .use(errorHandler);
}

const attendee = { Authorization: `Bearer attendee:${ATTENDEE}` };
const organiser = { Authorization: `Bearer organiser:${OWNER}` };
const stranger = { Authorization: "Bearer organiser:99999999-0000-4000-8000-000000000009" };
const THEIRS = "66666666-6666-4666-8666-666666666666";
const counts = new Map([[EVENT, { freeSeats: 4, unseatedRegistrations: 1 }]]);
const venues = new Map([[EVENT, [{ name: "Hall A", location: "Level 2" }]]]);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(directory.namesOf).mockImplementation(async (_t, ids) => new Map(ids.flatMap((id) => (people.has(id) ? [[id, people.get(id)!] as const] : []))));
  vi.mocked(directory.attendeeByEmail).mockImplementation(async (_t, email) => (email === "attendee@connectsphere.test" ? people.get(ATTENDEE)! : null));
  mocks.findListing.mockResolvedValue(aListing({ ownerId: OWNER }));
  mocks.listingsOf.mockResolvedValue(new Map([[EVENT, aListing()]]));
  mocks.venuesOf.mockResolvedValue(venues);
  mocks.placeCountsOf.mockResolvedValue(counts);
  mocks.capacityOf.mockResolvedValue({ capacity: 5, confirmedBookings: 1 });
  mocks.registrationCountsOf.mockResolvedValue({ registered: 1, withdrawn: 0, cancelled: 0, manuallyAdded: 0, addedOverCapacity: 0 });
  mocks.waitingCountOf.mockResolvedValue(2);
});

describe("browse (R1)", () => {
  it("lists open events with places remaining (free seats less additions awaiting one), a short public cache and no next cursor on the last page", async () => {
    mocks.listOpenListings.mockResolvedValue([aListing()]);
    const res = await request(appFor()).get("/api/v1/open-events").set(attendee);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=5, stale-while-revalidate=30");
    expect(res.body).toMatchObject({ items: [{ eventId: EVENT, placesRemaining: 3, isFull: false, venues: [{ name: "Hall A" }] }], nextCursor: null });
    expect(mocks.listOpenListings).toHaveBeenCalledWith(expect.anything(), NOW, 25, null);
  });

  it("returns a cursor when there is another page, and reads it back", async () => {
    const second = aListing({ eventId: "77777777-7777-4777-8777-777777777777", startsAt: "2026-12-17T06:00:00.000Z" });
    mocks.listOpenListings.mockResolvedValue([aListing(), second]);
    mocks.venuesOf.mockResolvedValue(new Map([[EVENT, []]]));
    const first = await request(appFor()).get("/api/v1/open-events?limit=1").set(attendee);
    expect(first.body.items).toHaveLength(1);
    expect(first.body.nextCursor).toEqual(expect.any(String));

    mocks.listOpenListings.mockResolvedValue([]);
    const next = await request(appFor()).get(`/api/v1/open-events?limit=1&cursor=${first.body.nextCursor}`).set(attendee);
    expect(next.status).toBe(200);
    expect(mocks.listOpenListings).toHaveBeenLastCalledWith(expect.anything(), NOW, 1, { startsAt: aListing().startsAt, eventId: EVENT });
  });

  it.each([["limit=0"], ["limit=101"], ["limit=abc"], ["cursor=not-a-cursor"], [`cursor=${encodeCursor({ startsAt: "nope", eventId: "x" })}`]])(
    "refuses a malformed page request (%s) naming the field",
    async (query) => {
      const res = await request(appFor()).get(`/api/v1/open-events?${query}`).set(attendee);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({ code: "VALIDATION_FAILED", correlationId: "corr-test" });
      expect(res.body.error.fields[0].field).toBe(query.split("=")[0]);
      expect(mocks.listOpenListings).not.toHaveBeenCalled();
    },
  );

  it("shows one open event", async () => {
    const res = await request(appFor()).get(`/api/v1/open-events/${EVENT}`).set(attendee);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ eventId: EVENT, reference: "EVT-000123", highDemand: false });
  });

  it.each([
    ["a malformed id", "not-a-uuid", aListing()],
    ["an unknown event", EVENT, null],
    ["an event not listed any more", EVENT, aListing({ status: "CANCELLED" })],
  ])("answers EVENT_NOT_FOUND for %s", async (_why, id, listing) => {
    mocks.findListing.mockResolvedValue(listing);
    const res = await request(appFor()).get(`/api/v1/open-events/${id}`).set(attendee);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("EVENT_NOT_FOUND");
  });
});

describe("register (R2)", () => {
  const post = (body: unknown, headers: Record<string, string> = attendee) => request(appFor()).post("/api/v1/registrations").set(headers).send(body as object);
  const listing = aListing();

  it("registers and answers 201 with the registration and its event, passing the admission token on", async () => {
    mocks.register.mockResolvedValue({ ok: true, registration: aRegistration(), listing });
    mocks.listingsOf.mockResolvedValue(new Map([[EVENT, listing]]));
    const res = await request(appFor()).post("/api/v1/registrations").set(attendee).set("x-admission-token", "tok").set("x-correlation-id", "c-9").send({ eventId: EVENT });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: REG, status: "REGISTERED", event: { eventId: EVENT, name: "R Test Symposium", venues: [{ name: "Hall A" }] } });
    expect(mocks.register).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventId: EVENT, attendeeId: ATTENDEE, correlationId: "c-9", admission: { token: "tok", signingKey: "k".repeat(32) } }));
  });

  it("D7: answers with the places remaining just after the registration, read live, so the event page needn't re-read its cached copy", async () => {
    mocks.register.mockResolvedValue({ ok: true, registration: aRegistration(), listing });
    mocks.placeCountsOf.mockResolvedValue(new Map([[EVENT, { freeSeats: 2, unseatedRegistrations: 0 }]]));
    const res = await post({ eventId: EVENT });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: REG, placesRemaining: 2 });
    expect(res.headers["cache-control"] ?? "").not.toContain("public");
    expect(mocks.placeCountsOf).toHaveBeenCalledWith(expect.anything(), [EVENT]);
  });

  it("refuses a missing or malformed eventId with the field named, before the service", async () => {
    for (const body of [{}, { eventId: 7 }, { eventId: "nope" }]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(res.body.error.fields).toEqual([{ field: "eventId", message: "Give the event's id." }]);
    }
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("refuses staff: only attendees register", async () => {
    const res = await post({ eventId: EVENT }, organiser);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ROLE_NOT_AUTHORISED");
  });

  it.each([
    [{ ok: false, code: "EVENT_NOT_FOUND" }, 404, "EVENT_NOT_FOUND"],
    [{ ok: false, code: "OUTSIDE_WINDOW", listing, state: "CLOSED" }, 422, "REGISTRATION_OUTSIDE_WINDOW"],
    [{ ok: false, code: "DUPLICATE", listing, existing: aRegistration({ reference: "REG-000009" }) }, 409, "REGISTRATION_DUPLICATE"],
    [{ ok: false, code: "FULL", listing }, 409, "REGISTRATION_FULL"],
    [{ ok: false, code: "ADMISSION_REQUIRED", listing }, 403, "ADMISSION_REQUIRED"],
    [{ ok: false, code: "ADMISSION_EXPIRED", listing }, 403, "ADMISSION_EXPIRED"],
    [{ ok: false, code: "WAITING_ROOM_UNAVAILABLE", listing }, 503, "WAITING_ROOM_UNAVAILABLE"],
  ])("maps the service's refusal %j to %i %s", async (outcome, status, code) => {
    mocks.register.mockResolvedValue(outcome);
    const res = await post({ eventId: EVENT });
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
    expect(res.body.error.message).toEqual(expect.any(String));
  });

  it("explains a refusal with details a client can act on", async () => {
    mocks.register.mockResolvedValue({ ok: false, code: "OUTSIDE_WINDOW", listing, state: "NOT_YET_OPEN" });
    const early = await post({ eventId: EVENT });
    expect(early.body.error.details).toEqual({ registrationOpensAt: listing.registrationOpensAt, registrationClosesAt: listing.registrationClosesAt });

    mocks.register.mockResolvedValue({ ok: false, code: "FULL", listing });
    expect((await post({ eventId: EVENT })).body.error.details).toEqual({ eventId: EVENT, placesRemaining: 0, waitlistOffered: true });

    mocks.register.mockResolvedValue({ ok: false, code: "DUPLICATE", listing, existing: aRegistration({ reference: "REG-000009" }) });
    expect((await post({ eventId: EVENT })).body.error.details).toMatchObject({ registrationId: REG, registrationReference: "REG-000009" });
  });

  it("answers 500 INTERNAL_ERROR without the cause when the service fails", async () => {
    mocks.register.mockRejectedValue(new Error("password authentication failed"));
    const res = await post({ eventId: EVENT });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(res.text).not.toContain("password");
  });
});

describe("my registrations (R3)", () => {
  it("lists the caller's registrations with their events, newest first, and a cursor for more", async () => {
    const older = aRegistration({ id: THEIRS, registeredAt: "2026-12-04T02:00:00.000Z" });
    mocks.listRegistrationsOfAttendee.mockResolvedValue([aRegistration(), older]);
    const res = await request(appFor()).get("/api/v1/registrations?limit=1").set(attendee);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ id: REG, event: { reference: "EVT-000123" } });
    expect(JSON.parse(Buffer.from(res.body.nextCursor, "base64url").toString())).toEqual({ registeredAt: aRegistration().registeredAt, id: REG });
    expect(mocks.listRegistrationsOfAttendee).toHaveBeenCalledWith(expect.anything(), ATTENDEE, 1, null);
  });

  it("returns no cursor and no items for an attendee with none", async () => {
    mocks.listRegistrationsOfAttendee.mockResolvedValue([]);
    const res = await request(appFor()).get("/api/v1/registrations").set(attendee);
    expect(res.body).toEqual({ items: [], nextCursor: null });
  });

  it("refuses a malformed cursor", async () => {
    const res = await request(appFor()).get("/api/v1/registrations?cursor=%25%25").set(attendee);
    expect(res.status).toBe(400);
    expect(res.body.error.fields[0].field).toBe("cursor");
  });

  it("shows one of the caller's own", async () => {
    mocks.findRegistrationOfAttendee.mockResolvedValue(aRegistration());
    const res = await request(appFor()).get(`/api/v1/registrations/${REG}`).set(attendee);
    expect(res.status).toBe(200);
    expect(mocks.findRegistrationOfAttendee).toHaveBeenCalledWith(expect.anything(), REG, ATTENDEE);
  });

  it("answers 404 for someone else's, an unknown one and a malformed id alike", async () => {
    mocks.findRegistrationOfAttendee.mockResolvedValue(null);
    for (const id of [THEIRS, "garbage"]) {
      const res = await request(appFor()).get(`/api/v1/registrations/${id}`).set(attendee);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("REGISTRATION_NOT_FOUND");
    }
  });
});

describe("withdraw (R4)", () => {
  const post = (id = REG) => request(appFor()).post(`/api/v1/registrations/${id}/withdrawal`).set(attendee);

  it("withdraws and answers the withdrawn registration", async () => {
    const withdrawn = aRegistration({ status: "WITHDRAWN", withdrawnAt: NOW.toISOString() });
    mocks.withdraw.mockResolvedValue({ ok: true, registration: withdrawn, listing: aListing() });
    const res = await post();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "WITHDRAWN", withdrawnAt: NOW.toISOString() });
  });

  it("answers 404 for a malformed id without calling the service", async () => {
    const res = await post("garbage");
    expect(res.status).toBe(404);
    expect(mocks.withdraw).not.toHaveBeenCalled();
  });

  it.each([
    [{ ok: false, code: "NOT_FOUND" }, 404, "REGISTRATION_NOT_FOUND"],
    [{ ok: false, code: "NOT_ACTIVE", registration: aRegistration({ status: "CANCELLED" }) }, 409, "REGISTRATION_NOT_ACTIVE"],
    [
      { ok: false, code: "DEADLINE_PASSED", registration: aRegistration(), listing: aListing(), deadline: { at: "2026-12-04T10:00:00.000Z", isEventStart: false } },
      422,
      "WITHDRAWAL_DEADLINE_PASSED",
    ],
  ])("maps the service's refusal %j to %i %s", async (outcome, status, code) => {
    mocks.withdraw.mockResolvedValue(outcome);
    const res = await post();
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });

  it("states the status it found, or the deadline it applied", async () => {
    mocks.withdraw.mockResolvedValue({ ok: false, code: "NOT_ACTIVE", registration: aRegistration({ status: "WITHDRAWN" }) });
    expect((await post()).body.error.details).toEqual({ status: "WITHDRAWN" });
    mocks.withdraw.mockResolvedValue({
      ok: false,
      code: "DEADLINE_PASSED",
      registration: aRegistration(),
      listing: aListing(),
      deadline: { at: "2026-12-04T10:00:00.000Z", isEventStart: false },
    });
    expect((await post()).body.error.details).toEqual({ withdrawalDeadline: "2026-12-04T10:00:00.000Z" });
  });
});

describe("the waitlist, attendee side (R6)", () => {
  const listing = aListing();
  const join = () => request(appFor()).post(`/api/v1/events/${EVENT}/waitlist`).set(attendee);

  it("joins and answers 201 with the entry and its event", async () => {
    mocks.joinWaitlist.mockResolvedValue({ ok: true, entry: anEntry({ position: 3 }), listing });
    const res = await join();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "WAITLISTED", position: 3, event: { eventId: EVENT, name: "R Test Symposium" } });
  });

  it("answers 404 for a malformed event id without calling the service", async () => {
    const res = await request(appFor()).post("/api/v1/events/garbage/waitlist").set(attendee);
    expect(res.status).toBe(404);
    expect(mocks.joinWaitlist).not.toHaveBeenCalled();
  });

  it.each([
    [{ ok: false, code: "EVENT_NOT_FOUND" }, 404, "EVENT_NOT_FOUND"],
    [{ ok: false, code: "OUTSIDE_WINDOW", listing, state: "CLOSED" }, 422, "REGISTRATION_OUTSIDE_WINDOW"],
    [{ ok: false, code: "PLACES_AVAILABLE", listing, placesRemaining: 2 }, 409, "WAITLIST_PLACES_AVAILABLE"],
    [{ ok: false, code: "REGISTERED", listing, registration: aRegistration() }, 409, "REGISTRATION_DUPLICATE"],
    [{ ok: false, code: "DUPLICATE", listing, existing: anEntry() }, 409, "WAITLIST_DUPLICATE"],
  ])("maps the service's refusal %j to %i %s", async (outcome, status, code) => {
    mocks.joinWaitlist.mockResolvedValue(outcome);
    const res = await join();
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });

  it("gives the details of each waitlist refusal", async () => {
    mocks.joinWaitlist.mockResolvedValue({ ok: false, code: "PLACES_AVAILABLE", listing, placesRemaining: 2 });
    expect((await join()).body.error.details).toEqual({ placesRemaining: 2 });
    mocks.joinWaitlist.mockResolvedValue({ ok: false, code: "DUPLICATE", listing, existing: anEntry({ position: 5 }) });
    expect((await join()).body.error.details).toEqual({ waitlistEntryId: anEntry().id, waitlistReference: "WL-000001", position: 5 });
    mocks.joinWaitlist.mockResolvedValue({ ok: false, code: "OUTSIDE_WINDOW", listing, state: "NOT_YET_OPEN" });
    expect((await join()).body.error.details).toEqual({ registrationOpensAt: listing.registrationOpensAt, registrationClosesAt: listing.registrationClosesAt });
  });

  it("lists the caller's entries with their events and a cursor for more", async () => {
    mocks.listEntriesOfAttendee.mockResolvedValue([anEntry(), anEntry({ id: "88888888-8888-4888-8888-888888888888" })]);
    const res = await request(appFor()).get("/api/v1/waitlist-entries?limit=1").set(attendee);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].event.reference).toBe("EVT-000123");
    expect(res.body.nextCursor).toEqual(expect.any(String));
  });

  it("refuses a malformed page request", async () => {
    const res = await request(appFor()).get("/api/v1/waitlist-entries?limit=0").set(attendee);
    expect(res.status).toBe(400);
  });

  it("leaves a waiting entry", async () => {
    mocks.leaveWaitlist.mockResolvedValue({ ok: true, entry: anEntry({ status: "WITHDRAWN", position: null }) });
    const res = await request(appFor()).post(`/api/v1/waitlist-entries/${anEntry().id}/withdrawal`).set(attendee);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "WITHDRAWN", position: null, event: { eventId: EVENT } });
  });

  it.each([
    ["garbage", null, 404, "WAITLIST_ENTRY_NOT_FOUND"],
    [anEntry().id, { ok: false, code: "NOT_FOUND" }, 404, "WAITLIST_ENTRY_NOT_FOUND"],
    [anEntry().id, { ok: false, code: "NOT_ACTIVE", entry: anEntry({ status: "REGISTERED" }) }, 409, "WAITLIST_ENTRY_NOT_ACTIVE"],
  ])("refuses leaving entry %s: %j", async (id, outcome, status, code) => {
    mocks.leaveWaitlist.mockResolvedValue(outcome);
    const res = await request(appFor()).post(`/api/v1/waitlist-entries/${id}/withdrawal`).set(attendee);
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
    if (code === "WAITLIST_ENTRY_NOT_ACTIVE") expect(res.body.error.details).toEqual({ status: "REGISTERED" });
  });
});

describe("the organiser's registration list (R5)", () => {
  const url = `/api/v1/events/${EVENT}/registrations`;

  it("lists registrations in order with the totals, the waitlist count and names", async () => {
    mocks.listRegistrationsOfEvent.mockResolvedValue([aRegistration({ addedBy: OWNER, additionReason: "VIP" })]);
    const res = await request(appFor()).get(url).set(organiser);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      event: { eventId: EVENT },
      waitlist: { waiting: 2 },
      namesAvailable: true,
      items: [{ id: REG, attendee: { id: ATTENDEE, name: "Attendee One" }, manualAddition: { reason: "VIP" } }],
      nextCursor: null,
    });
    expect(res.body.totals).toEqual(expect.objectContaining({ capacity: 5 }));
    expect(mocks.listRegistrationsOfEvent).toHaveBeenCalledWith(expect.anything(), EVENT, 100, null);
  });

  it("still lists, without names, when identity cannot be asked", async () => {
    mocks.listRegistrationsOfEvent.mockResolvedValue([aRegistration()]);
    vi.mocked(directory.namesOf).mockRejectedValue(new IdentityUnavailableError("connect ECONNREFUSED"));
    const res = await request(appFor()).get(url).set(organiser);
    expect(res.status).toBe(200);
    expect(res.body.namesAvailable).toBe(false);
    expect(res.body.items[0].attendee).toEqual({ id: ATTENDEE, name: null, email: null });
  });

  it("asks identity for no names when the page is empty", async () => {
    mocks.listRegistrationsOfEvent.mockResolvedValue([]);
    const res = await request(appFor()).get(url).set(organiser);
    expect(res.body).toMatchObject({ items: [], namesAvailable: true });
    expect(directory.namesOf).not.toHaveBeenCalled();
  });

  it("fails with 500, not a partial list, when the directory fails for another reason", async () => {
    mocks.listRegistrationsOfEvent.mockResolvedValue([aRegistration()]);
    vi.mocked(directory.namesOf).mockRejectedValue(new Error("boom"));
    expect((await request(appFor()).get(url).set(organiser)).status).toBe(500);
  });

  it("answers 404 to staff who do not manage the event, and a malformed id", async () => {
    for (const path of [url, "/api/v1/events/garbage/registrations"]) {
      const res = await request(appFor()).get(path).set(stranger);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("EVENT_NOT_FOUND");
    }
    expect(mocks.listRegistrationsOfEvent).not.toHaveBeenCalled();
  });

  it("lets the assigned coordinator in", async () => {
    mocks.findListing.mockResolvedValue(aListing({ ownerId: THEIRS, assignedCoordinatorId: "99999999-0000-4000-8000-000000000009" }));
    mocks.listRegistrationsOfEvent.mockResolvedValue([]);
    expect((await request(appFor()).get(url).set(stranger)).status).toBe(200);
  });

  it("refuses attendees the role", async () => {
    expect((await request(appFor()).get(url).set(attendee)).status).toBe(403);
  });

  it("refuses a malformed page request", async () => {
    expect((await request(appFor()).get(`${url}?limit=0`).set(organiser)).status).toBe(400);
  });

  it("returns a cursor when there are more registrations", async () => {
    mocks.listRegistrationsOfEvent.mockResolvedValue([aRegistration(), aRegistration({ id: THEIRS })]);
    const res = await request(appFor()).get(`${url}?limit=1`).set(organiser);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.nextCursor).toEqual(expect.any(String));
  });
});

describe("the organiser's waitlist (R6)", () => {
  const url = `/api/v1/events/${EVENT}/waitlist`;

  it("lists the waitlist in the order joined with names and the waiting count", async () => {
    mocks.listEntriesOfEvent.mockResolvedValue([anEntry()]);
    const res = await request(appFor()).get(url).set(organiser);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ waiting: 2, namesAvailable: true, items: [{ position: 1, attendee: { name: "Attendee One" } }], nextCursor: null });
  });

  it("still lists when identity is unavailable", async () => {
    mocks.listEntriesOfEvent.mockResolvedValue([anEntry()]);
    vi.mocked(directory.namesOf).mockRejectedValue(new IdentityUnavailableError("down"));
    const res = await request(appFor()).get(url).set(organiser);
    expect(res.body.namesAvailable).toBe(false);
  });

  it("answers 404 to staff who do not manage the event, and 400 to a malformed page", async () => {
    expect((await request(appFor()).get(url).set(stranger)).status).toBe(404);
    expect((await request(appFor()).get(`${url}?limit=1000`).set(organiser)).status).toBe(400);
  });
});

describe("adding an attendee by hand (R7)", () => {
  const url = `/api/v1/events/${EVENT}/manual-registrations`;
  const preview = { capacity: 5, totalAfter: 2, overCapacity: false };
  const post = (body: unknown = { attendeeEmail: "attendee@connectsphere.test", reason: "VIP" }, headers = organiser) => request(appFor()).post(url).set(headers).send(body as object);

  it("adds and answers 201 with the registration, the capacity and the total after", async () => {
    mocks.addManually.mockResolvedValue({ ok: true, registration: aRegistration({ addedBy: OWNER, additionReason: "VIP" }), preview });
    const res = await post();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: REG, capacity: 5, totalAfter: 2, attendee: { name: "Attendee One" }, manualAddition: { reason: "VIP" } });
    expect(mocks.addManually).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reason: "VIP", confirmOverCapacity: false, attendee: expect.objectContaining({ id: ATTENDEE }), addedBy: expect.objectContaining({ id: OWNER, role: "EVENT_ORGANISER" }) }),
    );
  });

  it("still adds when the adder's own name cannot be fetched", async () => {
    vi.mocked(directory.namesOf).mockRejectedValue(new IdentityUnavailableError("down"));
    mocks.addManually.mockResolvedValue({ ok: true, registration: aRegistration({ addedBy: OWNER }), preview });
    expect((await post()).status).toBe(201);
    expect(mocks.addManually.mock.calls[0]![1].addedBy.name).toBeNull();
  });

  it("refuses an incomplete form with the fields named, before any lookup", async () => {
    const res = await post({ attendeeEmail: "nope" });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual([{ field: "attendeeEmail", message: expect.any(String) }]);
    expect(directory.attendeeByEmail).not.toHaveBeenCalled();
  });

  it("refuses an event that is closed, with its status", async () => {
    mocks.findListing.mockResolvedValue(aListing({ ownerId: OWNER, status: "CANCELLED" }));
    const res = await post();
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "REGISTRATION_EVENT_CLOSED", details: { status: "CANCELLED" } });
  });

  it("refuses an event with no confirmed booking", async () => {
    mocks.capacityOf.mockResolvedValue({ capacity: 0, confirmedBookings: 0 });
    const res = await post();
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("REGISTRATION_NO_CONFIRMED_BOOKING");
  });

  it("answers 503 IDENTITY_UNAVAILABLE, changing nothing, when identity cannot find the attendee", async () => {
    vi.mocked(directory.attendeeByEmail).mockRejectedValue(new IdentityUnavailableError("down"));
    const res = await post();
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("IDENTITY_UNAVAILABLE");
    expect(mocks.addManually).not.toHaveBeenCalled();
  });

  it("answers 500 when the attendee lookup fails for another reason", async () => {
    vi.mocked(directory.attendeeByEmail).mockRejectedValue(new Error("boom"));
    expect((await post()).status).toBe(500);
  });

  it("answers 422 ATTENDEE_NOT_FOUND for an email with no account, naming the field", async () => {
    const res = await post({ attendeeEmail: "nobody@connectsphere.test" });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: "ATTENDEE_NOT_FOUND", fields: [{ field: "attendeeEmail" }] });
  });

  it.each([
    [{ ok: false, code: "EVENT_CLOSED", status: "COMPLETED" }, 409, "REGISTRATION_EVENT_CLOSED"],
    [{ ok: false, code: "DUPLICATE", existing: aRegistration({ reference: "REG-000009" }) }, 409, "REGISTRATION_DUPLICATE"],
    [{ ok: false, code: "OVER_CAPACITY_UNCONFIRMED", preview: { capacity: 5, totalAfter: 6, overCapacity: true }, registered: 5 }, 409, "REGISTRATION_OVER_CAPACITY_UNCONFIRMED"],
  ])("maps the service's refusal %j to %i %s", async (outcome, status, code) => {
    mocks.addManually.mockResolvedValue(outcome);
    const res = await post();
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });

  it("states the numbers behind an over-capacity refusal", async () => {
    mocks.addManually.mockResolvedValue({ ok: false, code: "OVER_CAPACITY_UNCONFIRMED", preview: { capacity: 5, totalAfter: 6, overCapacity: true }, registered: 5 });
    expect((await post()).body.error.details).toEqual({ capacity: 5, registered: 5, totalAfter: 6 });
  });

  it("answers 404 to staff who do not manage the event", async () => {
    expect((await post(undefined, stranger)).status).toBe(404);
    expect(mocks.addManually).not.toHaveBeenCalled();
  });
});
