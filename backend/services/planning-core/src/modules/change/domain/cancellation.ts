import type { ErrorField } from "@connectsphere/contracts";
import { MAX_REASON_LENGTH } from "./changeRequests.js";

/**
 * F3 — the rules of a cancellation that need no database: the body (AC2) and
 * the messages a person reads.
 */

const REASON_MESSAGE = "Give a reason for cancelling the event.";

/** AC2 — a reason is mandatory: trimmed, 1 to 1,000 characters, as S1's reason. */
export function validateCancellationBody(raw: unknown): { ok: true; reason: string } | { ok: false; fields: ErrorField[] } {
  const body = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length === 0) return { ok: false, fields: [{ field: "reason", message: REASON_MESSAGE }] };
  if (reason.length > MAX_REASON_LENGTH) {
    return { ok: false, fields: [{ field: "reason", message: `The reason can be at most ${MAX_REASON_LENGTH} characters.` }] };
  }
  return { ok: true, reason };
}

export const NOT_PERMITTED_TO_CANCEL_MESSAGE = "Only the event's owner or its assigned coordinator can cancel it.";

/** F4 AC5 — the transaction rolled back, so the event keeps its status and nothing was released. */
export const CANCELLATION_FAILED_MESSAGE =
  "The event was not cancelled: something went wrong, so nothing was changed. Try again, or contact support if it keeps happening.";

/**
 * F4 — the cancellation locks the event's venues, then the event. A hold or booking request at a
 * venue it didn't lock can commit between the two; the cancellation then sees the venue only once it
 * holds the event, and locking that venue then would break implementation.md §4.6 (venues before
 * events). These are the venues the event has now that weren't locked first; any at all means the
 * attempt writes nothing and is tried again.
 */
export function unlockedVenues(locked: readonly string[], now: readonly string[]): string[] {
  return now.filter((venueId) => !locked.includes(venueId));
}

/** F4: how many times a cancellation is tried while the event's venues keep changing under it. */
export const CANCELLATION_ATTEMPTS = 3;

/** Runs `attempt` again while `retry` says so, at most `attempts` times in all, and returns the last outcome. */
export async function retryWhile<T>(
  attempt: () => Promise<T>,
  retry: (outcome: T) => boolean,
  attempts: number = CANCELLATION_ATTEMPTS
): Promise<T> {
  let outcome = await attempt();
  for (let tried = 1; tried < attempts && retry(outcome); tried += 1) outcome = await attempt();
  return outcome;
}

/** F4: every attempt found new venue arrangements under it, so nothing was cancelled or released. */
export const CANCELLATION_CONTENDED_MESSAGE =
  "The event was not cancelled: its venue bookings changed while it was being cancelled, so nothing was changed. Try again.";
