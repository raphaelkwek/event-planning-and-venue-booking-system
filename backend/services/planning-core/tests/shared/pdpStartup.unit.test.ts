import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { localPolicyDecisionPoint } from "../../src/shared/authz/localPolicies.js";
import { logger } from "../../src/shared/logger.js";
import {
  assertPdpModeAllowed,
  choosePdpMode,
  configurePolicyDecisionPoint,
  PRODUCTION_REFUSES_LOCAL_POLICIES,
  probeCerbos,
} from "../../src/shared/authz/startup.js";

/**
 * EN-07: which PDP planning-core asks. In development, the local policies when no
 * Cerbos PDP answers; in production, never: the real PDP or a 503.
 */

const unreachable = vi.fn(async () => false);
const reachable = vi.fn(async () => true);

describe("choosing the PDP at startup", () => {
  it("in production always asks the Cerbos PDP, even when it can't be reached, and never probes for a fallback", async () => {
    const probe = vi.fn(async () => false);
    expect(await choosePdpMode({ NODE_ENV: "production", CERBOS_URL: "http://127.0.0.1:1" }, probe)).toBe("cerbos");
    expect(await choosePdpMode({ NODE_ENV: "production" }, probe)).toBe("cerbos");
    expect(probe).not.toHaveBeenCalled();
  });

  it("refuses the local-policies mode in production, at startup and in the evaluator itself", () => {
    expect(() => assertPdpModeAllowed("local-policies", { NODE_ENV: "production" })).toThrow(PRODUCTION_REFUSES_LOCAL_POLICIES);
    expect(() => assertPdpModeAllowed("cerbos", { NODE_ENV: "production" })).not.toThrow();
    expect(() => localPolicyDecisionPoint(undefined, { NODE_ENV: "production" })).toThrow(/development only/);
  });

  it("in production with no PDP configured, stays on the Cerbos client, which then refuses with 503", async () => {
    const use = vi.fn();
    const error = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    expect(await configurePolicyDecisionPoint({ NODE_ENV: "production" }, unreachable, use)).toBe("cerbos");
    expect(use).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/CERBOS_URL is not set/), expect.anything());
    error.mockRestore();
  });

  it.each([
    ["CERBOS_URL is unset", { NODE_ENV: "development" }],
    ["no PDP answers at CERBOS_URL", { NODE_ENV: "development", CERBOS_URL: "http://127.0.0.1:1" }],
    ["NODE_ENV is unset and no PDP answers", { CERBOS_URL: "http://127.0.0.1:1" }],
  ])("in development, uses the local policies when %s, with one loud warning", async (_case, env) => {
    const use = vi.fn();
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    expect(await configurePolicyDecisionPoint(env, unreachable, use)).toBe("local-policies");
    expect(use).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/LOCAL-POLICIES MODE \(development only\)/);
    // The evaluator it installed answers from policies/.
    const local = use.mock.calls[0]![0] as ReturnType<typeof localPolicyDecisionPoint>;
    expect(await local.reach({ id: "o", role: "EVENT_ORGANISER" }, "event", "create")).toBe("ALWAYS");
    expect(await local.reach({ id: "o", role: "EVENT_ORGANISER" }, "event", "approve")).toBe("NEVER");
    warn.mockRestore();
  });

  it("in development, asks the Cerbos PDP when one answers", async () => {
    const use = vi.fn();
    expect(await configurePolicyDecisionPoint({ NODE_ENV: "development", CERBOS_URL: "http://127.0.0.1:3592" }, reachable, use)).toBe("cerbos");
    expect(use).not.toHaveBeenCalled();
  });
});

describe("probing for a PDP", () => {
  let server: Server;
  let url: string;
  beforeAll(async () => {
    server = createServer((req, res) => {
      res.statusCode = req.url === "/_cerbos/health" ? 200 : 404;
      res.end('{"status":"SERVING"}');
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("finds a PDP that answers its health check", async () => {
    expect(await probeCerbos(url, 1_000)).toBe(true);
  });

  it("gives up on an address nothing listens at once the window passes", async () => {
    expect(await probeCerbos("http://127.0.0.1:1", 600)).toBe(false);
  });
});
