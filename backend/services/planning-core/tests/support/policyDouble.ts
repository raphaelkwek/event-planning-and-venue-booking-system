import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import type { PolicyDecisionPoint, PolicyPrincipal, PolicyResource, Reach } from "../../src/shared/authz/pdp.js";

/**
 * A stand-in for the Cerbos PDP, for unit tests only (vitest.unit.config.ts),
 * which run with no PDP. It reads the same policies in policies/ and answers
 * the two questions planning-core asks, for the shapes our policies use:
 * role rules, the derived roles in derived_roles/connectsphere.yaml, and
 * equality or `in` conditions on resource attributes.
 *
 * It is not the authority. Integration tests and the generated matrix ask a real
 * PDP, and `pdpDouble.test.ts` checks this double against it for every role,
 * kind and action, so the two can't drift apart.
 */

const POLICIES = fileURLToPath(new URL("../../../../../policies/", import.meta.url));

interface Condition {
  match: { expr: string };
}
interface Rule {
  actions: string[];
  effect: string;
  roles?: string[];
  derivedRoles?: string[];
  condition?: Condition;
}
interface DerivedRole {
  name: string;
  parentRoles: string[];
  condition: Condition;
}

function readYaml<T>(relative: string): T[] {
  const dir = join(POLICIES, relative);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".yaml"))
    .map((name) => parse(readFileSync(join(dir, name), "utf8")) as T);
}

const derivedRoles = new Map<string, DerivedRole>(
  readYaml<{ derivedRoles: { definitions: DerivedRole[] } }>("derived_roles").flatMap((file) =>
    file.derivedRoles.definitions.map((role) => [role.name, role] as const)
  )
);

const rulesByKind = new Map<string, Rule[]>(
  readYaml<{ resourcePolicy: { resource: string; rules: Rule[] } }>("resources").map((file) => [
    file.resourcePolicy.resource,
    file.resourcePolicy.rules,
  ])
);

/** Evaluates the two expression forms our policies use, against one request. */
function holds(expr: string, principal: PolicyPrincipal, resource: PolicyResource): boolean {
  const attr = (name: string) => resource.attr[name];
  const equality = expr.match(/^request\.resource\.attr\.(\w+) == (request\.principal\.id|true|false)$/);
  if (equality) {
    const expected = equality[2] === "request.principal.id" ? principal.id : equality[2] === "true";
    return attr(equality[1]!) === expected;
  }
  const membership = expr.match(/^request\.principal\.id in request\.resource\.attr\.(\w+)$/);
  if (membership) {
    const list = attr(membership[1]!);
    return Array.isArray(list) && list.includes(principal.id);
  }
  throw new Error(`The policy double can't evaluate: ${expr}`);
}

function rulesFor(kind: string, action: string): Rule[] {
  return (rulesByKind.get(kind) ?? []).filter((rule) => rule.effect === "EFFECT_ALLOW" && rule.actions.includes(action));
}

export const policyDouble: PolicyDecisionPoint = {
  async reach(principal, kind, action): Promise<Reach> {
    let reach: Reach = "NEVER";
    for (const rule of rulesFor(kind, action)) {
      if (rule.roles?.includes(principal.role)) {
        if (!rule.condition) return "ALWAYS";
        reach = "CONDITIONAL";
      }
      if (rule.derivedRoles?.some((name) => derivedRoles.get(name)?.parentRoles.includes(principal.role))) reach = "CONDITIONAL";
    }
    return reach;
  },
  async allows(principal, resource, action): Promise<boolean> {
    return rulesFor(resource.kind, action).some((rule) => {
      const byRole = rule.roles?.includes(principal.role) ?? false;
      const byRelation =
        rule.derivedRoles?.some((name) => {
          const role = derivedRoles.get(name);
          return !!role && role.parentRoles.includes(principal.role) && holds(role.condition.match.expr, principal, resource);
        }) ?? false;
      if (!byRole && !byRelation) return false;
      return !rule.condition || holds(rule.condition.match.expr, principal, resource);
    });
  },
};
