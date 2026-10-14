import { describe, expect, it, vi } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import type { Sql } from "postgres";
import { venuesRateLimit, venuesRouter } from "../../../src/modules/venue/api/venues.js";

/**
 * H1's catalogue routes are rate limited, a stopgap until the gateway's
 * (ADR-0011, EN-12; CodeQL js/missing-rate-limiting). No database and no
 * sign-in: the limiter is checked alone in front of a stand-in handler, and
 * the real routes with a limiter that refuses everything, which shows it runs
 * before authentication on each of them.
 */

describe("venuesRateLimit", () => {
  it("lets 120 requests a minute from one address through, then refuses the next with 429 without handling it", async () => {
    const handled = vi.fn((_req: express.Request, res: express.Response) => res.status(204).end());
    const app = express();
    app.get("/venues", venuesRateLimit(), handled);
    for (let i = 0; i < 120; i++) {
      expect((await request(app).get("/venues")).status).toBe(204);
    }

    const refused = await request(app).get("/venues");

    expect(refused.status).toBe(429);
    expect(refused.body.error).toMatchObject({
      code: "RATE_LIMITED",
      message: "Too many venue requests. Wait a minute and try again.",
    });
    expect(refused.headers["retry-after"]).toBeDefined();
    expect(handled).toHaveBeenCalledTimes(120);
  });
});

describe("venuesRouter", () => {
  const refuseAll: RequestHandler = (_req, res) => {
    res.status(429).json({ error: { code: "RATE_LIMITED" } });
  };
  const app = express();
  app.use(express.json());
  app.use(venuesRouter({} as Sql, refuseAll));
  const id = "3f1c2a4e-9b7d-4e2a-8c1f-0a2b3c4d5e6f";

  it.each([
    ["GET", "/api/v1/venues"],
    ["GET", `/api/v1/venues/${id}`],
    ["POST", "/api/v1/venues"],
    ["PUT", `/api/v1/venues/${id}`],
  ] as const)("puts the limiter before authentication on %s %s", async (method, path) => {
    const res =
      method === "GET"
        ? await request(app).get(path)
        : method === "POST"
          ? await request(app).post(path).send({})
          : await request(app).put(path).send({});

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });
});
