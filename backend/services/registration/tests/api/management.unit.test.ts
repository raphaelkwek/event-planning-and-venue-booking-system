import { describe, expect, it } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import type { Sql } from "postgres";
import { IdentityUnavailableError, type Authenticator } from "../../src/api/auth.js";
import { nameOf, planningCoreDirectory } from "../../src/api/directory.js";
import { pageOf } from "../../src/api/http.js";
import { personOf, presentManagedEntry, presentManagedEvent, presentManagedRegistration, presentWaitlistEntry } from "../../src/api/present.js";
import { registrationRouter } from "../../src/api/routes.js";
import { fakeAuth, fakeDirectory } from "../support/fixtures.js";

/**
 * R5 to R7 — what the organiser's routes and the waitlist decide before they
 * touch the database, how people are named, and what each list sends.
 */

const noDatabase = new Proxy(() => undefined, {
  get() {
    throw new Error("the database was used");
  },
  apply() {
    throw new Error("the database was used");
  },
}) as unknown as Sql;
const noLimit: RequestHandler = (_req, _res, next) => next();
const EVENT = "22222222-2222-4222-8222-222222222222";
const ROUTES: Array<[string, string]> = [
  ["get", `/api/v1/events/${EVENT}/registrations`],
  ["get", `/api/v1/events/${EVENT}/waitlist`],
  ["post", `/api/v1/events/${EVENT}/waitlist`],
  ["post", `/api/v1/events/${EVENT}/manual-registrations`],
  ["get", "/api/v1/waitlist-entries"],
  ["post", `/api/v1/waitlist-entries/${EVENT}/withdrawal`],
];
const send = (app: express.Express, method: string, path: string) => (request(app) as unknown as Record<string, (p: string) => request.Test>)[method]!(path);

describe("the R5 to R7 routes' rate limit", () => {
  it("refuses with RATE_LIMITED before identity is asked, on every route", async () => {
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
    const app = express().use(express.json()).use(registrationRouter({ sql: noDatabase, auth: watching, limiter, directory: fakeDirectory }));

    for (const [method, path] of ROUTES) {
      expect((await send(app, method, path).set({ Authorization: "Bearer x" })).status, `${method} ${path}`).toBe(429);
    }
    expect(asked).toEqual([]);
  });
});

describe("who may call them", () => {
  const app = express().use(express.json()).use(registrationRouter({ sql: noDatabase, auth: fakeAuth, limiter: noLimit, directory: fakeDirectory }));

  it("R5-T3, R7-T3 refuse an attendee the organiser's routes, and staff the attendee's", async () => {
    for (const [method, path] of ROUTES) {
      const organiserRoute = path.includes("/registrations") || path.includes("manual") || (method === "get" && path.includes("/events/"));
      const as = organiserRoute ? "attendee:00000000-0000-0000-0000-000000000005" : "organiser:00000000-0000-0000-0000-000000000001";
      const res = await send(app, method, path).set({ Authorization: `Bearer ${as}` });
      expect([res.status, res.body.error.code], `${method} ${path}`).toEqual([403, "ROLE_NOT_AUTHORISED"]);
    }
  });

  it("asks for a token, and answers 503 when identity can't say who is calling", async () => {
    expect((await request(app).get(`/api/v1/events/${EVENT}/registrations`)).status).toBe(401);
    const down = await request(app).get(`/api/v1/events/${EVENT}/registrations`).set({ Authorization: "Bearer down" });
    expect([down.status, down.body.error.code]).toEqual([503, "IDENTITY_UNAVAILABLE"]);
  });

  it("answers an id that is not an id as not found, without a query", async () => {
    const organiser = { Authorization: "Bearer organiser:00000000-0000-0000-0000-000000000001" };
    const attendee = { Authorization: "Bearer attendee:00000000-0000-0000-0000-000000000005" };
    for (const path of ["/api/v1/events/EVT-1/registrations", "/api/v1/events/EVT-1/waitlist"]) {
      expect((await request(app).get(path).set(organiser)).body.error.code).toBe("EVENT_NOT_FOUND");
    }
    expect((await request(app).post("/api/v1/events/EVT-1/manual-registrations").set(organiser).send({})).body.error.code).toBe("EVENT_NOT_FOUND");
    expect((await request(app).post("/api/v1/events/EVT-1/waitlist").set(attendee)).body.error.code).toBe("EVENT_NOT_FOUND");
    expect((await request(app).post("/api/v1/waitlist-entries/WL-1/withdrawal").set(attendee)).body.error.code).toBe("WAITLIST_ENTRY_NOT_FOUND");
  });

  it("refuses a page size or cursor it did not issue on my waitlist entries, naming the field", async () => {
    const attendee = { Authorization: "Bearer attendee:00000000-0000-0000-0000-000000000005" };
    expect((await request(app).get("/api/v1/waitlist-entries?limit=101").set(attendee)).body.error.fields[0].field).toBe("limit");
    expect((await request(app).get("/api/v1/waitlist-entries?cursor=e30").set(attendee)).body.error.fields[0].field).toBe("cursor");
  });
});

