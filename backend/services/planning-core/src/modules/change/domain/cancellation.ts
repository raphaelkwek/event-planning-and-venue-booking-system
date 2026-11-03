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
