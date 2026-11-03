import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { permissionGate, POLICY_UNAVAILABLE_MESSAGE, ROLE_NOT_AUTHORISED_MESSAGE } from "../../src/shared/authz/gate.js";
import * as pdpModule from "../../src/shared/authz/pdp.js";

const { httpPolicyDecisionPoint, PolicyUnavailableError, pdp } = pdpModule;

/**
 * EN-07 (EN-07-T2, EN-07-T3): the policy gate every route goes through, and the
 * client for the Cerbos PDP behind it. The PDP here is a small local server that
 * answers in Cerbos's own JSON, so the client's parsing is exercised too; the
 * real PDP is asked by the integration run and the generated matrix.
 */

const principal = { id: "a1111111-0000-4000-8000-000000000001", role: "EVENT_ORGANISER" };

type Handler = (path: string, body: Record<string, unknown>) => unknown;
let answer: Handler = () => ({});
let server: Server;
let url: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const reply = answer(req.url ?? "", raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(reply));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});
afterAll(() => {
  server.closeAllConnections();
  return new Promise<void>((resolve) => server.close(() => resolve()));
});
afterEach(() => vi.restoreAllMocks());

const plan = (kind: string) => ({
  requestId: "",
  action: "view",
  resourceKind: "event",
  policyVersion: "default",
  filter:
    kind === "KIND_CONDITIONAL"
      ? { kind, condition: { expression: { operator: "eq", operands: [{ variable: "request.resource.attr.ownerId" }, { value: principal.id }] } } }
      : { kind },
  cerbosCallId: "call-1",
});

describe("the PDP client (EN-07-T3)", () => {
  it.each([
    ["KIND_ALWAYS_ALLOWED", "ALWAYS"],
    ["KIND_CONDITIONAL", "CONDITIONAL"],
    ["KIND_ALWAYS_DENIED", "NEVER"],
  ])("maps Cerbos's plan %s to %s, asking for the caller's id and role", async (kind, reach) => {
    const asked: Record<string, unknown>[] = [];
    answer = (path, body) => {
      asked.push({ path, ...body });
      return plan(kind);
    };

    await expect(httpPolicyDecisionPoint(url).reach(principal, "event", "view")).resolves.toBe(reach);
    expect(asked[0]).toMatchObject({
      path: "/api/plan/resources",
      principal: { id: principal.id, roles: ["EVENT_ORGANISER"] },
      resource: { kind: "event" },
      action: "view",
    });
  });

  it.each([
    ["EFFECT_ALLOW", true],
    ["EFFECT_DENY", false],
  ])("reads a record decision of %s as %s", async (effect, allowed) => {
    answer = (_path, body) => {
      const resource = (body.resources as { resource: { id: string; kind: string } }[])[0]!.resource;
      return { requestId: "", results: [{ resource: { ...resource, policyVersion: "default" }, actions: { approve: effect } }], cerbosCallId: "c" };
    };
    const record = { kind: "event", id: "e-1", attr: { ownerId: principal.id } };

    await expect(httpPolicyDecisionPoint(url).allows(principal, record, "approve")).resolves.toBe(allowed);
  });

  it("fails closed when CERBOS_URL is not set", async () => {
    const unset = httpPolicyDecisionPoint(undefined);
    await expect(unset.reach(principal, "event", "view")).rejects.toThrow(/CERBOS_URL is not set/);
    await expect(unset.allows(principal, { kind: "event", id: "e", attr: {} }, "view")).rejects.toBeInstanceOf(PolicyUnavailableError);
  });

  it("fails closed when nothing listens at CERBOS_URL", async () => {
    await expect(httpPolicyDecisionPoint("http://127.0.0.1:1").reach(principal, "event", "view")).rejects.toBeInstanceOf(
      PolicyUnavailableError
    );
  });

  it("fails closed when the PDP answers with an error", async () => {
    server.removeAllListeners("request");
    server.on("request", (_req, res) => {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ code: 13, message: "internal" }));
    });
    await expect(httpPolicyDecisionPoint(url).reach(principal, "event", "view")).rejects.toBeInstanceOf(PolicyUnavailableError);
  });

  it("fails closed when the PDP doesn't answer within the timeout", async () => {
    server.removeAllListeners("request");
    server.on("request", () => undefined);
    const started = Date.now();
    await expect(httpPolicyDecisionPoint(url).reach(principal, "event", "view")).rejects.toBeInstanceOf(PolicyUnavailableError);
    expect(Date.now() - started).toBeLessThan(pdpModule.PDP_TIMEOUT_MS + 1_500);
  });
});

