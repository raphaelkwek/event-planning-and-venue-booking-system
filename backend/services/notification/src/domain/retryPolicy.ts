/**
 * How the notification consumer retries a failure that may pass, such as the
 * database being briefly unreachable (implementation.md §3.5, which leaves the
 * numbers to EN-04.3): three retries, after 5 s, 30 s and 2 min, then the
 * dead-letter topic. Pure, so every rule here is unit-tested.
 */

export const MAX_RETRIES = 3;

const DELAYS_MS = [5_000, 30_000, 120_000];

/** How long to wait before retry number `attempt` (1-based). */
export function retryDelayMs(attempt: number): number {
  return DELAYS_MS[Math.min(attempt, DELAYS_MS.length) - 1]!;
}

/** Kafka headers the consumer adds. Prefixed so they cannot clash with CloudEvents' ce_ headers. */
export const ATTEMPT_HEADER = "connectsphere-attempt";
export const NOT_BEFORE_HEADER = "connectsphere-not-before";
export const ORIGINAL_TOPIC_HEADER = "connectsphere-original-topic";
export const ERROR_HEADER = "connectsphere-error";

/** Which retry this delivery is: 0 for a message read from its own topic. */
export function attemptOf(headers: Record<string, string | undefined>): number {
  const attempt = Number(headers[ATTEMPT_HEADER] ?? 0);
  return Number.isInteger(attempt) && attempt > 0 ? attempt : 0;
}
