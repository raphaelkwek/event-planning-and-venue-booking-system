import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { searchRateLimit } from "../../../src/modules/venue/api/search.js";

/**
 * J1, J2 — the search routes' rate limit, a stopgap until the gateway's
 * (ADR-0011, EN-12). Mounted alone in front of a stand-in handler, so this
 * needs no database and no sign-in. venueSearch.test.ts checks that the real
 * routes carry it.
 */

describe("searchRateLimit", () => {
  it("lets 120 requests a minute from one address through, then refuses the next with 429 without handling it", async () => {
    const handled = vi.fn((_req: express.Request, res: express.Response) => res.status(204).end());
    const app = express();
    app.get("/search", searchRateLimit(), handled);

    for (let i = 0; i < 120; i++) {
      expect((await request(app).get("/search")).status).toBe(204);
    }
    const refused = await request(app).get("/search");

    expect(refused.status).toBe(429);
    expect(refused.body.error).toMatchObject({
      code: "RATE_LIMITED",
      message: "Too many venue searches. Wait a minute and try again.",
    });
    expect(refused.headers["retry-after"]).toBeDefined();
    expect(handled).toHaveBeenCalledTimes(120);
  });
});
