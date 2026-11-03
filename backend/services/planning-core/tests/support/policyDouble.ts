import { localPolicyDecisionPoint } from "../../src/shared/authz/localPolicies.js";

/**
 * The stand-in for the Cerbos PDP that unit runs ask (vitest.unit.config.ts), which
 * have no PDP: the same local-policies evaluator `npm run dev` falls back to when no
 * PDP is reachable. `pdpDouble.test.ts` holds it to the real PDP in CI.
 */
export const policyDouble = localPolicyDecisionPoint();
