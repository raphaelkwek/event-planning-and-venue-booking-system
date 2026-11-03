import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import type { Permission } from "../../src/shared/authz/gate.js";

/**
 * EN-07.3: the route table the generated matrix is built from. It walks the
 * Express router planning-core actually serves (the same walk the OpenAPI test
 * makes, so the two can't disagree) and reads each route's policy gate off it.
 */

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];

interface Layer {
  name?: string;
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] };
  handle?: { stack?: Layer[] };
}

export interface ServedRoute {
  method: string;
  /** In OpenAPI form, e.g. /api/v1/events/{id}. */
  path: string;
  /** The policy gates on this route, normally exactly one. */
  permissions: Permission[];
}

function permissionOf(handle: unknown): Permission | null {
  const permission = (handle as { permission?: Permission } | null)?.permission;
  return permission && typeof permission.kind === "string" && typeof permission.action === "string" ? permission : null;
}

/** Every route, in the order Express matches them. A path served twice keeps both entries. */
export function servedRoutes(stack: Layer[]): ServedRoute[] {
  return stack.flatMap((layer): ServedRoute[] => {
    if (layer.route) {
      const path = layer.route.path.replace(/:(\w+)/g, "{$1}");
      const permissions = layer.route.stack.map((entry) => permissionOf(entry.handle)).filter((p): p is Permission => p !== null);
      return Object.keys(layer.route.methods)
        .filter((method) => HTTP_METHODS.includes(method))
        .map((method) => ({ method: method.toUpperCase(), path, permissions }));
    }
    if (layer.name === "router" && layer.handle?.stack) return servedRoutes(layer.handle.stack);
    return [];
  });
}

export function routesOf(app: unknown): ServedRoute[] {
  return servedRoutes((app as { _router: { stack: Layer[] } })._router.stack);
}

/** The route that answers each method and path: the first registered, as Express picks. */
export function answeringRoutes(routes: ServedRoute[]): ServedRoute[] {
  const seen = new Set<string>();
  return routes.filter((route) => {
    const key = `${route.method} ${route.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** No token needed at all. */
export const PUBLIC_ROUTES = ["GET /healthz", "GET /readyz", "POST /api/v1/auth/login"];

/**
 * A valid session is all these need: each reads or ends the caller's own session
 * (A1), or asks what the caller may do (EN-07), so every role may call them and
 * there is no resource action to ask about.
 */
export const SESSION_ROUTES = [
  "POST /api/v1/auth/logout",
  "GET /api/v1/users/me",
  "GET /api/v1/access-scope/{resource}",
  "POST /api/v1/permissions/check",
];

/** The routes that break EN-07's rule: neither public nor session-only, and not exactly one gate. */
export function ungatedRoutes(routes: ServedRoute[]): string[] {
  const exempt = new Set([...PUBLIC_ROUTES, ...SESSION_ROUTES]);
  return routes
    .filter((route) => {
      const key = `${route.method} ${route.path}`;
      return exempt.has(key) ? route.permissions.length > 0 : route.permissions.length !== 1;
    })
    .map((route) => `${route.method} ${route.path} (${route.permissions.length} gates)`);
}

const POLICIES = fileURLToPath(new URL("../../../../../policies/resources/", import.meta.url));

interface ResourcePolicy {
  resourcePolicy: { resource: string; rules: { actions: string[]; effect: string }[] };
}

/** Every action each policy allows to someone, by resource kind, read from policies/resources/. */
export function grantedActions(): Map<string, Set<string>> {
  const granted = new Map<string, Set<string>>();
  for (const file of readdirSync(POLICIES).filter((name) => name.endsWith(".yaml"))) {
    const { resourcePolicy } = parse(readFileSync(join(POLICIES, file), "utf8")) as ResourcePolicy;
    const actions = granted.get(resourcePolicy.resource) ?? new Set<string>();
    for (const rule of resourcePolicy.rules) {
      if (rule.effect === "EFFECT_ALLOW") rule.actions.forEach((action) => actions.add(action));
    }
    granted.set(resourcePolicy.resource, actions);
  }
  return granted;
}

/** The gates naming a kind or action that no policy grants to anyone. */
export function gatesWithoutAPolicy(routes: ServedRoute[], granted = grantedActions()): string[] {
  return routes.flatMap((route) =>
    route.permissions
      .filter((permission) => !granted.get(permission.kind)?.has(permission.action))
      .map((permission) => `${route.method} ${route.path} asks ${permission.kind} ${permission.action}`)
  );
}
