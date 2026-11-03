import { describe, expect, it } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import type { Sql } from "postgres";
import { registrationRouter } from "../../src/api/routes.js";
import { presentOpenEvent, presentRegistration } from "../../src/api/present.js";
import type { Authenticator } from "../../src/api/auth.js";
import { fakeAuth } from "../support/fixtures.js";

/**
 * R1 to R4 — what the attendee API decides before it touches the database:
 * the rate limit comes first, before any token check (CodeQL
 * js/missing-rate-limiting); malformed input is refused with the field named;
 * and what an attendee is sent holds only published fields.
 */

const noDatabase = new Proxy(() => undefined, {
  get() {
    throw new Error("the database was used");
  },
  apply() {
    throw new Error("the database was used");
  },
}) as unknown as Sql;

const ROUTES: Array<[string, string]> = [
  ["get", "/api/v1/open-events"],
  ["get", "/api/v1/open-events/22222222-2222-4222-8222-222222222222"],
  ["post", "/api/v1/registrations"],
  ["get", "/api/v1/registrations"],
  ["get", "/api/v1/registrations/22222222-2222-4222-8222-222222222222"],
  ["post", "/api/v1/registrations/22222222-2222-4222-8222-222222222222/withdrawal"],
];

describe("the attendee API's rate limit", () => {
  it("refuses with RATE_LIMITED before the token is checked or identity is asked, on every route", async () => {
    const asked: string[] = [];
    const watching: Authenticator = {
      verifyToken: async () => void asked.push("verify"),
      identify: async () => {
        asked.push("identify");
        throw new Error("not reached");
      },
    };
    const limiter: RequestHandler = (_req, res) => {
      res.status(429).json({ error: { code: "RATE_LIMITED" } });
    };
    const app = express().use(express.json()).use(registrationRouter({ sql: noDatabase, auth: watching, limiter }));

    for (const [method, path] of ROUTES) {
      const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method]!(path).set({ Authorization: "Bearer x" });
      expect(res.status, `${method} ${path}`).toBe(429);
    }
    expect(asked).toEqual([]);
  });

  it("uses a real limiter by default, which counts requests per address", async () => {
    const app = express().use(registrationRouter({ sql: noDatabase, auth: fakeAuth }));
    const res = await request(app).get("/api/v1/open-events?limit=0").set({ Authorization: "Bearer x" });
    expect(res.headers).toHaveProperty("ratelimit-policy");
  });
});

describe("the attendee API's input checks", () => {
  const noLimit: RequestHandler = (_req, _res, next) => next();
  const app = express().use(express.json()).use(registrationRouter({ sql: noDatabase, auth: fakeAuth, limiter: noLimit }));
  const attendee = { Authorization: "Bearer attendee:00000000-0000-0000-0000-000000000005" };

  it("refuses a page size outside 1 to 100, and a cursor it did not issue, naming the field", async () => {
    for (const path of ["/api/v1/open-events?limit=0", "/api/v1/registrations?limit=x"]) {
      const res = await request(app).get(path).set(attendee);
      expect([res.status, res.body.error.fields[0].field]).toEqual([400, "limit"]);
    }
    for (const path of ["/api/v1/open-events?cursor=e30", "/api/v1/registrations?cursor=%%%", "/api/v1/registrations?cursor=a&cursor=b"]) {
      const res = await request(app).get(path).set(attendee);
      expect([res.status, res.body.error.fields[0].field]).toEqual([400, "cursor"]);
    }
  });

  it("refuses a registration that names no event, or not an id", async () => {
    for (const body of [{}, { eventId: "EVT-000123" }, { eventId: 42 }]) {
      const res = await request(app).post("/api/v1/registrations").set(attendee).send(body);
      expect([res.status, res.body.error.code]).toEqual([400, "VALIDATION_FAILED"]);
    }
  });

  it("answers an id that is not an id as not found, without a query", async () => {
    expect((await request(app).get("/api/v1/open-events/EVT-000123").set(attendee)).body.error.code).toBe("EVENT_NOT_FOUND");
    expect((await request(app).get("/api/v1/registrations/REG-000001").set(attendee)).body.error.code).toBe("REGISTRATION_NOT_FOUND");
    expect((await request(app).post("/api/v1/registrations/REG-000001/withdrawal").set(attendee)).body.error.code).toBe("REGISTRATION_NOT_FOUND");
  });

  it("passes a database failure on to the error handler rather than leaving the request hanging", async () => {
    const res = await request(app).get("/api/v1/open-events/22222222-2222-4222-8222-222222222222").set(attendee);
    expect(res.status).toBe(500);
  });
});

describe("what attendees are sent (R1-T8, R3)", () => {
  const listing = {
    eventId: "22222222-2222-4222-8222-222222222222",
    eventReference: "EVT-000123",
    name: "R Test Symposium",
    description: null,
    ownerId: "00000000-0000-0000-0000-000000000001",
    status: "CONFIRMED",
    startsAt: "2026-12-16T06:00:00.000Z",
    endsAt: "2026-12-16T10:00:00.000Z",
    registrationRequired: true,
    registrationOpensAt: "2026-12-01T01:00:00.000Z",
    registrationClosesAt: "2026-12-10T10:00:00.000Z",
    withdrawalDeadlineAt: null,
  };

  it("an open event: no owner or status, the deadline as the start when none is set, and full at zero places", () => {
    const open = presentOpenEvent(listing, [], { freeSeats: 1, unseatedRegistrations: 1 });
    expect(open).not.toHaveProperty("ownerId");
    expect(open).not.toHaveProperty("status");
    expect(open).toMatchObject({ withdrawalDeadline: listing.startsAt, placesRemaining: 0, isFull: true });
  });

  it("a registration whose event is not known shows no event details rather than failing", () => {
    const registration = {
      id: "r",
      reference: "REG-000001",
      eventId: listing.eventId,
      attendeeId: "a",
      seatId: null,
      status: "REGISTERED" as const,
      registeredAt: "2026-12-01T02:00:00.000Z",
      withdrawnAt: null,
      cancelledAt: null,
    };
    expect(presentRegistration(registration, undefined, []).event).toEqual({
      eventId: listing.eventId,
      reference: "",
      name: "",
      startsAt: null,
      endsAt: null,
      venues: [],
      withdrawalDeadline: null,
    });
    expect(presentRegistration(registration, { ...listing, startsAt: null }, []).event.withdrawalDeadline).toBeNull();
    expect(presentRegistration(registration, listing, []).event.withdrawalDeadline).toBe(listing.startsAt);
  });
});
