import {
  equipmentRequirementsSchema,
  isSignificantEventField,
  venueRequirementsSchema,
  type SignificantEventField,
} from "@connectsphere/contracts";
import { validateSubmission, type FieldError, type SubmissionCandidate } from "./validation.js";

/**
 * S1 — checks proposed values for an event's significant fields against B2's
 * rules, on the event as it would be after the change. Only errors the change
 * is responsible for are reported: those on a proposed field, and on the start
 * or end when either of them moves (an end left before a moved start).
 */
export interface ChangeableEvent extends SubmissionCandidate {
  venueRequirements: unknown;
  equipmentRequirements: unknown;
}

export type ProposedChanges = Partial<Record<SignificantEventField, unknown>>;

/** A value of the wrong type is carried into B2's rules as an unparseable instant, not thrown on. */
function asInstant(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : "invalid";
}

export function checkProposedChange(
  current: ChangeableEvent,
  changes: ProposedChanges,
  now: Date = new Date()
): FieldError[] {
  const errors: FieldError[] = [];
  const proposed = Object.keys(changes).filter(isSignificantEventField);
  const touched = new Set<string>(proposed);
  if (touched.has("proposedStartAt") || touched.has("proposedEndAt")) {
    touched.add("proposedStartAt");
    touched.add("proposedEndAt");
  }

  const merged: Record<string, unknown> = { ...current };
  for (const field of proposed) merged[field] = changes[field];
  if (touched.has("proposedStartAt")) merged.proposedStartAt = asInstant(merged.proposedStartAt);
  if (touched.has("proposedEndAt")) merged.proposedEndAt = asInstant(merged.proposedEndAt);

  for (const error of validateSubmission(merged as SubmissionCandidate, now)) {
    if (touched.has(error.field)) errors.push(error);
  }

  // B2 only checks that equipmentRequired is stated; a change must also state a boolean.
  if (
    touched.has("equipmentRequired") &&
    merged.equipmentRequired !== null &&
    merged.equipmentRequired !== undefined &&
    typeof merged.equipmentRequired !== "boolean"
  ) {
    errors.push({ field: "equipmentRequired", message: "Whether equipment is required must be true or false." });
  }

  if (touched.has("venueRequirements") && merged.venueRequirements !== null) {
    if (!venueRequirementsSchema.safeParse(merged.venueRequirements).success) {
      errors.push({ field: "venueRequirements", message: "Venue requirements are not in the expected form." });
    }
  }
  if (touched.has("equipmentRequirements") && merged.equipmentRequirements !== null) {
    if (!equipmentRequirementsSchema.safeParse(merged.equipmentRequirements).success) {
      errors.push({
        field: "equipmentRequirements",
        message: "Equipment requirements are not in the expected form.",
      });
    }
  }
  return errors;
}
