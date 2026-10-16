import {
  EVENT_STATUS_LABELS,
  isSignificantEventField,
  type ErrorField,
  type EventStatus,
} from "@connectsphere/contracts";
import type { ProposedChanges } from "../../event/index.js";

/**
 * S1 — the rules of a change request that need no database: which statuses
 * accept one (AC1), and the shape of the body (AC2).
 */

/** Submitted or later, while the event is still going ahead. */
export const CHANGEABLE_STATUSES: EventStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "AWAITING_CLARIFICATION",
  "APPROVED",
  "PLANNING",
  "SAFETY_REVIEW",
  "CONFIRMED",
];

export const MAX_REASON_LENGTH = 1000;

/** The descriptive fields G1's Edit details owns. */
const DETAIL_FIELDS = ["purpose", "description", "accessibilityNeeds", "contactDetails"];

export function isChangeable(status: EventStatus): boolean {
  return CHANGEABLE_STATUSES.includes(status);
}

export function notChangeableMessage(status: EventStatus): string {
  return `A change can be requested only once the event is submitted and while it is still going ahead. It is ${EVENT_STATUS_LABELS[status]}.`;
}

const REASON_MESSAGE = "Give a reason for the change.";
const NO_CHANGES_MESSAGE = "Propose at least one change.";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Every problem is reported, never just the first. A refusal also carries the significant fields
 * that were proposed, so their values can be checked and reported together with these problems.
 */
export function validateChangeBody(
  raw: unknown
):
  | { ok: true; reason: string; changes: ProposedChanges }
  | { ok: false; fields: ErrorField[]; proposed: ProposedChanges } {
  const body = isPlainObject(raw) ? raw : {};
  const fields: ErrorField[] = [];

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length === 0 || reason.length > MAX_REASON_LENGTH) {
    fields.push({
      field: "reason",
      message: reason.length === 0 ? REASON_MESSAGE : `The reason can be at most ${MAX_REASON_LENGTH} characters.`,
    });
  }

  const changes = body.changes;
  const proposed: ProposedChanges = {};
  if (!isPlainObject(changes) || Object.keys(changes).length === 0) {
    fields.push({ field: "changes", message: NO_CHANGES_MESSAGE });
  } else {
    for (const key of Object.keys(changes)) {
      if (isSignificantEventField(key)) {
        proposed[key] = changes[key];
        continue;
      }
      fields.push({
        field: `changes.${key}`,
        message: DETAIL_FIELDS.includes(key) ? "Change this through Edit details." : "This field can't be changed.",
      });
    }
  }

  if (fields.length > 0) return { ok: false, fields, proposed };
  return { ok: true, reason, changes: changes as ProposedChanges };
}

/** A proposed start or end is stored as an instant in UTC, whatever offset it was written with. */
export function normaliseInstants(changes: ProposedChanges): ProposedChanges {
  const normalised: ProposedChanges = { ...changes };
  for (const field of ["proposedStartAt", "proposedEndAt"] as const) {
    const value = normalised[field];
    const instant = typeof value === "string" ? new Date(value) : null;
    if (instant && !Number.isNaN(instant.getTime())) normalised[field] = instant.toISOString();
  }
  return normalised;
}
