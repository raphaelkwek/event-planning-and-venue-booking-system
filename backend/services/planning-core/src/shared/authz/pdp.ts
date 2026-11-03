import { HTTP } from "@cerbos/http";
import { PlanKind, type Value } from "@cerbos/core";

/**
 * EN-07, ADR-0010: the one client for the Cerbos policy decision point (PDP).
 * The policies in policies/ are the single list of who may do what; the
 * services, the permissions check the staff console's navigation calls and
 * (once EN-12 exists) the gateway all ask the same PDP.
 *
 * `CERBOS_URL` is the PDP's HTTP address, such as http://127.0.0.1:3592
 * locally (`npm run cerbos:start`) or http://cerbos:3592 in CI and in each
 * Kubernetes namespace. The PDP is never exposed publicly: only the services
 * reach it.
 *
 * Fail closed. If CERBOS_URL is unset, or the PDP doesn't answer in time, every
 * question throws PolicyUnavailableError and the request is refused with 503,
 * never let through.
 */

/** How long a question may take before it counts as unanswered. */
export const PDP_TIMEOUT_MS = 2_000;

export interface PolicyPrincipal {
  id: string;
  role: string;
}

export interface PolicyResource {
  kind: string;
  id: string;
  attr: Record<string, Value>;
}

/**
 * The role-level answer for one kind and action, as Cerbos's query planner
 * gives it: always allowed, allowed only for some records (a relationship such
 * as owner or assigned coordinator decides), or never.
 */
export type Reach = "ALWAYS" | "CONDITIONAL" | "NEVER";

export class PolicyUnavailableError extends Error {
  constructor(cause: string) {
    super(`The policy decision point could not be asked: ${cause}`);
    this.name = "PolicyUnavailableError";
  }
}

export interface PolicyDecisionPoint {
  /** Whether this principal's role may ever take `action` on a `kind`. */
  reach(principal: PolicyPrincipal, kind: string, action: string): Promise<Reach>;
  /** Whether this principal may take `action` on this record, given the attributes the service holds for it. */
  allows(principal: PolicyPrincipal, resource: PolicyResource, action: string): Promise<boolean>;
}

function reachOf(kind: PlanKind): Reach {
  if (kind === PlanKind.ALWAYS_ALLOWED) return "ALWAYS";
  if (kind === PlanKind.ALWAYS_DENIED) return "NEVER";
  return "CONDITIONAL";
}

async function ask<T>(question: (signal: AbortSignal) => Promise<T>): Promise<T> {
  try {
    return await question(AbortSignal.timeout(PDP_TIMEOUT_MS));
  } catch (error) {
    throw new PolicyUnavailableError((error as Error).message);
  }
}

const principalOf = (principal: PolicyPrincipal) => ({ id: principal.id, roles: [principal.role] });

export function httpPolicyDecisionPoint(url: string | undefined): PolicyDecisionPoint {
  if (!url) {
    const unset = () => Promise.reject(new PolicyUnavailableError("CERBOS_URL is not set"));
    return { reach: unset, allows: unset };
  }
  const client = new HTTP(url.replace(/\/+$/, ""));
  return {
    reach: (principal, kind, action) =>
      ask(async (signal) => {
        const plan = await client.planResources(
          { principal: principalOf(principal), resource: { kind }, action },
          { signal }
        );
        return reachOf(plan.kind);
      }),
    allows: (principal, resource, action) =>
      ask(async (signal) => {
        const decision = await client.checkResource(
          { principal: principalOf(principal), resource, actions: [action] },
          { signal }
        );
        return decision.isAllowed(action) === true;
      }),
  };
}

let current: PolicyDecisionPoint = httpPolicyDecisionPoint(process.env.CERBOS_URL);

/**
 * The PDP planning-core asks: the Cerbos PDP at CERBOS_URL, unless startup.ts chose
 * the local-policies mode for development. Tests replace it (vi.mock) or point
 * CERBOS_URL at a real one.
 */
export const pdp: PolicyDecisionPoint = {
  reach: (principal, kind, action) => current.reach(principal, kind, action),
  allows: (principal, resource, action) => current.allows(principal, resource, action),
};

/** Called once, by startup.ts, before the server takes requests. */
export function usePolicyDecisionPoint(next: PolicyDecisionPoint): void {
  current = next;
}
