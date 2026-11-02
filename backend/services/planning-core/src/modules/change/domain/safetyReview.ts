import { z } from "zod";
import type { ErrorField } from "@connectsphere/contracts";
import type { SafetyDecisionKind } from "../../event/index.js";
import type { ArrangementFlag } from "./readiness.js";

/**
 * U1 (CR-06) — the Safety Officer's decision as the change module checks it: the body, the
 * arrangements a request for changes names, and the flags that stop an approval. Pure: the router
 * reads the arrangements inside the decision's transaction and passes them in.
 */

/** Requesting changes or rejecting needs a reason (U1 AC3); approving does not. */
export function reasonRequired(decision: SafetyDecisionKind): boolean {
  return decision !== "APPROVE";
}

/** The reason as stored: trimmed, or null when none was given. */
export function normaliseReason(reason: unknown): string | null {
  if (typeof reason !== "string") return null;
  const trimmed = reason.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const REASON_REQUIRED_MESSAGE = "Give a reason when you request changes or reject the safety arrangement.";

export interface SafetyDecisionBody {
  decision: SafetyDecisionKind;
  reason: string | null;
  /** Venue bookings (slot or request ids) the request for changes names. */
  bookingIds: string[];
  /** Equipment reservations the request for changes names. */
  reservationIds: string[];
}

const bodySchema = z.object({
  decision: z.enum(["APPROVE", "REQUEST_CHANGES", "REJECT"], {
    errorMap: () => ({ message: "Choose approve, request changes or reject." }),
  }),
  reason: z.string().max(2000, "Keep the reason under 2000 characters.").optional().nullable(),
  flagBookingIds: z.array(z.string().uuid()).max(50).optional(),
  flagReservationIds: z.array(z.string().uuid()).max(50).optional(),
});

export type ParsedDecision = { ok: true; value: SafetyDecisionBody } | { ok: false; fields: ErrorField[] };

/**
 * AC3 — one decision; a reason is required to request changes or reject. Naming arrangements
 * belongs to a request for changes: an approval or a rejection of the arrangement as a whole
 * flags nothing by name (CQ-08), so naming any with those is refused rather than ignored.
 */
export function parseDecision(body: unknown): ParsedDecision {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, fields: parsed.error.issues.map((issue) => ({ field: issue.path.join(".") || "body", message: issue.message })) };
  }
  const { decision, flagBookingIds = [], flagReservationIds = [] } = parsed.data;
  const reason = normaliseReason(parsed.data.reason);
  const fields: ErrorField[] = [];
  if (reasonRequired(decision) && reason === null) fields.push({ field: "reason", message: REASON_REQUIRED_MESSAGE });
  if (decision !== "REQUEST_CHANGES" && flagBookingIds.length + flagReservationIds.length > 0) {
    fields.push({ field: "flagBookingIds", message: "Name arrangements only when you request changes." });
  }
  if (fields.length > 0) return { ok: false, fields };
  return { ok: true, value: { decision, reason, bookingIds: [...new Set(flagBookingIds)], reservationIds: [...new Set(flagReservationIds)] } };
}

/** The ids a request names that are not among the event's active arrangements. */
export function unknownArrangements(named: readonly string[], available: readonly string[]): string[] {
  return named.filter((id) => !available.includes(id));
}

export const UNKNOWN_ARRANGEMENT_MESSAGE = "A named venue booking or equipment reservation does not belong to this event's active arrangements.";

export interface OutstandingFlag {
  /** What the flag is on: a venue booking, hold or request, or an equipment reservation. */
  what: string;
  name: string;
  flag: ArrangementFlag;
}

const FLAG_WORDS: Record<ArrangementFlag, string> = {
  REQUIRES_RECONFIRMATION: "requires reconfirmation",
  UNSUITABLE: "is flagged unsuitable",
  FLAGGED_FOR_REVIEW: "is flagged for review",
};

/**
 * Commit 259050d — an approval, and Mark Confirmed after it, are refused while any arrangement
 * flag is outstanding, naming each. Null when there is none.
 */
export function outstandingFlagsMessage(flags: readonly OutstandingFlag[]): string | null {
  if (flags.length === 0) return null;
  const parts = flags.map((flag) => `${flag.what} ${flag.name} ${FLAG_WORDS[flag.flag]}`);
  return `The safety arrangements can't be approved while arrangement flags are outstanding: ${parts.join("; ")}.`;
}

export const REQUEST_REASON_FLAG_PREFIX = "Safety review";

/** The reason stored on a flag a request for changes sets, so S3's flag list shows who asked and why. */
export function flagReason(reason: string): string {
  return `${REQUEST_REASON_FLAG_PREFIX}: ${reason}`;
}

export const NOT_ASSIGNED_TO_CONFIRM_MESSAGE = "Only the event's assigned coordinator can mark it Confirmed.";
