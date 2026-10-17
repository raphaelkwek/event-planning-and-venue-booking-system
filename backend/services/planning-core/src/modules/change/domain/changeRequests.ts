import {
  EVENT_STATUS_LABELS,
  SIGNIFICANT_FIELD_LABELS,
  isSignificantEventField,
  type ErrorField,
  type SignificantEventField,
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

const DECISION_MESSAGE = "Choose Approve or Reject.";
const REJECT_REASON_MESSAGE = "Give a reason for rejecting the change.";

/** S2 — the decision label a person reads, and the one the 409 names. */
export const DECISION_LABELS = { APPROVED: "Approved", REJECTED: "Rejected" } as const;

export function alreadyDecidedMessage(status: "APPROVED" | "REJECTED", decidedAt: string): string {
  return `This change request was already ${DECISION_LABELS[status]} on ${decidedAt}.`;
}

/**
 * S2 — the body of a decision: Approve, or Reject with a reason (AC2). Every problem is
 * reported. An approval ignores any reason sent with it.
 */
export function validateDecisionBody(
  raw: unknown
): { ok: true; decision: "APPROVE" } | { ok: true; decision: "REJECT"; reason: string } | { ok: false; fields: ErrorField[] } {
  const body = isPlainObject(raw) ? raw : {};
  if (body.decision === "APPROVE") return { ok: true, decision: "APPROVE" };
  if (body.decision !== "REJECT") return { ok: false, fields: [{ field: "decision", message: DECISION_MESSAGE }] };

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length === 0) return { ok: false, fields: [{ field: "reason", message: REJECT_REASON_MESSAGE }] };
  if (reason.length > MAX_REASON_LENGTH) {
    return { ok: false, fields: [{ field: "reason", message: `The reason can be at most ${MAX_REASON_LENGTH} characters.` }] };
  }
  return { ok: true, decision: "REJECT", reason };
}

/** A value in a form that compares equal when it means the same: an instant as UTC ISO, objects with sorted keys. */
function comparable(field: SignificantEventField, value: unknown): string {
  if ((field === "proposedStartAt" || field === "proposedEndAt") && typeof value === "string") {
    const instant = new Date(value);
    if (!Number.isNaN(instant.getTime())) return instant.toISOString();
  }
  const sorted = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sorted)
      : v !== null && typeof v === "object"
        ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, sorted(x)]))
        : v;
  return JSON.stringify(sorted(value ?? null));
}

/**
 * S2 — the requested fields whose live value is no longer the one snapshotted when the request
 * was made (D3 lets the organiser amend them while Awaiting Clarification), as `changes.<field>` errors.
 */
export function staleFields(
  live: Partial<Record<SignificantEventField, unknown>>,
  fields: { fieldName: SignificantEventField; currentValue: unknown }[]
): ErrorField[] {
  return fields
    .filter((field) => comparable(field.fieldName, live[field.fieldName]) !== comparable(field.fieldName, field.currentValue))
    .map((field) => ({
      field: `changes.${field.fieldName}`,
      message: `The event's ${SIGNIFICANT_FIELD_LABELS[field.fieldName]} changed after this request was made. Reject it; the organiser can request again.`,
    }));
}

export function cannotApproveMessage(status: EventStatus): string {
  return `The event is ${EVENT_STATUS_LABELS[status]}, so the change can't be approved. You can still reject it.`;
}
