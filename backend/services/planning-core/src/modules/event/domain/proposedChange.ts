import {
  equipmentRequirementsSchema,
  isSignificantEventField,
  venueRequirementsSchema,
  type SignificantEventField,
} from "@connectsphere/contracts";
import { REGISTRATION_AFTER_START_MESSAGE, validateSubmission, type FieldError, type SubmissionCandidate } from "./validation.js";

/**
 * S1 — checks proposed values for an event's significant fields against B2's
 * rules, on the event as it would be after the change. Only errors the change
 * is responsible for are reported: those on a proposed field; those on the end
 * when the start moves (an end left before it), and the registration window
 * left closing after a moved start (reported on the start). A start already in
 * the past is the change's doing only when the start itself is proposed.
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
  if (touched.has("proposedStartAt")) touched.add("proposedEndAt");

  const merged: Record<string, unknown> = { ...current };
  for (const field of proposed) merged[field] = changes[field];
  if (touched.has("proposedStartAt")) merged.proposedStartAt = asInstant(merged.proposedStartAt);
  if (touched.has("proposedEndAt")) merged.proposedEndAt = asInstant(merged.proposedEndAt);

  for (const error of validateSubmission(merged as SubmissionCandidate, now)) {
    if (touched.has(error.field)) {
      errors.push(error);
    } else if (
      touched.has("proposedStartAt") &&
      error.field === "registrationClosesAt" &&
      error.message === REGISTRATION_AFTER_START_MESSAGE
    ) {
      errors.push({
        field: "proposedStartAt",
        message: "Registration closes after this start; move registration first.",
      });
    }
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

/**
 * S2 — a significant field's value as event history keeps it (text, like G1's):
 * an instant as UTC ISO, a number or boolean as `String`, a requirements object
 * as JSON, and no value as null.
 */
export function historyText(field: SignificantEventField, value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (field === "proposedStartAt" || field === "proposedEndAt") {
    const instant = new Date(value as string);
    return Number.isNaN(instant.getTime()) ? String(value) : instant.toISOString();
  }
  if (field === "venueRequirements" || field === "equipmentRequirements") return JSON.stringify(value);
  return String(value);
}
