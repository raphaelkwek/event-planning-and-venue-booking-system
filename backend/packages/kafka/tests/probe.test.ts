import { describe, expect, it, vi } from "vitest";
import { brokerProbe, type ProbeAdmin } from "../src/probe.js";

/** EN-04.2: whether a broker answers, for each service's /readyz. */

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

  it("still says reachable when the check succeeded but disconnecting failed", async () => {
    const admin = fakeAdmin(() => true);
    admin.disconnect = async () => {
      throw new Error("already closed");
    };
    expect(await brokerProbe(() => admin)()).toBe(true);
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
