/** Settings only the event module reads. */
export const eventConfig = {
  /**
   * E2's nominee eligibility, as configuration: a comma-separated list of
   * identity.users.id values. E1 also assigned from it until E3 replaced
   * automatic assignment; E4 retires E2's proposals, and this with them.
   */
  coordinatorPool: (process.env.EVENT_COORDINATOR_POOL ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0),
};
