import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres, { type Sql } from "postgres";
import { createProxy, timed, toxiproxyIsUp, type Proxy } from "../support/toxiproxy.js";
import { portOf, withPort } from "../support/urls.js";

/**
 * EN-20-T7: Toxiproxy runs in CI and a toxic really changes the connection. Every experiment that uses
 * Toxiproxy (2, 3, 5) rests on this: if a 500 ms latency toxic did not slow a query, or a disabled proxy
 * still let one through, their results would mean nothing.
 */

const DATABASE_URL = process.env.DATABASE_URL!;
const PROXY_PORT = 15433;
let proxy: Proxy;
const open: Sql[] = [];

const connectVia = () => {
  const sql = postgres(withPort(DATABASE_URL, PROXY_PORT), { max: 1, prepare: false, connect_timeout: 5 });
  open.push(sql);
  return sql;
};

beforeAll(async () => {
  expect(await toxiproxyIsUp(), "Toxiproxy must be running (CI starts the ghcr.io/shopify/toxiproxy container)").toBe(true);
  proxy = await createProxy("postgres-selfcheck", `127.0.0.1:${PROXY_PORT}`, `127.0.0.1:${portOf(DATABASE_URL)}`);
});

afterAll(async () => {
  await Promise.allSettled(open.map((sql) => sql.end({ timeout: 1 })));
  await proxy?.remove();
});

describe("Toxiproxy (EN-20-T7)", () => {
  it("a 500 ms latency toxic makes a query through the proxy at least 500 ms slower (EN-20-T7)", async () => {
    const sql = connectVia();
    await sql`select 1`; // connect first, so the connection set-up is not in either measurement
    const normal = await timed(() => sql`select 1`);

    await proxy.addToxic({ name: "slow", type: "latency", attributes: { latency: 500, jitter: 0 } });
    const slowed = await timed(() => sql`select 1`);
    await proxy.removeToxic("slow");
    const restored = await timed(() => sql`select 1`);

    console.log(`select 1 through the proxy: ${normal.ms.toFixed(0)} ms normally, ${slowed.ms.toFixed(0)} ms with the toxic, ${restored.ms.toFixed(0)} ms after it was removed`);
    expect(slowed.ms).toBeGreaterThanOrEqual(normal.ms + 500 - 50);
    expect(restored.ms).toBeLessThan(slowed.ms - 400);
  });

  it("a disabled proxy refuses new connections and drops the open one, and enabling it brings both back (EN-20-T7)", async () => {
    const sql = connectVia();
    await sql`select 1`;
    await proxy.setEnabled(false);
    await expect(sql`select 1`).rejects.toThrow();
    const another = connectVia();
    await expect(another`select 1`).rejects.toThrow();

    await proxy.setEnabled(true);
    const again = connectVia();
    expect((await again`select 1 as one`)[0]!.one).toBe(1);
  });
});
