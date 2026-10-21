import type { ExpireOutcome, RemindOutcome } from "../../modules/venue/index.js";

/**
 * L6 — the activities HoldExpiry calls: the venue module's reminder and expiry
 * rules, reached through its index.ts (ADR-0004). Each runs in one transaction
 * under the hold's row lock. The worker passes the real functions; tests pass fakes.
 */
export interface HoldExpiryActivities {
  remindHoldIfDue(holdId: string): Promise<RemindOutcome>;
  expireHoldIfDue(holdId: string): Promise<ExpireOutcome>;
}

export function createHoldExpiryActivities(
  remind: (holdId: string) => Promise<RemindOutcome>,
  expire: (holdId: string) => Promise<ExpireOutcome>
): HoldExpiryActivities {
  return {
    remindHoldIfDue: (holdId) => remind(holdId),
    expireHoldIfDue: (holdId) => expire(holdId),
  };
}
