import { createServiceMetrics, Histogram } from "@connectsphere/observability";

/**
 * The notification service's metrics (EN-17, ADR-0013): the shared HTTP
 * timings, and how long a notification took to become visible.
 */
export const metrics = createServiceMetrics({ service: "notification", token: process.env.METRICS_TOKEN });

/**
 * Seconds from the CloudEvent's `time` (when the originating change committed,
 * through the outbox) to the moment the notification row committed here, which
 * is when GET /api/v1/notifications can first show it. The freshness SLO is
 * the share of observations at or under 10 s (bucket le="10").
 */
export const visibilityLag = new Histogram({
  name: "notification_visibility_lag_seconds",
  help: "Seconds from the originating commit to the notification being visible to its recipient.",
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60, 120, 300],
  registers: [metrics.registry],
});

/** Records one stored notification message. A clock that runs behind the producer's counts as 0. */
export function recordVisibilityLag(eventTime: string, storedAtMs: number): void {
  visibilityLag.observe(Math.max(0, (storedAtMs - Date.parse(eventTime)) / 1000));
}