function appWith(actor: { userId: string; role: string } | null) {
  const refusals: unknown[] = [];
  const app = express();
  app.use((req, _res, next) => {
    if (actor) (req as Request & { actor?: unknown }).actor = actor;
    next();
  });
  const gate = permissionGate({ kind: "event", action: "approve" }, (_req, res, status, code, message) => {
    refusals.push({ status, code });
    res.status(status).json({ error: { code, message, correlationId: null } });
  });
  app.post("/thing", gate, (_req, res) => res.status(204).end());
  app.use((error: Error, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(error);
    res.status(500).json({ message: error.message });
  });
  return { app, gate, refusals };
}

describe("the policy gate (EN-07-T2, EN-07-T3)", () => {
  const coordinator = { userId: "c-1", role: "EVENT_COORDINATOR" };

  it("EN-07-T2 carries its permission, so the route table can read it", () => {
    expect(appWith(coordinator).gate.permission).toEqual({ kind: "event", action: "approve" });
  });

  it.each(["ALWAYS", "CONDITIONAL"] as const)("EN-07-T2 lets the request on when the role's reach is %s", async (reach) => {
    vi.spyOn(pdp, "reach").mockResolvedValue(reach);
    const response = await request(appWith(coordinator).app).post("/thing");
    expect(response.status).toBe(204);
    expect(pdp.reach).toHaveBeenCalledWith({ id: "c-1", role: "EVENT_COORDINATOR" }, "event", "approve");
  });

  it("EN-07-T2 refuses a role the policy never allows with 403 ROLE_NOT_AUTHORISED", async () => {
    vi.spyOn(pdp, "reach").mockResolvedValue("NEVER");
    const response = await request(appWith({ userId: "o-1", role: "EVENT_ORGANISER" }).app).post("/thing");
    expect(response.status).toBe(403);
    expect(response.body.error).toEqual({ code: "ROLE_NOT_AUTHORISED", message: ROLE_NOT_AUTHORISED_MESSAGE, correlationId: null });
  });

  it("EN-07-T3 refuses with 503 POLICY_UNAVAILABLE, and never lets the request on, when the PDP can't be asked", async () => {
    vi.spyOn(pdp, "reach").mockRejectedValue(new PolicyUnavailableError("connect ECONNREFUSED"));
    const { app, refusals } = appWith(coordinator);
    const response = await request(app).post("/thing");
    expect(response.status).toBe(503);
    expect(response.body.error).toEqual({ code: "POLICY_UNAVAILABLE", message: POLICY_UNAVAILABLE_MESSAGE, correlationId: null });
    expect(refusals).toEqual([{ status: 503, code: "POLICY_UNAVAILABLE" }]);
  });

  it("passes any other failure to the error handler", async () => {
    vi.spyOn(pdp, "reach").mockRejectedValue(new Error("defect"));
    const response = await request(appWith(coordinator).app).post("/thing");
    expect(response.status).toBe(500);
    expect(response.body.message).toBe("defect");
  });

  it("refuses to run before the caller is resolved", async () => {
    const response = await request(appWith(null).app).post("/thing");
    expect(response.status).toBe(500);
    expect(response.body.message).toMatch(/before the caller was resolved/);
  });
});
