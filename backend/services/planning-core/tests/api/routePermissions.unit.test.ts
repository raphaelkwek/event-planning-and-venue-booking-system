import express, { Router } from "express";
import { describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { requireRole } from "../../src/modules/event/auth/actor.js";
import {
  answeringRoutes,
  gatesWithoutAPolicy,
  PUBLIC_ROUTES,
  routesOf,
  SESSION_ROUTES,
  ungatedRoutes,
} from "../support/routeTable.js";

/**
 * EN-07.3 (EN-07-T12): every route planning-core serves names the policy resource
 * and action it performs, and that action is one policies/ grants to someone.
 * A route added without a gate, or naming an action no policy has, fails here,
 * and so does the generated matrix that is built from the same table.
 */

const noop = (_req: unknown, _res: unknown, next: () => void) => next();

describe("planning-core's route table (EN-07-T12)", () => {
  const routes = routesOf(app);

  it("EN-07-T12 every route that is not public or session-only has exactly one policy gate", () => {
    expect(routes.length).toBeGreaterThan(80);
    expect(ungatedRoutes(routes)).toEqual([]);
  });

  it("EN-07-T12 every gate names an action that a policy in policies/resources grants", () => {
    expect(gatesWithoutAPolicy(routes)).toEqual([]);
  });

  it("EN-07-T12 the public and session-only lists name routes that exist", () => {
    const served = new Set(answeringRoutes(routes).map((route) => `${route.method} ${route.path}`));
    expect([...PUBLIC_ROUTES, ...SESSION_ROUTES].filter((key) => !served.has(key))).toEqual([]);
  });

  it("EN-07-T12 a route added without a gate is reported", () => {
    const router = Router();
    router.get("/api/v1/new-thing", noop);
    router.post("/api/v1/new-thing", noop, requireRole("event", "view"), noop);
    const extra = express();
    extra.use(router);

    expect(ungatedRoutes(routesOf(extra))).toEqual(["GET /api/v1/new-thing (0 gates)"]);
  });

  it("EN-07-T12 a gate naming an action no policy grants is reported", () => {
    const router = Router();
    router.post("/api/v1/new-thing", noop, requireRole("event", "teleport"), noop);
    const extra = express();
    extra.use(router);

    expect(gatesWithoutAPolicy(routesOf(extra))).toEqual(["POST /api/v1/new-thing asks event teleport"]);
  });
});
