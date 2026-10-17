import { z } from "zod";
import type { EquipmentRequestLineStatus, ErrorField } from "@connectsphere/contracts";
import { MAX_REASON_LENGTH } from "./requestLines.js";

/**
 * Q1 — the pure rules for reserving a request line (spec decisions 1 and 3).
 * Only Confirmed and Substituted lines are reservable; a Substituted line
 * reserves O2's substitute. One reservation per line: the quantity defaults to
 * the requested one, a lower one must be confirmed as partial, a higher one is
 * refused.
 */

export interface LineForReservation {
  status: EquipmentRequestLineStatus;
  equipmentTypeId: string;
  quantity: number;
  substituteEquipmentTypeId: string | null;
  substituteQuantity: number | null;
}

export interface ReservationTarget {
  equipmentTypeId: string;
  requestedQuantity: number;
}

/** What the line reserves, or null when its status is not reservable. */
export function reservationTarget(line: LineForReservation): ReservationTarget | null {
  if (line.status === "CONFIRMED") return { equipmentTypeId: line.equipmentTypeId, requestedQuantity: line.quantity };
  if (line.status === "SUBSTITUTED" && line.substituteEquipmentTypeId && line.substituteQuantity) {
    return { equipmentTypeId: line.substituteEquipmentTypeId, requestedQuantity: line.substituteQuantity };
  }
  return null;
}

export interface ReservationBody {
  /** Absent from the request body (null here) means "the requested quantity". */
  quantity: number | null;
  partial: boolean;
}

const bodySchema = z.object({
  quantity: z
    .number({ invalid_type_error: "Quantity must be a whole number of 1 or more." })
    .int("Quantity must be a whole number of 1 or more.")
    .min(1, "Quantity must be a whole number of 1 or more.")
    .optional(),
  partial: z.boolean({ invalid_type_error: "Partial must be true or false." }).optional(),
});

export function validateReservationBody(raw: unknown): { ok: true; body: ReservationBody } | { ok: false; fields: ErrorField[] } {
  const result = bodySchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, fields: result.error.issues.map((issue) => ({ field: issue.path.join(".") || "body", message: issue.message })) };
  }
  return { ok: true, body: { quantity: result.data.quantity ?? null, partial: result.data.partial ?? false } };
}

export type QuantityDecision =
  | { ok: true; quantity: number }
  | { ok: false; code: "PARTIAL_NOT_CONFIRMED"; message: string }
  | { ok: false; code: "VALIDATION_FAILED"; fields: ErrorField[] };

export function decideQuantity(requested: number, body: ReservationBody): QuantityDecision {
  const quantity = body.quantity ?? requested;
  if (quantity > requested) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      fields: [{ field: "quantity", message: `You can reserve at most ${requested}, the quantity requested.` }],
    };
  }
  if (quantity < requested && !body.partial) {
    return {
      ok: false,
      code: "PARTIAL_NOT_CONFIRMED",
      message: `${requested} were requested. Confirm a partial reservation to reserve ${quantity}.`,
    };
  }
  return { ok: true, quantity };
}

/**
 * Q2 — Technical Support give a reason for every release, as O2 does for
 * Unavailable. Missing, blank or non-text reasons are refused on `reason`.
 */
export function validateReleaseBody(raw: unknown): { ok: true; reason: string } | { ok: false; fields: ErrorField[] } {
  const given =
    typeof raw === "object" && raw !== null && typeof (raw as { reason?: unknown }).reason === "string"
      ? (raw as { reason: string }).reason.trim()
      : "";
  if (given === "") return { ok: false, fields: [{ field: "reason", message: "Give a reason for releasing the reservation." }] };
  if (given.length > MAX_REASON_LENGTH) {
    return { ok: false, fields: [{ field: "reason", message: `The reason can be at most ${MAX_REASON_LENGTH} characters.` }] };
  }
  return { ok: true, reason: given };
}

/**
 * Q2 — a released line goes back to the status it was reserved from. O2 keeps
 * the substitute columns only while a line is Substituted, so their presence
 * says which.
 */
export function statusAfterRelease(line: {
  substituteEquipmentTypeId: string | null;
  substituteQuantity: number | null;
}): "CONFIRMED" | "SUBSTITUTED" {
  return line.substituteEquipmentTypeId && line.substituteQuantity ? "SUBSTITUTED" : "CONFIRMED";
}
