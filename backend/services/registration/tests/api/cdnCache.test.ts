import { afterAll, afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import request from "supertest";
import { app as theService } from "../../src/app.js";
import { BROWSE_CACHE_CONTROL } from "../../src/api/routes.js";
import { DURING, anEvent, appAt, asAttendee, cleanUp } from "../support/fixtures.js";

/**
 * EN-12 — what a CDN may keep (ADR-0011). The browse routes carry a five
 * second public cache with stale-while-revalidate; every other response the
 * service sends, including any refusal, is `no-store`, so a CDN never keeps
 * anything about a caller. Against the real registration schema.
 */

const sql = postgres(process.env.DATABASE_URL!, { max: 4, prepare: false });
const clock = { now: DURING };
const app = appAt(sql, clock);

afterEach(() => cleanUp(sql));
afterAll(() => sql.end());

describe("the CDN's cache rules for the registration service", () => {
  it("EN-12-T11 marks the browse list and an event's page as a five second public cache, and nothing in them is about the caller", async () => {
    expect(BROWSE_CACHE_CONTROL).toBe("public, max-age=5, stale-while-revalidate=30");
    const event = await anEvent(sql, { seats: 3, highDemand: true });
    const me = randomUUID();
    const bystander = randomUUID();
    await request(app).post("/api/v1/waiting-room/entries").set(asAttendee(me)).send({ eventId: event.eventId });

    const list = await request(app).get("/api/v1/open-events?limit=100").set(asAttendee(me));
    const page = await request(app).get(`/api/v1/open-events/${event.eventId}`).set(asAttendee(me));
    const bystanderPage = await request(app).get(`/api/v1/open-events/${event.eventId}`).set(asAttendee(bystander));

    expect(list.status).toBe(200);
    expect(list.headers["cache-control"]).toBe(BROWSE_CACHE_CONTROL);
    expect(page.status).toBe(200);
    expect(page.headers["cache-control"]).toBe(BROWSE_CACHE_CONTROL);
    // Two different callers get byte-for-byte the same page, so a shared cache can serve either.
    expect(bystanderPage.text).toBe(page.text);
    expect(page.text).not.toContain(me);
    expect(page.body).toMatchObject({ eventId: event.eventId, highDemand: true });
    expect(JSON.stringify(list.body)).not.toContain(me);
  });

  it("EN-12-T11 leaves a refusal from the browse routes uncacheable", async () => {
    const unknown = await request(app).get(`/api/v1/open-events/${randomUUID()}`).set(asAttendee(randomUUID()));
    const badPage = await request(app).get("/api/v1/open-events?limit=0").set(asAttendee(randomUUID()));

    expect(unknown.status).toBe(404);
    expect(unknown.headers["cache-control"] ?? "").not.toContain("public");
    expect(badPage.status).toBe(400);
    expect(badPage.headers["cache-control"] ?? "").not.toContain("public");
  });

  it("EN-12-T11 sends everything under /api/ that is not the browse listing as no-store, refusals included", async () => {
    const refusals = [
      await request(theService).get("/api/v1/open-events"),
      await request(theService).get("/api/v1/registrations"),
      await request(theService).post("/api/v1/registrations").send({}),
      await request(theService).post("/api/v1/waiting-room/entries").send({}),
      await request(theService).get(`/api/v1/waiting-room/entries/${randomUUID()}`),
      await request(theService).get(`/api/v1/registrations/${randomUUID()}`),
    ];
    for (const res of refusals) {
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.headers["cache-control"]).toBe("no-store");
    }
  });
});
