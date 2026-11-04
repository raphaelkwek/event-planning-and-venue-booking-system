import { request as httpRequest } from "node:http";
import { ACCOUNTS, SEED_PASSWORD, type AccountKey } from "./accounts.js";
import { ANON_KEY, AUTH_URL, HOST, PORTS } from "./stack.js";

/**
 * Seeds what a journey needs through the services' own APIs, as the user who would do it. It
 * talks to planning-core directly (not through the web app), and from a second loopback
 * address, so that seeding never spends the browser's share of planning-core's per-address
 * rate limits.
 */
const PLANNING_CORE = { host: HOST, port: PORTS.planningCore };
/**
 * planning-core limits requests per address (120 a minute on the event routes). Seeding for many
 * journeys in a row would spend one address's budget, so each call leaves from the next of 32
 * loopback addresses (127.0.2.1 to 127.0.2.32), as the preview proxy does for the browser.
 */
const SEED_ADDRESSES = Array.from({ length: 32 }, (_, i) => `127.0.2.${i + 1}`);
let nextSeedAddress = 0;
const seedAddress = () => (process.platform === "linux" ? SEED_ADDRESSES[nextSeedAddress++ % SEED_ADDRESSES.length] : undefined);

const tokens = new Map<AccountKey, string>();

export async function tokenFor(key: AccountKey): Promise<string> {
  const cached = tokens.get(key);
  if (cached) return cached;
  const response = await fetch(`${AUTH_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ email: ACCOUNTS[key].email, password: SEED_PASSWORD }),
  });
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error(`The fake auth server refused ${key}`);
  tokens.set(key, body.access_token);
  return body.access_token;
}

export interface ApiResult<T> {
  status: number;
  body: T;
}

export async function call<T = unknown>(
  as: AccountKey,
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const token = await tokenFor(as);
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        ...PLANNING_CORE,
        method,
        path,
        localAddress: seedAddress(),
        headers: {
          Authorization: `Bearer ${token}`,
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let parsed: unknown = null;
          try {
            parsed = text ? JSON.parse(text) : null;
          } catch {
            parsed = text;
          }
          resolve({ status: res.statusCode ?? 0, body: parsed as T });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Calls the API and throws, with the server's answer, unless the status is the one expected. */
export async function must<T = unknown>(
  as: AccountKey,
  method: string,
  path: string,
  body?: unknown,
  expected: number[] = [200, 201],
): Promise<T> {
  const result = await call<T>(as, method, path, body);
  if (!expected.includes(result.status)) {
    throw new Error(`${as} ${method} ${path} answered ${result.status}: ${JSON.stringify(result.body)}`);
  }
  return result.body;
}
