import { describe, expect, it } from "vitest";
import express, { type RequestHandler } from "express";
import request from "supertest";
import type { Sql } from "postgres";
import { attendeesRouter } from "../../../src/modules/identity/api/attendees.js";

/** R7's attendee lookup is rate limited before the token is checked (CodeQL js/missing-rate-limiting). */
describe("GET /api/v1/attendees rate limit", () => {
  it("refuses with RATE_LIMITED before the token or the database is touched", async () => {
    const limiter: RequestHandler = (_req, res) => {
      res.status(429).json({ error: { code: "RATE_LIMITED" } });
    };
    const app = express().use(attendeesRouter({} as Sql, limiter));

    const res = await request(app).get("/api/v1/attendees?email=a@b.test");

    expect([res.status, res.body.error.code]).toEqual([429, "RATE_LIMITED"]);
  });
});
