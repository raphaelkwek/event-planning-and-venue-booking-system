import { describe, expect, it } from "vitest";
import { ROLES } from "@connectsphere/contracts";
import { policyDouble } from "../../support/policyDouble.js";

/**
 * F2 — who may read an event's status history. Until EN-07 this was a role list
 * in the event module's domain (HISTORY_ROLES); it is now the policies' to say
 * (policies/resources/event.yaml, `view_history`), and the route's gate asks them.
 * The unit run asks the policy double, which pdpDouble.test.ts holds to the real
 * Cerbos PDP.
 */

const canViewHistory = async (role: (typeof ROLES)[number]) =>
  (await policyDouble.reach({ id: "f2-reader", role }, "event", "view_history")) !== "NEVER";

describe("who may read an event's status history (F2)", () => {
  it.each([
    ["EVENT_ORGANISER", true],
    ["EVENT_COORDINATOR", true],
    ["VENUE_STAFF", false],
    ["TECH_SUPPORT_STAFF", false],
    ["ATTENDEE", false],
    // E5 gives the Lead each event's assignment history, not its status history.
    ["EVENT_COORDINATOR_LEAD", false],
    // U1: the Safety Officer reads the review's factors, and the decision is recorded for them, not the history.
    ["SAFETY_OFFICER", false],
  ] as const)("%s: %s", async (role, allowed) => {
    expect(await canViewHistory(role)).toBe(allowed);
  });

  it("covers every role, so a new role has to be decided in the policy", async () => {
    const readers = [];
    for (const role of ROLES) if (await canViewHistory(role)) readers.push(role);
    expect(readers).toEqual(["EVENT_ORGANISER", "EVENT_COORDINATOR"]);
    expect(ROLES).toHaveLength(7);
  });
});
