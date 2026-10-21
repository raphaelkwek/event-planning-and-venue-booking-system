import { HOLD_STATUS_LABELS, type ErrorField, type HoldStatus } from "@connectsphere/contracts";
import { readPlacement } from "./hold.js";

/**
 * L6 — a hold's expiry and reminder times. Pure rules; the timing itself is the
 * Temporal timer per hold, and the decisions are taken under a row lock (repo/holds.ts).
 */

const MINUTE_MS = 60_000;

/** When the holding coordinator is reminded: the lead time before the expiry. */
export function reminderAt(expiresAt: string, leadMinutes: number): Date {
  return new Date(Date.parse(expiresAt) - leadMinutes * MINUTE_MS);
}

/**
 * The new expiry Venue Staff send for a held hold: the same rule as placing one,
 * a valid instant later than now (CR-04).
 */
export function readExpiryChange(body: unknown, now: Date): { ok: true; expiresAt: string } | { ok: false; fields: ErrorField[] } {
  return readPlacement(body, now);
}

export function expiryNotChangeableMessage(reference: string, status: HoldStatus): string {
  return `${reference} is ${HOLD_STATUS_LABELS[status]}, so its expiry can't be changed. Only a hold Venue Staff have placed and that is still held has one.`;
}
