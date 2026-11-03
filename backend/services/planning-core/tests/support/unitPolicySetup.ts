import { vi } from "vitest";

/**
 * Unit runs have no Cerbos PDP (vitest.unit.config.ts), so every route's policy
 * gate asks the policy double, which reads the same policies/. Integration runs
 * (vitest.config.ts, CI) ask the real PDP at CERBOS_URL instead.
 */
vi.mock("../../src/shared/authz/pdp.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/shared/authz/pdp.js")>("../../src/shared/authz/pdp.js");
  const { policyDouble } = await import("./policyDouble.js");
  return { ...actual, pdp: policyDouble };
});
