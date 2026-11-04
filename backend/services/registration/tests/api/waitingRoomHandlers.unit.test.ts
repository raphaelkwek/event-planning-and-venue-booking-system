import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import type { Sql } from "postgres";
import { errorHandler } from "../../src/errorHandler.js";
import { aListing, ATTENDEE, EVENT } from "../support/builders.js";
import { fakeAuth, ROOM } from "../support/fixtures.js";

/**
 * EN-19 — what the waiting-room routes answer for each outcome the service
 * reports, with the service scripted: the status, the code and the details
 * a client needs. The queue itself runs against Postgres in en19Cards.test.ts.
 */

const mocks = vi.hoisted(() => ({ joinWaitingRoom: vi.fn(), placeById: vi.fn() }));
vi.mock("../../src/service/waitingRoom.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/service/waitingRoom.js")>()),
  joinWaitingRoom: mocks.joinWaitingRoom,
  placeById: mocks.placeById,
}));

const { waitingRoomRouter } = await import("../../src/api/waitingRoom.js");

const noLimit: RequestHandler = (_req, _res, next) => next();
const app = () =>
  express()
    .use(express.json())
    .use(waitingRoomRouter({ sql: {} as Sql, auth: fakeAuth, limiter: noLimit, waitingRoom: ROOM }))
    .use(errorHandler);
const attendee = { Authorization: `Bearer attendee:${ATTENDEE}` };
const listing = aListing({ highDemand: true });
const place = { entryId: "e1", eventId: EVENT, status: "WAITING", position: 3 };

beforeEach(() => vi.resetAllMocks());

describe("joining the waiting room (EN-19)", () => {
  const join = (body: unknown = { eventId: EVENT }, headers: Record<string, string> = attendee) => request(app()).post("/api/v1/waiting-room/entries").set(headers).send(body as object);

  it("answers 201 with the place for a new entry and 200 for one the attendee already holds", async () => {
    mocks.joinWaitingRoom.mockResolvedValueOnce({ ok: true, created: true, place });
    const created = await join();
    expect(created.status).toBe(201);
    expect(created.body).toEqual(place);
    expect(mocks.joinWaitingRoom).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventId: EVENT, attendeeId: ATTENDEE }), ROOM);

    mocks.joinWaitingRoom.mockResolvedValueOnce({ ok: true, created: false, place });
    expect((await join()).status).toBe(200);
  });

  it.each([{}, { eventId: 7 }, { eventId: "nope" }])("refuses %j, naming eventId, before the service", async (body) => {
    const res = await join(body);
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual([{ field: "eventId", message: "Give the event's id." }]);
    expect(mocks.joinWaitingRoom).not.toHaveBeenCalled();
  });

  it("refuses staff: only attendees queue", async () => {
    const res = await join({ eventId: EVENT }, { Authorization: "Bearer organiser:00000000-0000-0000-0000-000000000001" });
    expect(res.status).toBe(403);
  });

  it.each([
    [{ ok: false, code: "EVENT_NOT_FOUND" }, 404, "EVENT_NOT_FOUND"],
    [{ ok: false, code: "NOT_REQUIRED", listing }, 409, "WAITING_ROOM_NOT_REQUIRED"],
    [{ ok: false, code: "UNAVAILABLE" }, 503, "WAITING_ROOM_UNAVAILABLE"],
    [{ ok: false, code: "OUTSIDE_WINDOW", listing, state: "CLOSED" }, 422, "REGISTRATION_OUTSIDE_WINDOW"],
  ])("maps the service's refusal %j to %i %s", async (outcome, status, code) => {
    mocks.joinWaitingRoom.mockResolvedValue(outcome);
    const res = await join();
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });

  it("gives the window when the refusal is about the window", async () => {
    mocks.joinWaitingRoom.mockResolvedValue({ ok: false, code: "OUTSIDE_WINDOW", listing, state: "NOT_YET_OPEN" });
    expect((await join()).body.error.details).toEqual({ registrationOpensAt: listing.registrationOpensAt, registrationClosesAt: listing.registrationClosesAt });
  });

  it("answers 500 INTERNAL_ERROR when the service fails", async () => {
    mocks.joinWaitingRoom.mockRejectedValue(new Error("deadlock"));
    const res = await join();
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("reading a place (EN-19)", () => {
  it("returns the place for any signed-in user, using only the signature check", async () => {
    mocks.placeById.mockResolvedValue(place);
    const res = await request(app()).get("/api/v1/waiting-room/entries/11111111-1111-4111-8111-111111111111").set(attendee);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(place);
  });

  it("answers 404 for an unknown entry, and for a malformed id without asking the service", async () => {
    mocks.placeById.mockResolvedValue(null);
    const unknown = await request(app()).get("/api/v1/waiting-room/entries/11111111-1111-4111-8111-111111111111").set(attendee);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("WAITING_ROOM_ENTRY_NOT_FOUND");

    mocks.placeById.mockClear();
    const malformed = await request(app()).get("/api/v1/waiting-room/entries/garbage").set(attendee);
    expect(malformed.status).toBe(404);
    expect(mocks.placeById).not.toHaveBeenCalled();
  });

  it("refuses a request with no token", async () => {
    const res = await request(app()).get("/api/v1/waiting-room/entries/11111111-1111-4111-8111-111111111111");
    expect(res.status).toBe(401);
  });
});
