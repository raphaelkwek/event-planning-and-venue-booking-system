import {
  UNAVAILABILITY_REASON_LABELS,
  UNAVAILABILITY_REASON_TYPES,
  type ErrorField,
  type UnavailabilityReasonType,
} from "@connectsphere/contracts";
import { instant } from "./bookingRequest.js";
import { listed, singaporePeriod } from "./bookingDecision.js";

/**
 * I2 — a period when a venue can't be used. These rules read a block and say
 * why a request over one is refused. What a block overlaps is Postgres's
 * decision, with `&&` on `[)` ranges (implementation.md §4.5), so periods that
 * only touch don't overlap.
 */

export const NOT_VENUE_STAFF = "Only the venue's Venue Staff can record or remove its unavailability.";

const MAX_DESCRIPTION = 1000;
const START_REQUIRED = "Enter the start date and time.";
const END_INVALID = "Enter the end as a date and time with its offset, or leave it out for a block with no end.";
const END_AFTER_START = "The end must be after the start.";

export interface BlockInput {
  /** UTC instants. The end is null for a block that lasts until Venue Staff remove it (I5). */
  startsAt: string;
  endsAt: string | null;
  reasonType: UnavailabilityReasonType;
  description: string;
}

/**
 * The start, and the end if there is one, each with its offset, the end after the start
 * (I2-T3). The end may be left out, null or empty: the block then has no end and lasts until
 * Venue Staff remove it (I5, the customer's W9-49). Whatever is wrong is added to `fields`; the
 * period is only usable when nothing was.
 */
function period(b: Record<string, unknown>, fields: ErrorField[]): { startsAt: string | null; endsAt: string | null } {
  const startsAt = instant(b.startsAt);
  if (!startsAt) fields.push({ field: "startsAt", message: START_REQUIRED });
  const left = b.endsAt === undefined || b.endsAt === null || (typeof b.endsAt === "string" && b.endsAt.trim() === "");
  if (left) return { startsAt, endsAt: null };
  const endsAt = instant(b.endsAt);
  if (!endsAt) fields.push({ field: "endsAt", message: END_INVALID });
  else if (startsAt && endsAt <= startsAt) fields.push({ field: "endsAt", message: END_AFTER_START });
  return { startsAt, endsAt };
}

/** A block as sent, every field mandatory (I2-T2), or every field that is wrong with it. */
export function readBlock(body: unknown): { ok: true; block: BlockInput } | { ok: false; fields: ErrorField[] } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, fields: [{ field: "body", message: "Send the block as a JSON object." }] };
  }
  const b = body as Record<string, unknown>;
  const fields: ErrorField[] = [];
  const when = period(b, fields);

  const reasonType = UNAVAILABILITY_REASON_TYPES.find((type) => type === b.reasonType);
  if (!reasonType) fields.push({ field: "reasonType", message: "Choose a reason type." });

  const description = typeof b.description === "string" ? b.description.trim() : "";
  if (description === "") fields.push({ field: "description", message: "Enter a description." });
  else if (description.length > MAX_DESCRIPTION) {
    fields.push({ field: "description", message: `Keep the description to ${MAX_DESCRIPTION} characters or fewer.` });
  }

  if (fields.length > 0) return { ok: false, fields };
  return { ok: true, block: { startsAt: when.startsAt!, endsAt: when.endsAt, reasonType: reasonType!, description } };
}

/** The period a review asks about (I2-T4): what a block over it would disrupt. */
export function readPeriod(query: Record<string, unknown>): { ok: true; startsAt: string; endsAt: string | null } | { ok: false; fields: ErrorField[] } {
  const fields: ErrorField[] = [];
  const when = period(query, fields);
  if (fields.length > 0) return { ok: false, fields };
  return { ok: true, startsAt: when.startsAt!, endsAt: when.endsAt };
}

export interface BlockedPeriod {
  reasonType: UnavailabilityReasonType;
  description: string;
  startsAt: string;
  /** Null for a block with no end (I5). */
  endsAt: string | null;
}

/** Each block as the refusals name it: its reason type, description and period. */
function namedBlocks(blocks: readonly BlockedPeriod[]): string {
  return listed(
    blocks.map((b) => `${UNAVAILABILITY_REASON_LABELS[b.reasonType]}, “${b.description}” (${singaporePeriod(b.startsAt, b.endsAt)})`),
  );
}

/** I2-T10: a request over recorded unavailability is refused, naming each block it overlaps. */
export function requestBlockedMessage(venueName: string, blocks: readonly BlockedPeriod[]): string {
  return `${venueName} is unavailable for ${namedBlocks(blocks)}, so it can't be requested for this period. Choose another time or venue.`;
}

/**
 * I4 (W9-41): a hold over recorded unavailability is refused, naming each block
 * it overlaps. Placing a requested hold names it, and says it stays Requested.
 */
export function holdBlockedMessage(venueName: string, blocks: readonly BlockedPeriod[], placingReference?: string): string {
  const unavailable = `${venueName} is unavailable for ${namedBlocks(blocks)}`;
  return placingReference
    ? `${unavailable}, so ${placingReference} can't be placed for this period. It stays Requested.`
    : `${unavailable}, so a hold can't be requested for this period. Choose another time or venue.`;
}
