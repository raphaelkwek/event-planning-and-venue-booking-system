/**
 * A small client for Toxiproxy's HTTP API (EN-20). Toxiproxy sits between a service and its database or
 * broker and breaks the connection on command: it adds latency, resets connections, or goes down.
 * https://github.com/Shopify/toxiproxy#http-api
 *
 * CI starts the `ghcr.io/shopify/toxiproxy` container on the runner (host network); nothing here
 * can reach beyond it, and every proxy listens on the loopback address.
 */

export const TOXIPROXY_URL = process.env.TOXIPROXY_URL ?? "http://127.0.0.1:8474";

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${TOXIPROXY_URL}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Toxiproxy ${method} ${path} answered ${response.status}: ${await response.text()}`);
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export type ToxicType = "latency" | "reset_peer" | "timeout" | "limit_data" | "bandwidth" | "slow_close";

export interface Toxic {
  name: string;
  type: ToxicType;
  /** `downstream` is the server's answers to the client; `upstream` is the client's requests to the server. */
  stream?: "upstream" | "downstream";
  toxicity?: number;
  attributes: Record<string, number>;
}

export interface Proxy {
  name: string;
  /** The address the service connects to. */
  listen: string;
  addToxic(toxic: Toxic): Promise<void>;
  removeToxic(name: string): Promise<void>;
  /** Switching a proxy off closes its connections and refuses new ones: the dependency is "down". */
  setEnabled(enabled: boolean): Promise<void>;
  remove(): Promise<void>;
}

export async function toxiproxyIsUp(): Promise<boolean> {
  try {
    await api("GET", "/version");
    return true;
  } catch {
    return false;
  }
}

export async function createProxy(name: string, listen: string, upstream: string): Promise<Proxy> {
  // A proxy left by an earlier run on the same machine would hold the port.
  await api("DELETE", `/proxies/${name}`).catch(() => undefined);
  await api("POST", "/proxies", { name, listen, upstream, enabled: true });
  return {
    name,
    listen,
    addToxic: (toxic) => api("POST", `/proxies/${name}/toxics`, { stream: "downstream", toxicity: 1, ...toxic }),
    removeToxic: (toxicName) => api("DELETE", `/proxies/${name}/toxics/${toxicName}`),
    setEnabled: (enabled) => api("POST", `/proxies/${name}`, { enabled }),
    remove: () => api("DELETE", `/proxies/${name}`),
  };
}

/** Time `work` in milliseconds. */
export async function timed<T>(work: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const startedAt = performance.now();
  const result = await work();
  return { result, ms: performance.now() - startedAt };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Polls until `check` returns a value, or fails naming what it waited for. */
export async function waitFor<T>(what: string, check: () => Promise<T | null | undefined | false>, timeoutMs = 60_000, everyMs = 250): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await sleep(everyMs);
  }
  throw new Error(`Timed out after ${timeoutMs} ms waiting for ${what}`);
}
