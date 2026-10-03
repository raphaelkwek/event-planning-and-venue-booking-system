import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { Sql } from "postgres";
import { newTraceparent } from "../../src/shared/tracing.js";
import { healthRouter } from "../../src/shared/health.js";
import { brokerProbe, type ProbeAdmin } from "../../src/shared/kafka/probe.js";

/** EN-04.2: trace ids for new messages, and /readyz reporting the broker. */

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

function fakeAdmin(reachable: () => boolean): ProbeAdmin & { connects: number; disconnects: number } {
  const admin = {
    connects: 0,
    disconnects: 0,
    async connect() {
      admin.connects += 1;
      if (!reachable()) throw new Error("broker down");
    },
    async describeCluster() {
      return {};
    },
    async disconnect() {
      admin.disconnects += 1;
    },
  };
  return admin;
}

describe("brokerProbe", () => {
  it("connects, asks the cluster to describe itself, and disconnects so no socket stays open", async () => {
    const admin = fakeAdmin(() => true);
    expect(await brokerProbe(() => admin)()).toBe(true);
    expect(admin).toMatchObject({ connects: 1, disconnects: 1 });
  });

  it("reports an unreachable broker as false, still disconnecting", async () => {
    const admin = fakeAdmin(() => false);
    expect(await brokerProbe(() => admin)()).toBe(false);
    expect(admin.disconnects).toBe(1);
  });

  it("still answers when disconnecting fails too", async () => {
    const admin = fakeAdmin(() => false);
    admin.disconnect = async () => {
      throw new Error("already closed");
    };
    expect(await brokerProbe(() => admin)()).toBe(false);
  });

  it("reuses its answer for a few seconds, so a busy /readyz does not hammer the broker", async () => {
    let now = 0;
    const admin = fakeAdmin(() => true);
    const probe = brokerProbe(() => admin, { ttlMs: 5000, now: () => now });
    await probe();
    now = 4999;
    await probe();
    expect(admin.connects).toBe(1);
    now = 5000;
    await probe();
    expect(admin.connects).toBe(2);
  });

  it("asks once when several requests arrive together", async () => {
    const admin = fakeAdmin(() => true);
    const describeCluster = vi.spyOn(admin, "describeCluster");
    const probe = brokerProbe(() => admin);
    await Promise.all([probe(), probe(), probe()]);
    expect(describeCluster).toHaveBeenCalledTimes(1);
  });
});
