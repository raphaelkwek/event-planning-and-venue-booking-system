import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import type { Sql } from "postgres";
import { newTraceparent } from "../../src/shared/tracing.js";
import { healthRouter } from "../../src/shared/health.js";

/** EN-04.2: trace ids for new messages, and /readyz reporting the broker. The probe is tested in @connectsphere/kafka. */

describe("newTraceparent", () => {
  it("starts a W3C trace: version 00, a 32-hex trace id, a 16-hex span id, sampled", () => {
    expect(newTraceparent()).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  it("starts a different trace each time", () => {
    expect(newTraceparent()).not.toBe(newTraceparent());
  });
});

/** A stand-in for the postgres tag: resolves, or rejects like a dead database. */
function fakeSql(up: boolean): Sql {
  return (() => (up ? Promise.resolve([]) : Promise.reject(new Error("connection refused")))) as unknown as Sql;
}

function appWith(sql: Sql, probe?: () => Promise<boolean>) {
  return express().use(healthRouter(sql, probe));
}

describe("/readyz", () => {
  it("is ready and reports the broker reachable", async () => {
    const res = await request(appWith(fakeSql(true), async () => true)).get("/readyz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready", checks: { database: "ok", kafka: "reachable" } });
  });

  it("stays ready when the broker is down, because the outbox holds messages until it is back", async () => {
    const res = await request(appWith(fakeSql(true), async () => false)).get("/readyz");
    expect(res.status).toBe(200);
    expect(res.body.checks.kafka).toBe("unreachable");
  });

  it("says Kafka is not configured when this process has no KAFKA_* settings", async () => {
    const res = await request(appWith(fakeSql(true))).get("/readyz");
    expect(res.body.checks.kafka).toBe("not_configured");
  });

  it("is not ready when the database is down", async () => {
    const res = await request(appWith(fakeSql(false), async () => true)).get("/readyz");
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "not_ready", checks: { database: "unreachable" } });
  });
});
