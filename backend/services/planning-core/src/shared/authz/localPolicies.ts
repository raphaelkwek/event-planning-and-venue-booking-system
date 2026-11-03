import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import type { PolicyDecisionPoint, PolicyPrincipal, PolicyResource, Reach } from "./pdp.js";

/**
 * EN-07: the local-policies mode, for development only. It reads the same
 * policies/ the Cerbos PDP loads and answers the two questions planning-core
 * asks, for the shapes our policies use: role rules, the derived roles in
 * derived_roles/connectsphere.yaml, and equality or `in` conditions on resource
 * attributes. Unit tests use it too, since they run with no PDP.
 *
 * It is not the authority. `pdpDouble.test.ts` checks it against the real PDP
 * for every role, kind and action in CI, so the two can't drift apart. It can
 * never run in production: constructing it there throws (startup.ts asserts the
 * same), so a deployment always asks the real PDP and fails closed without it.
 */

/** policies/ at the repository root, from src/shared/authz/ (or dist/shared/authz/). */
const POLICIES = fileURLToPath(new URL("../../../../../../policies/", import.meta.url));

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

function readYaml<T>(root: string, relative: string): T[] {
  const dir = join(root, relative);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".yaml"))
    .map((name) => parse(readFileSync(join(dir, name), "utf8")) as T);
}

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
  throw new Error(`The local policies can't evaluate: ${expr}`);
}

export function localPolicyDecisionPoint(
  root: string = POLICIES,
  env: NodeJS.ProcessEnv = process.env
): PolicyDecisionPoint {
  if (env.NODE_ENV === "production") {
    throw new Error("The local-policies PDP is for development only; production must ask the Cerbos PDP at CERBOS_URL.");
  }
  // Read once, on first use, so importing this file reads nothing.
  let loaded: { derivedRoles: Map<string, DerivedRole>; rulesByKind: Map<string, Rule[]> } | null = null;
  const policies = () => {
    loaded ??= {
      derivedRoles: new Map(
        readYaml<{ derivedRoles: { definitions: DerivedRole[] } }>(root, "derived_roles").flatMap((file) =>
          file.derivedRoles.definitions.map((role) => [role.name, role] as const)
        )
      ),
      rulesByKind: new Map(
        readYaml<{ resourcePolicy: { resource: string; rules: Rule[] } }>(root, "resources").map((file) => [
          file.resourcePolicy.resource,
          file.resourcePolicy.rules,
        ])
      ),
    };
    return loaded;
  };
  const rulesFor = (kind: string, action: string) =>
    (policies().rulesByKind.get(kind) ?? []).filter((rule) => rule.effect === "EFFECT_ALLOW" && rule.actions.includes(action));

  return {
    async reach(principal, kind, action): Promise<Reach> {
      const { derivedRoles } = policies();
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
      const { derivedRoles } = policies();
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
}
