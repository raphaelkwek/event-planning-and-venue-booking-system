import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * A stand-in for planning-core's GET /api/v1/users/me, for the load and chaos runs only (EN-18, EN-20).
 *
 * Registering, withdrawing and "my registrations" ask identity who a token belongs to (ADR-0005). The
 * real route verifies the token, reads two tables, and limits each address to 120 requests a minute,
 * so one load generator would be refused by it, not by the registration service under test. This
 * answers from the token alone: `load-attendee-<n>` is attendee number n.
 *
 * What that leaves out is written into the evidence: the numbers measured behind it do not include
 * planning-core's share of each registration's latency or CPU. It listens on the loopback address only.
 */

export const ATTENDEE_TOKEN_PREFIX = "load-attendee-";

/** The user id attendee number n has: deterministic, so a run can be read back from the database. */
export function attendeeIdOf(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

/** The attendee number a stub token names, or null when it is not one. */
export function attendeeNumberOf(token: string): number | null {
  if (!token.startsWith(ATTENDEE_TOKEN_PREFIX)) return null;
  const text = token.slice(ATTENDEE_TOKEN_PREFIX.length);
  return /^\d{1,12}$/.test(text) ? Number(text) : null;
}

export interface IdentityStub {
  url: string;
  server: Server;
  close(): Promise<void>;
}

export async function startIdentityStub(port: number): Promise<IdentityStub> {
  const server = createServer((req, res) => {
    const respond = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
    };
    if (req.method !== "GET" || req.url !== "/api/v1/users/me") return respond(404, { error: { code: "NOT_FOUND", message: "Not part of the stand-in." } });
    const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1] ?? "";
    const n = attendeeNumberOf(token);
    if (n === null) return respond(401, { error: { code: "UNAUTHENTICATED", message: "No active session for this token." } });
    respond(200, { id: attendeeIdOf(n), email: `attendee-${n}@connectsphere.test`, role: "ATTENDEE" });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
  const { port: bound } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${bound}`,
    server,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
