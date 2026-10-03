/** Settings only the event module reads. */
export const eventConfig = {
  /**
   * TODO(E1): replace with a live Identity query for active users holding
   * EVENT_COORDINATOR. Until that exists the eligible pool is configuration:
   * a comma-separated list of identity.users.id values.
   */
  coordinatorPool: (process.env.EVENT_COORDINATOR_POOL ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0),
};
