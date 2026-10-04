import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import type { Sql } from "postgres";
import { healthRouter } from "../src/health.js";

/**
 * EN-04.3: the service's own /healthz and /readyz. Ready means the database
 * answers, since every notification is written there. The broker is reported:
 * while it is down nothing new arrives, but what is stored can still be read.
 */

function fakeSql(up: boolean): Sql {
  return (() => (up ? Promise.resolve([]) : Promise.reject(new Error("connection refused")))) as unknown as Sql;
}

const appWith = (sql: Sql, probe?: () => Promise<boolean>) => express().use(healthRouter(sql, probe));

describe("notification health endpoints", () => {
  it("/healthz says the process is alive", async () => {
    const res = await request(appWith(fakeSql(false))).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "notification" });
  });

  it("/readyz is ready when the database answers, and reports the broker", async () => {
    const res = await request(appWith(fakeSql(true), async () => true)).get("/readyz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready", checks: { database: "ok", kafka: "reachable" } });
  });

  it("/readyz stays ready with the broker down", async () => {
    const res = await request(appWith(fakeSql(true), async () => false)).get("/readyz");
    expect(res.status).toBe(200);
    expect(res.body.checks.kafka).toBe("unreachable");
  });

  it("/readyz says Kafka is not configured when there are no KAFKA_* settings", async () => {
    const res = await request(appWith(fakeSql(true))).get("/readyz");
    expect(res.body.checks.kafka).toBe("not_configured");
  });

  it("/readyz is not ready when the database is down", async () => {
    const res = await request(appWith(fakeSql(false))).get("/readyz");
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "not_ready", checks: { database: "unreachable" } });
  });
});
