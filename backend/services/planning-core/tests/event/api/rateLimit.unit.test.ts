import { describe, expect, it } from "vitest";
import express, { type RequestHandler, type Router } from "express";
import request from "supertest";
import type { Sql } from "postgres";
import { draftsRouter } from "../../../src/modules/event/api/drafts.js";
import { eventsRouter } from "../../../src/modules/event/api/events.js";
import { clarificationsRouter } from "../../../src/modules/event/api/clarifications.js";
import { decisionsRouter } from "../../../src/modules/event/api/decisions.js";
import { reassignmentsRouter } from "../../../src/modules/event/api/reassignments.js";
import { registrationSettingsRouter } from "../../../src/modules/event/api/registrationSettings.js";

/**
 * M11: every route of these routers is limited before it authenticates or touches
 * the database. Each router takes the limiter as a parameter; this passes one that
 * always refuses, walks every route the router registers, and checks the answer is
 * RATE_LIMITED and that nothing after the limiter ran.
 */

const untouched = (() => {
  throw new Error("the database should not be touched");
}) as unknown as Sql;

const refuseAll: RequestHandler = (_req, res) => {
  res.status(429).json({ error: { code: "RATE_LIMITED", message: "slow down", correlationId: null } });
};

type Layer = { route?: { path: string; methods: Record<string, boolean> } };
const routesOf = (router: Router) =>
  (router.stack as Layer[]).flatMap((layer) =>
    layer.route ? Object.keys(layer.route.methods).map((method) => ({ method, path: layer.route!.path })) : [],
  );

const routers: [string, (limiter: RequestHandler) => Router, number][] = [
  ["draftsRouter", (l) => draftsRouter(untouched, l), 4],
  ["eventsRouter", (l) => eventsRouter(untouched, l), 4],
  ["clarificationsRouter", (l) => clarificationsRouter(untouched, l), 3],
  ["decisionsRouter", (l) => decisionsRouter(untouched, l), 2],
  ["reassignmentsRouter", (l) => reassignmentsRouter(untouched, l), 4],
  ["registrationSettingsRouter", (l) => registrationSettingsRouter(untouched, l), 1],
];

describe.each(routers)("M11: %s", (_name, build, expectedRoutes) => {
  it("answers RATE_LIMITED on every route, before authentication", async () => {
    const router = build(refuseAll);
    const routes = routesOf(router);
    expect(routes).toHaveLength(expectedRoutes);
    const app = express().use(router);
    for (const { method, path } of routes) {
      const res = await request(app)[method as "get"](path.replace(":id", "11111111-1111-4111-8111-111111111111"));
      expect(res.status, `${method} ${path}`).toBe(429);
      expect(res.body.error.code).toBe("RATE_LIMITED");
    }
  });
});
