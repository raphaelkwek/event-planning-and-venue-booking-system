/** Settings only the event module reads. */
export const eventConfig = {
  /**
   * The `producer` written into every event message envelope. It stays
   * "event-service" after the move into planning-core, so message consumers see
   * no change; EN-04.1 replaces the envelope with CloudEvents (ADR-0008).
   */
  producer: process.env.EVENT_SERVICE_NAME ?? "event-service",
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
