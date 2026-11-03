import { ROLES } from "@connectsphere/contracts";
import { describe, expect, it } from "vitest";
import { pdp } from "../../src/shared/authz/pdp.js";
import { policyDouble } from "../support/policyDouble.js";
import { grantedActions } from "../support/routeTable.js";

/**
 * EN-07: unit runs, which have no PDP, ask tests/support/policyDouble.ts instead.
 * This run has the real Cerbos PDP (CERBOS_URL, CI's service container), so it
 * checks the double gives Cerbos's own answer for every role, kind and action,
 * on a related and an unrelated record. If the policies grow a shape the double
 * can't read, this fails rather than letting unit runs drift.
 */

const ME = "a7000000-0000-4000-8000-000000000001";
const SOMEONE_ELSE = "a7000000-0000-4000-8000-000000000002";

const related = { ownerId: ME, assignedCoordinatorId: ME, pendingNomineeId: ME, venueStaffIds: [ME], attendeeId: ME, registrationOpen: true };
const unrelated = {
  ownerId: SOMEONE_ELSE,
  assignedCoordinatorId: SOMEONE_ELSE,
  pendingNomineeId: SOMEONE_ELSE,
  venueStaffIds: [SOMEONE_ELSE],
  attendeeId: SOMEONE_ELSE,
  registrationOpen: false,
};

describe.skipIf(!process.env.CERBOS_URL)("the unit runs' policy double, against the real PDP", () => {
  const cases = [...grantedActions()].flatMap(([kind, actions]) =>
    [...actions].flatMap((action) => ROLES.map((role) => ({ kind, action, role })))
  );

  it("covers every granted action", () => {
    expect(cases.length).toBeGreaterThan(100);
  });

  it("gives Cerbos's reach and record decisions for every role, kind and action", async () => {
    const mismatches: string[] = [];
    for (const { kind, action, role } of cases) {
      const principal = { id: ME, role };
      const [real, double] = await Promise.all([pdp.reach(principal, kind, action), policyDouble.reach(principal, kind, action)]);
      if (real !== double) mismatches.push(`${role} ${kind} ${action}: reach ${real}, double ${double}`);
      for (const [name, attr] of [["related", related], ["unrelated", unrelated]] as const) {
        const resource = { kind, id: `${kind}-1`, attr };
        const [allowed, doubleAllowed] = await Promise.all([pdp.allows(principal, resource, action), policyDouble.allows(principal, resource, action)]);
        if (allowed !== doubleAllowed) mismatches.push(`${role} ${kind} ${action} ${name}: allows ${allowed}, double ${doubleAllowed}`);
      }
    }
    expect(mismatches).toEqual([]);
  }, 120_000);
});
