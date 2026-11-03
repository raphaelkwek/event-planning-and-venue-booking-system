import { describe, expect, it } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import type { Sql } from "postgres";
import type { Authenticator } from "../../src/api/auth.js";
import { waitingRoomRouter } from "../../src/api/waitingRoom.js";
import { ROOM } from "../support/fixtures.js";

/**
 * EN-19 — the waiting room is rate limited before anything else: before the
 * token is checked and before identity is asked, so a flood of join or poll
 * requests is turned away at the cost of a counter (CodeQL
 * js/missing-rate-limiting). No database is used.
 */

const noDatabase = new Proxy(() => undefined, {
  get() {
    throw new Error("the database was used");
  },
  apply() {
    throw new Error("the database was used");
  },
}) as unknown as Sql;

const ENTRY = "22222222-2222-4222-8222-222222222222";
const ROUTES: Array<[string, string]> = [
  ["post", "/api/v1/waiting-room/entries"],
  ["get", `/api/v1/waiting-room/entries/${ENTRY}`],
];

function watching() {
  const asked: string[] = [];
  const auth: Authenticator = {
    verifyToken: async () => void asked.push("verify"),
    identify: async () => {
      asked.push("identify");
      throw new Error("not reached");
    },
  };
  return { asked, auth };
}

const call = (app: express.Express, method: string, path: string) =>
  (request(app) as unknown as Record<string, (p: string) => request.Test>)[method]!(path);

describe("the waiting room's rate limit", () => {
  it("EN-19-T11 refuses with RATE_LIMITED before the token is checked or identity is asked, on both routes", async () => {
    const { asked, auth } = watching();
    const limiter: RequestHandler = (_req, res) => {
      res.status(429).json({ error: { code: "RATE_LIMITED" } });
    };
    const app = express().use(express.json()).use(waitingRoomRouter({ sql: noDatabase, auth, limiter, waitingRoom: ROOM }));

    for (const [method, path] of ROUTES) {
      const res = await call(app, method, path).set({ Authorization: "Bearer x" });
      expect(res.status, `${method} ${path}`).toBe(429);
    }
    expect(asked).toEqual([]);
  });

  it("EN-19-T11 refuses past the budget with RATE_LIMITED before any token is checked, and answers 401 inside it", async () => {
    const { asked, auth } = watching();
    const app = express().use(express.json()).use(waitingRoomRouter({ sql: noDatabase, auth, waitingRoom: ROOM }));

    const inside = await call(app, "get", `/api/v1/waiting-room/entries/${ENTRY}`);
    expect(inside.status).toBe(401);
    expect(inside.headers).toHaveProperty("ratelimit-policy");

    // One request has been used; the budget is 240 a minute per address.
    let refused = 0;
    for (let i = 0; i < 245; i++) {
      const res = await call(app, i % 2 ? "post" : "get", i % 2 ? "/api/v1/waiting-room/entries" : `/api/v1/waiting-room/entries/${ENTRY}`);
      if (res.status === 429) {
        refused++;
        expect(res.body.error.code).toBe("RATE_LIMITED");
        expect(res.body.error).toHaveProperty("message");
      } else {
        expect(res.status).toBe(401);
      }
    }
    expect(refused).toBe(6);
    expect(asked).toEqual([]);
  });
});