describe("planningCoreDirectory (R5, R7)", () => {
  const ada = { id: "00000000-0000-0000-0000-0000000000a1", displayName: "Ada", email: "ada@connectsphere.test" };
  const respond = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

  it("names users in batches of at most 100, asking with the caller's token", async () => {
    const asked: Array<{ url: string; auth: string }> = [];
    const ids = Array.from({ length: 150 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`);
    const directory = planningCoreDirectory({
      baseUrl: "http://identity",
      fetcher: async (url, init) => {
        asked.push({ url, auth: init.headers.Authorization! });
        return new Response(JSON.stringify({ items: url.includes(ids[0]!) ? [ada] : [] }), { status: 200 });
      },
    });

    const names = await directory.namesOf("tok", [...ids, ids[0]!]);

    expect(asked.map((a) => a.url.split("ids=")[1]!.split(",").length)).toEqual([100, 50]);
    expect(asked.every((a) => a.auth === "Bearer tok" && a.url.startsWith("http://identity/api/v1/users?ids="))).toBe(true);
    expect([...names.values()]).toEqual([ada]);
  });

  it("finds an attendee by email, or nobody", async () => {
    let url = "";
    const found = planningCoreDirectory({ baseUrl: "http://identity", fetcher: async (u) => ((url = u), new Response(JSON.stringify({ items: [ada] }))) });
    expect(await found.attendeeByEmail("tok", "ada+vip@connectsphere.test")).toEqual(ada);
    expect(url).toBe("http://identity/api/v1/attendees?email=ada%2Bvip%40connectsphere.test");
    const none = planningCoreDirectory({ fetcher: respond(200, { items: [] }) });
    expect(await none.attendeeByEmail("tok", "x@y.sg")).toBeNull();
  });

  it("rejects with IdentityUnavailableError when identity is unreachable, refuses, or answers something else", async () => {
    const unreachable = planningCoreDirectory({
      fetcher: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    await expect(unreachable.attendeeByEmail("tok", "x@y.sg")).rejects.toBeInstanceOf(IdentityUnavailableError);
    await expect(planningCoreDirectory({ fetcher: respond(403, { error: {} }) }).namesOf("tok", [ada.id])).rejects.toBeInstanceOf(IdentityUnavailableError);
    await expect(planningCoreDirectory({ fetcher: respond(200, { items: [{ id: "x" }] }) }).namesOf("tok", [ada.id])).rejects.toThrow(/answered 200/);
    const notJson = planningCoreDirectory({ fetcher: async () => new Response("<html>", { status: 502 }) });
    await expect(notJson.namesOf("tok", [ada.id])).rejects.toThrow(/answered 502/);
  });

  it("asks nothing for no ids", async () => {
    const directory = planningCoreDirectory({
      fetcher: async () => {
        throw new Error("asked");
      },
    });
    expect((await directory.namesOf("tok", [])).size).toBe(0);
  });

  it("names someone by display name, by email when they have none, and not at all when unknown", () => {
    expect(nameOf(ada)).toBe("Ada");
    expect(nameOf({ ...ada, displayName: null })).toBe("ada@connectsphere.test");
    expect(nameOf(undefined)).toBeNull();
  });
});

describe("what the organiser's lists send (R5, R6, R7)", () => {
  const attendee = { id: "00000000-0000-0000-0000-000000000005", displayName: "Attendee One", email: "attendee@connectsphere.test" };
  const organiser = { id: "00000000-0000-0000-0000-000000000001", displayName: "Organiser One", email: "organiser@connectsphere.test" };
  const names = new Map([attendee, organiser].map((u) => [u.id, u]));
  const registration = {
    id: "r",
    reference: "REG-000001",
    eventId: "e",
    attendeeId: attendee.id,
    seatId: null,
    status: "REGISTERED" as const,
    registeredAt: "2026-12-01T02:00:00.000Z",
    withdrawnAt: null,
    cancelledAt: null,
    addedBy: null,
    additionReason: null,
    addedOverCapacity: false,
  };

  it("R7-T9 tells a self-registration from a manual addition, naming who added it and why", () => {
    expect(presentManagedRegistration({ ...registration, seatId: "s" }, names)).toMatchObject({
      attendee: { id: attendee.id, name: "Attendee One", email: "attendee@connectsphere.test" },
      manualAddition: null,
      holdsSeat: true,
    });
    expect(presentManagedRegistration({ ...registration, addedBy: organiser.id, additionReason: "VIP", addedOverCapacity: true }, names)).toMatchObject({
      manualAddition: { addedBy: { name: "Organiser One" }, reason: "VIP", overCapacity: true },
      holdsSeat: false,
    });
  });

  it("names nobody it wasn't told about", () => {
    expect(personOf("00000000-0000-0000-0000-000000000009", names)).toEqual({ id: "00000000-0000-0000-0000-000000000009", name: null, email: null });
  });

  const entry = {
    id: "w",
    reference: "WL-000001",
    eventId: "e",
    attendeeId: attendee.id,
    status: "WAITLISTED" as const,
    joinedAt: "2026-12-05T02:00:00.000Z",
    lastNotifiedAt: null,
    registrationId: null,
    registeredAt: null,
    withdrawnAt: null,
    cancelledAt: null,
    position: 1,
  };

  it("R6 sends the attendee their entry with its event, and the organiser each entry with its attendee", () => {
    const listing = {
      eventId: "e",
      eventReference: "EVT-000123",
      name: "R Test Symposium",
      description: null,
      ownerId: organiser.id,
      assignedCoordinatorId: null,
      status: "CONFIRMED",
      startsAt: "2026-12-16T06:00:00.000Z",
      endsAt: "2026-12-16T10:00:00.000Z",
      registrationRequired: true,
      registrationOpensAt: null,
      registrationClosesAt: null,
      withdrawalDeadlineAt: null,
    };
    expect(presentWaitlistEntry(entry, listing).event).toEqual({ eventId: "e", reference: "EVT-000123", name: "R Test Symposium", startsAt: listing.startsAt, endsAt: listing.endsAt });
    expect(presentWaitlistEntry(entry, undefined).event).toEqual({ eventId: "e", reference: "", name: "", startsAt: null, endsAt: null });
    expect(presentManagedEntry(entry, names)).toMatchObject({ reference: "WL-000001", position: 1, attendee: { name: "Attendee One" } });
    expect(presentManagedEvent(listing)).toEqual({ eventId: "e", reference: "EVT-000123", name: "R Test Symposium", status: "CONFIRMED", startsAt: listing.startsAt });
  });
});

describe("pageOf", () => {
  it("gives the cursor after the last item only when there is a next page", () => {
    expect(pageOf([1, 2, 3], 2, (n) => ({ n })).nextCursor).toBe(Buffer.from(JSON.stringify({ n: 2 })).toString("base64url"));
    expect(pageOf([1, 2], 2, (n) => ({ n }))).toEqual({ items: [1, 2], nextCursor: null });
    expect(pageOf([], 2, (n: number) => ({ n }))).toEqual({ items: [], nextCursor: null });
  });
});

