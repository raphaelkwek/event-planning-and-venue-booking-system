import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import type { PermissionCheck } from "../../src/api/permissions.js";

/**
 * The answer planning-core's POST /api/v1/permissions/check gives a role, for
 * screen tests that have no server: read from the same policies/ the server's
 * Cerbos PDP loads. `allowed` means the role may take the action on at least
 * some records, which is a rule naming the role or a derived role (owner,
 * assigned coordinator, venue staff) whose parent is the role. The server's own
 * tests hold its answers to the real PDP.
 */

// jsdom gives import.meta.url an http: URL, so the policies are found from the working directory
// (frontend/ under npm run test -w, or the repository root).
const POLICIES = [resolve(process.cwd(), "..", "policies"), resolve(process.cwd(), "policies")].find(existsSync)!;

interface Rule {
  actions: string[];
  effect: string;
  roles?: string[];
  derivedRoles?: string[];
}

function yamlIn<T>(dir: string): T[] {
  return readdirSync(join(POLICIES, dir))
    .filter((name) => name.endsWith(".yaml"))
    .map((name) => parse(readFileSync(join(POLICIES, dir, name), "utf8")) as T);
}

const parents = new Map<string, string[]>(
  yamlIn<{ derivedRoles: { definitions: { name: string; parentRoles: string[] }[] } }>("derived_roles").flatMap((file) =>
    file.derivedRoles.definitions.map((role) => [role.name, role.parentRoles] as const)
  )
);

const rules = new Map<string, Rule[]>(
  yamlIn<{ resourcePolicy: { resource: string; rules: Rule[] } }>("resources").map((file) => [
    file.resourcePolicy.resource,
    file.resourcePolicy.rules,
  ])
);

export function allowedFor(role: string, check: PermissionCheck): boolean {
  return (rules.get(check.kind) ?? []).some(
    (rule) =>
      rule.effect === "EFFECT_ALLOW" &&
      rule.actions.includes(check.action) &&
      (rule.roles?.includes(role) || rule.derivedRoles?.some((name) => parents.get(name)?.includes(role)))
  );
}
